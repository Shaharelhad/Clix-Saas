import { useState, useEffect } from "react";
import type { FormField, FileUploadItem } from "@/types/form";

const STORAGE_KEY_VALUES = "createBot_formValues";
const STORAGE_KEY_OTHER = "createBot_otherValues";
const STORAGE_KEY_URLS = "createBot_urlEntries";

function loadFromSession<T>(key: string, fallback: T): T {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useFormFields() {
  const [formValues, setFormValues] = useState<Record<string, string | string[] | boolean>>(
    () => loadFromSession(STORAGE_KEY_VALUES, {}),
  );
  const [otherValues, setOtherValues] = useState<Record<string, string>>(
    () => loadFromSession(STORAGE_KEY_OTHER, {}),
  );
  const [urlEntries, setUrlEntries] = useState<Record<string, Array<{ url: string; label: string }>>>(
    () => loadFromSession(STORAGE_KEY_URLS, {}),
  );

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_VALUES, JSON.stringify(formValues));
  }, [formValues]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_OTHER, JSON.stringify(otherValues));
  }, [otherValues]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_URLS, JSON.stringify(urlEntries));
  }, [urlEntries]);

  const setValue = (fieldId: string, value: string | string[] | boolean) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const setOtherValue = (fieldId: string, value: string) => {
    setOtherValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const toggleCheckboxValue = (fieldId: string, option: string) => {
    const current = (formValues[fieldId] as string[]) || [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setValue(fieldId, updated);
  };

  const getUrlEntries = (fieldId: string) =>
    urlEntries[fieldId] ?? [{ url: "", label: "" }];

  const updateUrlEntry = (
    fieldId: string,
    index: number,
    key: "url" | "label",
    value: string,
  ) => {
    setUrlEntries((prev) => {
      const entries = [...(prev[fieldId] ?? [{ url: "", label: "" }])];
      entries[index] = { ...entries[index], [key]: value };
      return { ...prev, [fieldId]: entries };
    });
  };

  const addUrlEntry = (fieldId: string) => {
    setUrlEntries((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] ?? [{ url: "", label: "" }]), { url: "", label: "" }],
    }));
  };

  const removeUrlEntry = (fieldId: string, index: number) => {
    setUrlEntries((prev) => {
      const entries = [...(prev[fieldId] ?? [])];
      entries.splice(index, 1);
      if (entries.length === 0) entries.push({ url: "", label: "" });
      return { ...prev, [fieldId]: entries };
    });
  };

  const resolveFieldValue = (
    field: FormField,
    fileUploads: Record<string, FileUploadItem[]>,
  ): unknown => {
    if (field.field_type === "url") {
      const entries = getUrlEntries(field.id);
      return entries
        .filter((e) => e.url.trim())
        .map((e) => ({ url: e.url, label: e.label || "" }));
    }

    if (field.field_type === "file_upload") {
      return (fileUploads[field.id] ?? [])
        .filter((f) => f.uploaded && f.storedUrl)
        .map((f) => ({
          url: f.storedUrl,
          type: f.fileType,
          category: f.category,
          item_name: f.itemName,
          description: f.description,
          file_name: f.fileName,
        }));
    }

    const raw = formValues[field.id];

    if (field.field_type === "checkbox") {
      return ((raw as string[]) || [])
        .map((v) => (v === "__other__" ? otherValues[field.id] || "" : v))
        .filter(Boolean);
    }

    if (
      (field.field_type === "radio" || field.field_type === "dropdown") &&
      raw === "__other__"
    ) {
      return otherValues[field.id] || "";
    }

    return raw ?? "";
  };

  return {
    formValues,
    setFormValues,
    otherValues,
    urlEntries,
    setUrlEntries,
    setValue,
    setOtherValue,
    toggleCheckboxValue,
    getUrlEntries,
    updateUrlEntry,
    addUrlEntry,
    removeUrlEntry,
    resolveFieldValue,
  };
}
