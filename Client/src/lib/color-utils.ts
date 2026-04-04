/**
 * Derives CSS custom property values from a single primary hex color.
 * Used by the tenant theming system to generate all brand color variants.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function deriveBrandColors(primaryHex: string, hoverHex?: string) {
  const hsl = hexToHsl(primaryHex);
  const rgb = hexToRgb(primaryHex);
  if (!hsl || !rgb) {
    return {
      primary: primaryHex,
      hover: hoverHex || primaryHex,
      light: primaryHex,
      lighter: primaryHex,
      rgb: "255, 107, 44",
    };
  }

  return {
    primary: primaryHex,
    hover: hoverHex || hslToHex(hsl.h, Math.min(hsl.s + 10, 100), Math.max(hsl.l - 8, 10)),
    light: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 8, 90)),
    lighter: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 15, 90)),
    rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
  };
}

export function applyBrandColors(primaryHex: string, hoverHex?: string) {
  const colors = deriveBrandColors(primaryHex, hoverHex);
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", colors.primary);
  root.style.setProperty("--brand-primary-hover", colors.hover);
  root.style.setProperty("--brand-primary-light", colors.light);
  root.style.setProperty("--brand-primary-lighter", colors.lighter);
  root.style.setProperty("--brand-primary-rgb", colors.rgb);
}
