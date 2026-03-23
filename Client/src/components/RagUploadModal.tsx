import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useRagUpload } from "@/hooks/useRagUpload";
import { cn } from "@/lib/utils";

interface RagUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RagUploadModal({ isOpen, onClose }: RagUploadModalProps) {
  const { t, i18n } = useTranslation("rag");
  const isRtl = i18n.dir() === "rtl";
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

  const handleClose = useCallback(() => {
    setConfirmDelete(false);
    setError(null);
    onClose();
  }, [onClose, setError]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            dir={isRtl ? "rtl" : "ltr"}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE6DD]/60">
              <h2 className="text-lg font-bold text-[#2D2A26]">
                {t("uploadTitle")}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-[#A39B90] hover:text-[#2D2A26] hover:bg-[#EDE6DD]/40 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#FF7E47] animate-spin" />
                </div>
              ) : isUploading || document?.status === "processing" ? (
                /* Uploading / Processing State */
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 className="w-10 h-10 text-[#FF7E47] animate-spin" />
                  <p className="text-sm text-[#7A7267] font-medium">
                    {uploadProgress || t("processingFile")}
                  </p>
                </div>
              ) : document?.status === "ready" ? (
                /* Document Ready State */
                <div className="space-y-4">
                  <div className="bg-[#FAF7F3] rounded-xl p-4 border border-[#EDE6DD]/60">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[#FF7E47]/10 rounded-lg shrink-0">
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
                            {t("fileSize")}:{" "}
                            {formatFileSize(document.file_size)}
                          </span>
                          <span>
                            {t("chunks")}: {document.chunk_count}
                          </span>
                          <span className="col-span-2">
                            {t("uploadDate")}:{" "}
                            {new Date(document.created_at ?? "").toLocaleDateString(
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
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#FF7E47] bg-[#FF7E47]/10 hover:bg-[#FF7E47]/20 transition-colors cursor-pointer"
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
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer",
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
                /* Empty / Error State — show upload zone */
                <div className="space-y-4">
                  <p className="text-sm text-[#7A7267] leading-relaxed">
                    {t("uploadDesc")}
                  </p>

                  {/* Error message */}
                  {(error || document?.status === "error") && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-xs text-red-700">
                        {error ||
                          document?.error_message ||
                          t("errorProcessing")}
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
                      "flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
                      isDragOver
                        ? "border-[#FF7E47] bg-[#FF7E47]/5"
                        : "border-[#EDE6DD] hover:border-[#FF7E47]/40 hover:bg-[#FAF7F3]",
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-full transition-colors",
                        isDragOver
                          ? "bg-[#FF7E47]/15"
                          : "bg-[#EDE6DD]/60",
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
            </div>

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
      )}
    </AnimatePresence>
  );
}
