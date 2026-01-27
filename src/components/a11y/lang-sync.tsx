"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export function LangSync() {
  const { locale } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
