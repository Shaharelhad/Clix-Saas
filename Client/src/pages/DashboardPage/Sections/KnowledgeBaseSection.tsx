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
  Sheet,
  Link2,
  Clock,
} from "lucide-react";
import { useRagUpload } from "@/hooks/useRagUpload";
import { useGoogleSheet, type SheetSourceConfig } from "@/hooks/useGoogleSheet";
import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/animations";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── File Upload Card ── */

function FileUploadCard() {
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
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 p-6">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-[#FF7E47]" />
        <span className="text-sm font-semibold text-[#2D2A26]">
          {t("uploadTitle")}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#FF7E47] animate-spin" />
        </div>
      ) : isUploading || document?.status === "processing" ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-10 h-10 text-[#FF7E47] animate-spin" />
          <p className="text-sm text-[#7A7267] font-medium">
            {uploadProgress || t("processingFile")}
          </p>
        </div>
      ) : document?.status === "ready" ? (
        <div className="space-y-4">
          <div className="bg-[#FAF7F3] rounded-xl p-4 border border-[#EDE6DD]/60">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#FF7E47]/10 rounded-lg shrink-0">
                <FileText className="w-4 h-4 text-[#FF7E47]" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
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
                    {new Date(document.created_at ?? "").toLocaleDateString(
                      i18n.language === "he" ? "he-IL" : "en-US",
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

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
        <div className="space-y-4">
          {(error || document?.status === "error") && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-700">
                {error || document?.error_message || t("errorProcessing")}
              </span>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  );
}

/* ── Google Sheet Card ── */

function GoogleSheetCard() {
  const { t, i18n } = useTranslation("rag");
  const {
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
  } = useGoogleSheet();

  const [sheetUrl, setSheetUrl] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const handleConnect = useCallback(() => {
    if (!sheetUrl.trim()) return;
    connectSheet(sheetUrl.trim());
  }, [sheetUrl, connectSheet]);

  const handleDisconnect = useCallback(async () => {
    await disconnectSheet();
    setConfirmDisconnect(false);
    setSheetUrl("");
  }, [disconnectSheet]);

  const config = sourceConfig as SheetSourceConfig;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 p-6">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-4">
        <Sheet className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-[#2D2A26]">
          {t("sheetsTitle")}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      ) : isConnecting || sheetDocument?.status === "processing" ? (
        /* Connecting / Processing */
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-sm text-[#7A7267] font-medium">
            {isConnecting ? t("sheetsConnecting") : t("processingFile")}
          </p>
        </div>
      ) : sheetDocument?.status === "ready" ? (
        /* Sheet Connected */
        <div className="space-y-4">
          <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                <Sheet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#2D2A26] truncate">
                    {sheetDocument.file_name}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    <Check className="w-3 h-3" />
                    {t("statusReady")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#7A7267]">
                  <span>
                    {t("sheetsRowCount")}: {config.row_count ?? "—"}
                  </span>
                  <span>
                    {t("chunks")}: {sheetDocument.chunk_count}
                  </span>
                  {config.last_synced_at && (
                    <span className="col-span-2">
                      {t("sheetsLastSync")}:{" "}
                      {new Date(config.last_synced_at).toLocaleString(
                        i18n.language === "he" ? "he-IL" : "en-US",
                        { dateStyle: "short", timeStyle: "short" },
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 mt-1">
                  <Clock className="w-3 h-3" />
                  {t("sheetsAutoSync")}
                </div>
              </div>
            </div>
          </div>

          {/* Sync success message */}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs text-emerald-700">{success}</span>
            </div>
          )}

          {/* Sync info message (no changes) */}
          {error === t("sheetsNoChanges") && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <Check className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs text-blue-700">{error}</span>
            </div>
          )}

          {/* Error message */}
          {error && error !== t("sheetsNoChanges") && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-700">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                syncSheet();
              }}
              disabled={isSyncing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn("w-4 h-4", isSyncing && "animate-spin")}
              />
              {isSyncing ? t("sheetsSyncing") : t("sheetsSync")}
            </button>
            <button
              type="button"
              onClick={() =>
                confirmDisconnect
                  ? handleDisconnect()
                  : setConfirmDisconnect(true)
              }
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                confirmDisconnect
                  ? "text-white bg-red-500 hover:bg-red-600"
                  : "text-red-500 bg-red-50 hover:bg-red-100",
              )}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDisconnect
                ? t("sheetsDisconnectConfirm")
                : t("sheetsDisconnect")}
            </button>
          </div>
        </div>
      ) : (
        /* Empty — show connect form */
        <div className="space-y-4">
          <p className="text-xs text-[#7A7267]">{t("sheetsDesc")}</p>

          {/* Error message */}
          {(error || sheetDocument?.status === "error") && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-700">
                {error || sheetDocument?.error_message || t("sheetsErrorConnect")}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A39B90]" />
              <input
                type="url"
                dir="ltr"
                value={sheetUrl}
                onChange={(e) => {
                  setSheetUrl(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder={t("sheetsPlaceholder")}
                className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-[#EDE6DD] bg-[#FAF7F3] text-sm text-[#2D2A26] placeholder:text-[#A39B90] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={!sheetUrl.trim() || isConnecting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("sheetsConnect")}
            </button>
          </div>

          <p className="text-[10px] text-[#A39B90]">{t("sheetsPublicHint")}</p>
        </div>
      )}
    </div>
  );
}

/* ── Main Section ── */

export default function KnowledgeBaseSection() {
  const { t } = useTranslation("rag");

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <div className="p-2.5 bg-[#FF7E47]/10 rounded-xl">
          <BookOpen className="w-5 h-5 text-[#FF7E47]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#2D2A26]">
            {t("knowledgeBase")}
          </h2>
          <p className="text-sm text-[#7A7267]">{t("uploadDesc")}</p>
        </div>
      </motion.div>

      {/* File Upload */}
      <motion.div variants={fadeUp}>
        <FileUploadCard />
      </motion.div>

      {/* Google Sheets */}
      <motion.div variants={fadeUp}>
        <GoogleSheetCard />
      </motion.div>
    </motion.div>
  );
}
