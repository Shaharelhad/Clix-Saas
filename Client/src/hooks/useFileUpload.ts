import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/services/supabase";
import type { FileUploadItem } from "@/types/form";

export function useFileUpload(userId: string | undefined) {
  const { t } = useTranslation("common");
  const [fileUploads, setFileUploads] = useState<Record<string, FileUploadItem[]>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Revoke all blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(fileUploads)
        .flat()
        .forEach((item) => {
          if (item.previewUrl && item.file) URL.revokeObjectURL(item.previewUrl);
        });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (fieldId: string, files: FileList | null) => {
    if (!files || files.length === 0 || !userId) return;

    const newItems: FileUploadItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");
      if (!isMedia) continue;

      newItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        storedUrl: "",
        uploading: true,
        uploaded: false,
        error: "",
        category: "",
        itemName: "",
        description: "",
        fileType: file.type.startsWith("video/") ? "video" : "image",
        fileName: file.name,
      });
    }

    if (newItems.length === 0) return;

    setFileUploads((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] ?? []), ...newItems],
    }));

    for (const item of newItems) {
      try {
        const ext = item.file!.name.split(".").pop()?.toLowerCase() || "bin";
        const storagePath = `${userId}/${item.id}.${ext}`;
        const { error } = await supabase.storage
          .from("bot-media")
          .upload(storagePath, item.file!, { contentType: item.file!.type, upsert: false });

        if (error) {
          setFileUploads((prev) => ({
            ...prev,
            [fieldId]: (prev[fieldId] ?? []).map((f) =>
              f.id === item.id ? { ...f, uploading: false, error: error.message } : f,
            ),
          }));
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("bot-media")
          .getPublicUrl(storagePath);

        setFileUploads((prev) => ({
          ...prev,
          [fieldId]: (prev[fieldId] ?? []).map((f) =>
            f.id === item.id
              ? { ...f, uploading: false, uploaded: true, storedUrl: publicUrlData.publicUrl }
              : f,
          ),
        }));
      } catch (err) {
        setFileUploads((prev) => ({
          ...prev,
          [fieldId]: (prev[fieldId] ?? []).map((f) =>
            f.id === item.id
              ? { ...f, uploading: false, error: err instanceof Error ? err.message : t("uploadError") }
              : f,
          ),
        }));
      }
    }

    if (fileInputRefs.current[fieldId]) {
      fileInputRefs.current[fieldId]!.value = "";
    }
  };

  const removeFileUpload = (fieldId: string, itemId: string) => {
    setFileUploads((prev) => {
      const items = prev[fieldId] ?? [];
      const item = items.find((f) => f.id === itemId);
      if (item?.file) URL.revokeObjectURL(item.previewUrl);
      return { ...prev, [fieldId]: items.filter((f) => f.id !== itemId) };
    });
  };

  const updateFileMetadata = (
    fieldId: string,
    itemId: string,
    key: "category" | "itemName" | "description",
    value: string,
  ) => {
    setFileUploads((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] ?? []).map((f) =>
        f.id === itemId ? { ...f, [key]: value } : f,
      ),
    }));
  };

  return {
    fileUploads,
    setFileUploads,
    fileInputRefs,
    handleFileSelect,
    removeFileUpload,
    updateFileMetadata,
  };
}
