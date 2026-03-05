import { useRef, useCallback } from "react";
import { Upload, Loader2, X, Film } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FileUploadItem } from "@/types/form";

interface FileUploadZoneProps {
  uploads: FileUploadItem[];
  fileCategoryOptions: { value: string; label: string }[];
  onFileInputRef: (el: HTMLInputElement | null) => void;
  onFileSelect: (files: FileList | null) => void;
  onRemove: (itemId: string) => void;
  onUpdateMetadata: (
    itemId: string,
    key: "category" | "itemName" | "description",
    value: string,
  ) => void;
}

const inputClass =
  "w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200";

export function FileUploadZone({
  uploads,
  fileCategoryOptions,
  onFileInputRef,
  onFileSelect,
  onRemove,
  onUpdateMetadata,
}: FileUploadZoneProps) {
  const { t } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      onFileInputRef(el);
    },
    [onFileInputRef],
  );
  const isAnyUploading = uploads.some((f) => f.uploading);

  const getItemNameLabel = (category: string) => {
    switch (category) {
      case "product":
        return t("productName");
      case "service":
        return t("serviceName");
      case "portfolio":
        return t("portfolioName");
      case "team":
        return t("teamMemberName");
      case "logo":
        return t("brandName");
      default:
        return t("itemName");
    }
  };

  const getItemNamePlaceholder = (category: string) => {
    switch (category) {
      case "product":
        return t("productPlaceholder");
      case "service":
        return t("servicePlaceholder");
      case "portfolio":
        return t("portfolioPlaceholder");
      case "team":
        return t("teamPlaceholder");
      case "logo":
        return t("logoPlaceholder");
      default:
        return t("itemNamePlaceholder");
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
          "border-[#E5DDD3] hover:border-[#FF7E47]/40 hover:bg-[#FF7E47]/[0.03]",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={setInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => onFileSelect(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          {isAnyUploading ? (
            <Loader2 className="w-6 h-6 text-[#FF7E47] animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-[#B8AFA4]" />
          )}
          <span className="text-sm text-[#7A7267]">
            {isAnyUploading ? t("uploadingFiles") : t("clickToUpload")}
          </span>
          <span className="text-xs text-[#B8AFA4]">{t("uploadMultiple")}</span>
        </div>
      </div>

      {/* Uploaded files list */}
      {uploads.length > 0 && (
        <div className="space-y-4">
          {uploads.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 bg-[#FAF7F3] rounded-xl border border-[#EDE6DD]/50 space-y-3"
            >
              {/* Top row: preview + file name + status + remove */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#EDE6DD]/30 flex-shrink-0 flex items-center justify-center border border-[#EDE6DD]/50">
                  {item.fileType === "video" ? (
                    <Film className="w-6 h-6 text-[#B8AFA4]" />
                  ) : (
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#2D2A26]">
                      {t("file")} {idx + 1}
                    </span>
                    {item.uploading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF7E47]" />
                    )}
                    {item.uploaded && (
                      <span className="text-xs text-emerald-500 font-medium">
                        {t("uploadedSuccess")}
                      </span>
                    )}
                    {item.error && (
                      <span className="text-xs text-red-500">{item.error}</span>
                    )}
                  </div>
                  <span className="text-xs text-[#A39B90] truncate block">
                    {item.fileName}
                  </span>
                </div>
                <button
                  type="button"
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-[#B8AFA4] hover:text-red-400 hover:bg-red-50 transition-colors"
                  onClick={() => onRemove(item.id)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Category select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#7A7267]">
                  {t("fileTypeQuestion")}
                </label>
                <select
                  value={item.category}
                  onChange={(e) =>
                    onUpdateMetadata(item.id, "category", e.target.value)
                  }
                  className={cn(inputClass, "h-10")}
                >
                  <option value="">{t("selectCategory")}</option>
                  {fileCategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#7A7267]">
                  {getItemNameLabel(item.category)}
                </label>
                <input
                  placeholder={getItemNamePlaceholder(item.category)}
                  value={item.itemName}
                  onChange={(e) =>
                    onUpdateMetadata(item.id, "itemName", e.target.value)
                  }
                  className={cn(inputClass, "h-10")}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#7A7267]">
                  {t("descriptionOptional")}
                </label>
                <textarea
                  placeholder={t("descriptionPlaceholder")}
                  value={item.description}
                  onChange={(e) =>
                    onUpdateMetadata(item.id, "description", e.target.value)
                  }
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
