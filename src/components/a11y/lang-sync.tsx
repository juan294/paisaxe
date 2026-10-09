"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export function LangSync() {
  const { locale, dictionaryLocale } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = dictionaryLocale ?? locale;
  }, [locale, dictionaryLocale]);

  return null;
}
