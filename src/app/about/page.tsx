import Link from "next/link";
import { ArrowLeft, Mountain, Eye, BookOpen, Cpu, Mail } from "lucide-react";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { es } from "@/lib/i18n/es";

const t = (key: string) => resolveTranslation(key, es);

export default function AboutPage() {

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            aria-label={t("about.back")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
            <Mountain className="h-7 w-7 text-white/70" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">
            {t("about.title")}
          </h1>
          <p className="text-lg text-neutral-400 italic">
            {t("about.tagline")}
          </p>
        </div>

        <div className="space-y-12">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                <Eye className="h-4 w-4 text-neutral-400" />
              </div>
              <h2 className="text-lg font-medium text-white">
                {t("about.what_title")}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("about.what_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                <Mountain className="h-4 w-4 text-neutral-400" />
              </div>
              <h2 className="text-lg font-medium text-white">
                {t("about.vision_title")}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("about.vision_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                <BookOpen className="h-4 w-4 text-neutral-400" />
              </div>
              <h2 className="text-lg font-medium text-white">
                {t("about.content_title")}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("about.content_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                <Cpu className="h-4 w-4 text-neutral-400" />
              </div>
              <h2 className="text-lg font-medium text-white">
                {t("about.ai_title")}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-neutral-400">
              {t("about.ai_description")}
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                <Mail className="h-4 w-4 text-neutral-400" />
              </div>
              <h2 className="text-lg font-medium text-white">
                {t("about.contact_title")}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-neutral-400 mb-3">
              {t("about.contact_description")}
            </p>
            <a
              href="mailto:support@paisaxe.es"
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              support@paisaxe.es
            </a>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-center gap-4 text-xs text-neutral-500">
          <Link
            href="/terms"
            className="hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {t("footer.terms")}
          </Link>
          <span className="text-neutral-700" aria-hidden="true">
            &middot;
          </span>
          <Link
            href="/privacy"
            className="hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {t("footer.privacy")}
          </Link>
        </div>
      </main>
    </div>
  );
}
