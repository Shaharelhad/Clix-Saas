import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import he from "./locales/he";
import en from "./locales/en";

const ns = [
  "common",
  "landing",
  "auth",
  "createBot",
  "businessContent",
  "settings",
  "connect",
  "preview",
  "faq",
  "sidebar",
  "admin",
  "pending",
  "flow",
  "notFound",
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      he: { ...he },
      en: { ...en },
    },
    ns,
    defaultNS: "common",
    fallbackLng: "he",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "clix_language",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
