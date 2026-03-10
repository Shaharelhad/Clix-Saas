/**
 * Shared form-related constants used across CreateBotPage, DashboardPage, and FormFieldRenderer.
 */

/** Tailwind utility classes for rendering sanitized HTML (rich text) with correct list and paragraph styling. */
export const RICH_TEXT_CLASS =
  "[&_p]:m-0 [&_ol]:list-decimal [&_ol]:pr-5 [&_ol]:space-y-0.5 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-0.5 [&_li]:pr-1";

/** Standard category options for file upload fields. Requires i18n `t` from `common` namespace. */
export const FILE_CATEGORY_KEYS = [
  { value: "product", labelKey: "common:categoryProduct" },
  { value: "service", labelKey: "common:categoryService" },
  { value: "portfolio", labelKey: "common:categoryPortfolio" },
  { value: "team", labelKey: "common:categoryTeam" },
  { value: "logo", labelKey: "common:categoryLogo" },
  { value: "general", labelKey: "common:categoryGeneral" },
] as const;

/** Build translated fileCategoryOptions from a translation function. */
export function buildFileCategoryOptions(t: (key: string) => string) {
  return FILE_CATEGORY_KEYS.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey),
  }));
}
