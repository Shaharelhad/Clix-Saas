import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/services/supabase";
import { callRagUpload, callRagDelete } from "@/services/edge-functions";
import { useAuth } from "@/hooks/useAuth";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import type { Tables } from "@/types/database";

type UserDocument = Tables<"user_documents">;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "text/plain"] as const;

function validateFile(
  file: File,
  t: (key: string) => string,
): string | null {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return t("errorFileType");
  }
  if (file.size > MAX_FILE_SIZE) {
    return t("errorFileSize");
  }
  return null;
}

export function useRagUpload() {
  const { t } = useTranslation("rag");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch current document
  const { data: document = null, isLoading } = useQuery<UserDocument | null>({
    queryKey: ["rag-document", user?.id],
    enabled: !!user?.id,
    refetchInterval: (query) => {
      // Poll every 3s while processing
      const doc = query.state.data;
      return doc?.status === "processing" ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await supabase
        .from("user_documents")
        .select("*")
        .eq("user_id", user!.id)
        .eq("source_type", "file")
        .maybeSingle();
      return data;
    },
  });

  const uploadFile = useCallback(
    async (file: File) => {
      if (!user?.id) return;

      setError(null);
      setIsUploading(true);

      try {
        // Validate file
        const validationError = validateFile(file, t);
        if (validationError) {
          setError(validationError);
          setIsUploading(false);
          return;
        }

        // Extract text
        setUploadProgress(t("extractingText"));
        let extractedText: string;
        if (file.type === "application/pdf") {
          extractedText = await extractTextFromPdf(file);
        } else {
          extractedText = await file.text();
        }

        if (!extractedText.trim()) {
          setError(t("errorEmptyText"));
          setIsUploading(false);
          return;
        }

        // Upload raw file to storage
        setUploadProgress(t("uploadingFile"));
        const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
        const storagePath = `${user.id}/document.${ext}`;

        const { error: storageError } = await supabase.storage
          .from("rag-documents")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: true,
          });

        if (storageError) {
          setError(t("errorUpload"));
          setIsUploading(false);
          return;
        }

        // Call edge function to chunk + embed
        setUploadProgress(t("processingFile"));
        const fileType = ext === "pdf" ? "pdf" : "txt";

        const { error: fnError } = await callRagUpload({
          user_id: user.id,
          file_name: file.name,
          file_size: file.size,
          file_type: fileType,
          extracted_text: extractedText,
          storage_path: storagePath,
        });

        if (fnError) {
          setError(t("errorProcessing"));
          setIsUploading(false);
          return;
        }

        // Invalidate query to trigger refetch (will poll while processing)
        await queryClient.invalidateQueries({
          queryKey: ["rag-document", user.id],
        });
      } catch {
        setError(t("errorUpload"));
      } finally {
        setIsUploading(false);
        setUploadProgress("");
      }
    },
    [user?.id, t, queryClient],
  );

  const deleteDocument = useCallback(async () => {
    if (!user?.id) return;

    setError(null);

    try {
      const { error: fnError } = await callRagDelete({ user_id: user.id });
      if (fnError) {
        setError(fnError);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ["rag-document", user.id],
      });
    } catch {
      setError(t("errorDelete"));
    }
  }, [user?.id, t, queryClient]);

  return {
    document,
    isLoading,
    isUploading,
    uploadProgress,
    uploadFile,
    deleteDocument,
    error,
    setError,
  };
}
