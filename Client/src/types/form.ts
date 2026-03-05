export interface FormField {
  id: string;
  field_type: string;
  label: string;
  placeholder: string;
  description: string;
  is_required: boolean;
  sort_order: number;
  options: string[];
  allow_other: boolean;
}

export interface FormSettings {
  opening_title: string;
  opening_text: string;
  closing_title: string;
  closing_text: string;
}

export interface FileUploadItem {
  id: string;
  file: File | null;
  previewUrl: string;
  storedUrl: string;
  uploading: boolean;
  uploaded: boolean;
  error: string;
  category: string;
  itemName: string;
  description: string;
  fileType: "image" | "video";
  fileName: string;
}
