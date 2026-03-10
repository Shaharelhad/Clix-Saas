import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import type { FormField, FormSettings } from "@/types/form";

interface FormFieldRow {
  id: string;
  field_type: string;
  label: string;
  placeholder: string;
  description: string;
  is_required: boolean;
  sort_order: number;
  options: string[] | unknown;
  allow_other: boolean;
}

interface FormSettingsRow {
  opening_title?: string;
  opening_text?: string;
  closing_title?: string;
  closing_text?: string;
}

/** Shared hook: fetch form fields from admin_list_form_fields RPC */
export function useFormFieldsQuery() {
  return useQuery({
    queryKey: ["form_fields"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_form_fields");
      if (error) throw error;
      return ((data as FormFieldRow[]) ?? []).map((f) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      })) as FormField[];
    },
  });
}

/** Shared hook: fetch form settings from admin_get_form_settings RPC */
export function useFormSettingsQuery() {
  return useQuery({
    queryKey: ["form_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_form_settings");
      if (error) throw error;
      const rows = data as FormSettingsRow[] | null;
      const row = rows?.[0];
      if (row) {
        return {
          opening_title: row.opening_title ?? "",
          opening_text: row.opening_text ?? "",
          closing_title: row.closing_title ?? "",
          closing_text: row.closing_text ?? "",
        } as FormSettings;
      }
      return null;
    },
  });
}
