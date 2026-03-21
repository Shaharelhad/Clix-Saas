import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { useRagUpload } from "@/hooks/useRagUpload";
import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/animations";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBaseSection() {
  const { t, i18n } = useTranslation("rag");
  const {
    document,
    isLoading,
    isUploading,
    uploadProgress,
    uploadFile,
    deleteDocument,
    error,
    setError,
  } = useRagUpload();

  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setConfirmDelete(false);
      uploadFile(file);
    },
    [uploadFile, setError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFile],
  );

  const handleDelete = useCallback(async () => {
    await deleteDocument();
    setConfirmDelete(false);
  }, [deleteDocument]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <div className="p-2.5 bg-[#FF7E47]/10 rounded-xl">
          <BookOpen className="w-5 h-5 text-[#FF7E47]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#2D2A26]">{t("uploadTitle")}</h2>
          <p className="text-sm text-[#7A7267]">{t("uploadDesc")}</p>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        variants={fadeUp}
        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 p-6"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#FF7E47] animate-spin" />
          </div>
        ) : isUploading || document?.status === "processing" ? (
          /* Uploading / Processing */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-[#FF7E47] animate-spin" />
            <p className="text-sm text-[#7A7267] font-medium">
              {uploadProgress || t("processingFile")}
            </p>
          </div>
        ) : document?.status === "ready" ? (
          /* Document Ready */
          <div className="space-y-5">
            <div className="bg-[#FAF7F3] rounded-xl p-5 border border-[#EDE6DD]/60">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-[#FF7E47]/10 rounded-lg shrink-0">
                  <FileText className="w-5 h-5 text-[#FF7E47]" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#2D2A26] truncate">
                      {document.file_name}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      <Check className="w-3 h-3" />
                      {t("statusReady")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#7A7267]">
                    <span>
                      {t("fileSize")}: {formatFileSize(document.file_size)}
                    </span>
                    <span>
                      {t("chunks")}: {document.chunk_count}
                    </span>
                    <span className="col-span-2">
                      {t("uploadDate")}:{" "}
                      {new Date(document.created_at).toLocaleDateString(
                        i18n.language === "he" ? "he-IL" : "en-US",
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#FF7E47] bg-[#FF7E47]/10 hover:bg-[#FF7E47]/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t("replaceFile")}
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmDelete ? handleDelete() : setConfirmDelete(true)
                }
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  confirmDelete
                    ? "text-white bg-red-500 hover:bg-red-600"
                    : "text-red-500 bg-red-50 hover:bg-red-100",
                )}
              >
                <Trash2 className="w-4 h-4" />
                {confirmDelete ? t("removeConfirm") : t("removeFile")}
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Error — show upload zone */
          <div className="space-y-4">
            {/* Error message */}
            {(error || document?.status === "error") && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-700">
                  {error || document?.error_message || t("errorProcessing")}
                </span>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3 py-16 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
                isDragOver
                  ? "border-[#FF7E47] bg-[#FF7E47]/5"
                  : "border-[#EDE6DD] hover:border-[#FF7E47]/40 hover:bg-[#FAF7F3]",
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-full transition-colors",
                  isDragOver ? "bg-[#FF7E47]/15" : "bg-[#EDE6DD]/60",
                )}
              >
                <Upload
                  className={cn(
                    "w-6 h-6 transition-colors",
                    isDragOver ? "text-[#FF7E47]" : "text-[#A39B90]",
                  )}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#2D2A26]">
                  {t("dragDrop")}
                </p>
                <p className="text-xs text-[#A39B90] mt-1">
                  {t("supportedFormats")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="hidden"
          onChange={handleFileInput}
        />
      </motion.div>
    </motion.div>
  );
}
