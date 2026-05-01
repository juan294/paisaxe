import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { es } from "@/lib/i18n/es";

const t = (key: string) => resolveTranslation(key, es);

export default function PrivacyPage() {

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            aria-label={t("privacy.back")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
            <Shield className="h-7 w-7 text-white/70" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">
            {t("privacy.title")}
          </h1>
          <p className="text-sm text-neutral-500">
            {t("privacy.last_updated")}
          </p>
        </div>

        <div className="space-y-8">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.intro")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section1_title")}
            </h2>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("privacy.account_data_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              {t("privacy.account_data_description")}
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("privacy.booking_data_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              {t("privacy.booking_data_description")}
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1 mb-4">
              <li>{t("privacy.booking_data_name")}</li>
              <li>{t("privacy.booking_data_phone")}</li>
              <li>{t("privacy.booking_data_details")}</li>
            </ul>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("privacy.payment_data_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              {t("privacy.payment_data_description")}
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">{t("privacy.usage_data_title")}</h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.usage_data_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section2_title")}
            </h2>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>{t("privacy.usage_provide")}</li>
              <li>{t("privacy.usage_bookings")}</li>
              <li>{t("privacy.usage_sms")}</li>
              <li>{t("privacy.usage_ai")}</li>
              <li>{t("privacy.usage_communicate")}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section3_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-3">
              {t("privacy.third_party_intro")}
            </p>
            <ul className="text-sm text-neutral-400 space-y-2">
              <li><strong className="text-neutral-300">Supabase</strong> — {t("privacy.third_party_supabase")}</li>
              <li><strong className="text-neutral-300">Google</strong> — {t("privacy.third_party_google")}</li>
              <li><strong className="text-neutral-300">Stripe</strong> — {t("privacy.third_party_stripe")}</li>
              <li><strong className="text-neutral-300">Anthropic (Claude)</strong> — {t("privacy.third_party_anthropic")}</li>
              <li><strong className="text-neutral-300">ElevenLabs</strong> — {t("privacy.third_party_elevenlabs")}</li>
              <li><strong className="text-neutral-300">Twilio</strong> — {t("privacy.third_party_twilio")}</li>
            </ul>
            <p className="text-sm leading-relaxed text-neutral-400 mt-3">
              {t("privacy.third_party_note")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section4_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.cookies_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section5_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.retention_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section6_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">{t("privacy.rights_intro")}</p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>{t("privacy.rights_access")}</li>
              <li>{t("privacy.rights_rectify")}</li>
              <li>{t("privacy.rights_delete")}</li>
              <li>{t("privacy.rights_object")}</li>
              <li>{t("privacy.rights_portability")}</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section7_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.security_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section8_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.changes_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              {t("privacy.section9_title")}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("privacy.contact_description")}{" "}
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
          <Link href="/terms" className="hover:text-neutral-300 transition-colors">
            {t("privacy.footer_terms")}
          </Link>
          <span className="text-neutral-700" aria-hidden="true">&middot;</span>
          <Link href="/about" className="hover:text-neutral-300 transition-colors">
            {t("privacy.footer_about")}
          </Link>
        </div>
      </main>
    </div>
  );
}
