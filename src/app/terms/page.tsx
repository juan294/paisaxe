"use client";

import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            aria-label={t("terms.back")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
            <ScrollText className="h-7 w-7 text-white/70" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">
            {t("terms.title")}
          </h1>
          <p className="text-sm text-neutral-500">
            {t("terms.last_updated")}
          </p>
        </div>

        <div className="space-y-8">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.intro")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section1_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              {t("terms.service_intro")}
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>{t("terms.service_chat")}</li>
              <li>{t("terms.service_voice")}</li>
              <li>{t("terms.service_content")}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section2_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">{t("terms.usage_intro")}</p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>{t("terms.usage_truthful")}</li>
              <li>{t("terms.usage_legal")}</li>
              <li>{t("terms.usage_restricted")}</li>
              <li>{t("terms.usage_respect")}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section3_title")}
            </h2>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("terms.pricing_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              {t("terms.pricing_description")}
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("terms.payment_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              {t("terms.payment_description")}
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("terms.refund_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.refund_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section4_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              {t("terms.ai_intro")}
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>{t("terms.ai_orientative")}</li>
              <li>{t("terms.ai_verify")}</li>
              <li>{t("terms.ai_responsibility")}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section5_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              {t("terms.bookings_intro")}
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>{t("terms.bookings_cancellations")}</li>
              <li>{t("terms.bookings_availability")}</li>
              <li>{t("terms.bookings_quality")}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section6_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.ip_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section7_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.liability_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section8_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.modifications_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section9_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.law_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("terms.section10_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("terms.contact_description")}{" "}
              <a
                href="mailto:support@paisaxe.es"
                className="text-white/70 hover:text-white transition-colors underline underline-offset-4"
              >
                support@paisaxe.es
              </a>
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-center gap-4 text-xs text-neutral-500">
          <Link href="/privacy" className="hover:text-neutral-300 transition-colors">
            {t("terms.footer_privacy")}
          </Link>
          <span className="text-neutral-700" aria-hidden="true">&middot;</span>
          <Link href="/about" className="hover:text-neutral-300 transition-colors">
            {t("terms.footer_about")}
          </Link>
        </div>
      </main>
    </div>
  );
}
