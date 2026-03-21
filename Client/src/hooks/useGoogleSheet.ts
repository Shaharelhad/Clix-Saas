import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/services/supabase";
import { callSheetsSync, callRagDelete } from "@/services/edge-functions";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/types/database";

type UserDocument = Tables<"user_documents">;

const SHEET_URL_REGEX = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export interface SheetSourceConfig {
  sheet_id?: string;
  last_row_hash?: string;
  row_count?: number;
  sheet_name?: string;
  last_synced_at?: string;
}

export function useGoogleSheet() {
  const { t } = useTranslation("rag");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current Google Sheet document
  const { data: sheetDocument = null, isLoading } = useQuery<UserDocument | null>({
    queryKey: ["google-sheet-document", user?.id],
    enabled: !!user?.id,
    refetchInterval: (query) => {
      const doc = query.state.data;
      return doc?.status === "processing" ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await supabase
        .from("user_documents")
        .select("*")
        .eq("user_id", user!.id)
        .eq("source_type", "google_sheet")
        .maybeSingle();
      return data;
    },
  });

  const connectSheet = useCallback(
    async (url: string) => {
      if (!user?.id) return;

      setError(null);

      // Validate URL
      if (!SHEET_URL_REGEX.test(url)) {
        setError(t("sheetsErrorUrl"));
        return;
      }

      setIsConnecting(true);

      try {
        const { data, error: fnError } = await callSheetsSync({
          sheet_url: url,
          action: "connect",
        });

        if (fnError) {
          setError(fnError);
          setIsConnecting(false);
          return;
        }

        if (data && typeof data === "object" && "error" in data) {
          setError((data as { error: string }).error);
          setIsConnecting(false);
          return;
        }

        await queryClient.refetchQueries({
          queryKey: ["google-sheet-document", user.id],
        });
      } catch {
        setError(t("sheetsErrorConnect"));
      } finally {
        setIsConnecting(false);
      }
    },
    [user?.id, t, queryClient],
  );

  const syncSheet = useCallback(async () => {
    if (!user?.id || !sheetDocument) return;

    setError(null);
    setSuccess(null);
    setIsSyncing(true);

    try {
      const { data, error: fnError } = await callSheetsSync({
        sheet_url: sheetDocument.source_url,
        action: "sync",
        document_id: sheetDocument.id,
      });

      if (fnError) {
        setError(fnError);
        return;
      }

      const result = data as {
        success?: boolean;
        no_changes?: boolean;
        error?: string;
        row_count?: number;
        last_synced_at?: string;
        chunk_count?: number;
        sheet_name?: string;
      } | null;

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.no_changes) {
        setError(t("sheetsNoChanges"));
      } else if (result?.success) {
        setSuccess(t("sheetsSyncSuccess"));
        setTimeout(() => setSuccess(null), 3000);
      }

      // Optimistically update cache with response data
      if (result?.success) {
        queryClient.setQueryData(
          ["google-sheet-document", user?.id],
          (old: UserDocument | null) => {
            if (!old) return old;
            const prev = (old.source_config ?? {}) as Record<string, unknown>;
            return {
              ...old,
              source_config: {
                ...prev,
                ...(result.row_count != null && { row_count: result.row_count }),
                ...(result.last_synced_at && { last_synced_at: result.last_synced_at }),
                ...(result.sheet_name && { sheet_name: result.sheet_name }),
              },
              ...(result.chunk_count != null && { chunk_count: result.chunk_count }),
            };
          },
        );
      }
    } catch {
      setError(t("sheetsErrorSync"));
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, sheetDocument, t, queryClient]);

  const disconnectSheet = useCallback(async () => {
    if (!user?.id || !sheetDocument) return;

    setError(null);

    try {
      const { error: fnError } = await callRagDelete({
        document_id: sheetDocument.id,
      });

      if (fnError) {
        setError(fnError);
        return;
      }
    } catch {
      setError(t("sheetsErrorConnect"));
    } finally {
      await queryClient.refetchQueries({
        queryKey: ["google-sheet-document", user?.id],
      });
    }
  }, [user?.id, sheetDocument, t, queryClient]);

  const sourceConfig = (sheetDocument?.source_config ?? {}) as SheetSourceConfig;

  return {
    sheetDocument,
    sourceConfig,
    isLoading,
    isConnecting,
    isSyncing,
    connectSheet,
    syncSheet,
    disconnectSheet,
    error,
    setError,
    success,
    setSuccess,
  };
}
