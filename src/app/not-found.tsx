"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center">
      <h1 className="text-6xl font-bold text-white">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-white">
        {t("errors.not_found_title")}
      </h2>
      <p className="mt-4 max-w-md text-white/70">
        {t("errors.not_found_description")}
      </p>
      <Link
        href="/"
        className="mt-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors"
      >
        {t("errors.go_home")}
      </Link>
    </div>
  );
}
