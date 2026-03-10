import { useState, useEffect } from "react";
import type { FormField, FileUploadItem } from "@/types/form";
import { parseListItems } from "@/components/form/FormFieldRenderer";

const STORAGE_KEY_VALUES = "createBot_formValues";
const STORAGE_KEY_OTHER = "createBot_otherValues";
const STORAGE_KEY_URLS = "createBot_urlEntries";
const STORAGE_KEY_QA = "createBot_qaEntries";
const STORAGE_KEY_RULES = "createBot_rulesEntries";

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
  const [qaEntries, setQaEntries] = useState<Record<string, Array<{ question: string; answer: string }>>>(
    () => loadFromSession(STORAGE_KEY_QA, {}),
  );
  const [rulesEntries, setRulesEntries] = useState<Record<string, string[][]>>(
    () => loadFromSession(STORAGE_KEY_RULES, {}),
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

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_QA, JSON.stringify(qaEntries));
  }, [qaEntries]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rulesEntries));
  }, [rulesEntries]);

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

  const getQaEntries = (fieldId: string) =>
    qaEntries[fieldId] ?? [{ question: "", answer: "" }];

  const updateQaEntry = (
    fieldId: string,
    index: number,
    key: "question" | "answer",
    value: string,
  ) => {
    setQaEntries((prev) => {
      const entries = [...(prev[fieldId] ?? [{ question: "", answer: "" }])];
      entries[index] = { ...entries[index], [key]: value };
      return { ...prev, [fieldId]: entries };
    });
  };

  const addQaEntry = (fieldId: string) => {
    setQaEntries((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] ?? [{ question: "", answer: "" }]), { question: "", answer: "" }],
    }));
  };

  const removeQaEntry = (fieldId: string, index: number) => {
    setQaEntries((prev) => {
      const entries = [...(prev[fieldId] ?? [])];
      entries.splice(index, 1);
      if (entries.length === 0) entries.push({ question: "", answer: "" });
      return { ...prev, [fieldId]: entries };
    });
  };

  const ensureRulesInit = (prev: Record<string, string[][]>, fieldId: string, minCats: number): string[][] => {
    const existing = prev[fieldId];
    if (existing && existing.length >= minCats) return existing.map((cat) => [...cat]);
    // Initialize or extend to the needed number of categories
    const result = Array.from({ length: minCats }, (_, i) => [...(existing?.[i] ?? [""])]);
    return result;
  };

  const getRulesEntries = (fieldId: string, categoryCount: number): string[][] => {
    const existing = rulesEntries[fieldId];
    if (existing && existing.length === categoryCount) return existing;
    // Return a fresh initial value for rendering (no setState during render)
    return Array.from({ length: categoryCount }, (_, i) => [...(existing?.[i] ?? [""])]);
  };

  const updateRulesItem = (fieldId: string, catIdx: number, itemIdx: number, value: string) => {
    setRulesEntries((prev) => {
      const cats = ensureRulesInit(prev, fieldId, catIdx + 1);
      cats[catIdx][itemIdx] = value;
      return { ...prev, [fieldId]: cats };
    });
  };

  const addRulesItem = (fieldId: string, catIdx: number) => {
    setRulesEntries((prev) => {
      const cats = ensureRulesInit(prev, fieldId, catIdx + 1);
      cats[catIdx].push("");
      return { ...prev, [fieldId]: cats };
    });
  };

  const removeRulesItem = (fieldId: string, catIdx: number, itemIdx: number) => {
    setRulesEntries((prev) => {
      const cats = ensureRulesInit(prev, fieldId, catIdx + 1);
      cats[catIdx].splice(itemIdx, 1);
      // Keep at least one empty string per category
      if (cats[catIdx].length === 0) cats[catIdx].push("");
      return { ...prev, [fieldId]: cats };
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

    if (field.field_type === "qa_pairs") {
      const entries = getQaEntries(field.id);
      return entries
        .filter((e) => e.question.trim())
        .map((e) => `Q: ${e.question}${e.answer.trim() ? `\nA: ${e.answer}` : ""}`)
        .join("\n\n");
    }

    if (field.field_type === "rules_list") {
      const categories = parseListItems(field.description);
      const entries = getRulesEntries(field.id, categories.length);
      return categories
        .map((label, i) => {
          const items = (entries[i] ?? []).filter((v) => v.trim());
          if (items.length === 0) return "";
          return `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`;
        })
        .filter(Boolean)
        .join("\n\n");
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
    getQaEntries,
    updateQaEntry,
    addQaEntry,
    removeQaEntry,
    getRulesEntries,
    updateRulesItem,
    addRulesItem,
    removeRulesItem,
    resolveFieldValue,
  };
}
