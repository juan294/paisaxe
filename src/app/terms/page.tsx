import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos de Servicio | Paisaxe",
  description: "Términos y condiciones de uso de Paisaxe",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/immersive"
            aria-label="Volver"
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
            Términos de Servicio
          </h1>
          <p className="text-sm text-neutral-500">
            Última actualización: 5 de febrero de 2026
          </p>
        </div>

        <div className="space-y-8">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <p className="text-sm leading-relaxed text-neutral-400">
              Bienvenido a Paisaxe. Al usar nuestro sitio web y servicios, aceptas
              estos términos. Por favor, léelos con atención.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              1. Descripción del servicio
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              Paisaxe es una plataforma de turismo que ofrece información sobre
              Asturias, España, a través de:
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>Un asistente de chat con inteligencia artificial</li>
              <li>Un guía de voz (Pelayo) disponible mediante VoicePass de pago</li>
              <li>Contenido editorial sobre destinos, gastronomía y cultura</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              2. Uso del servicio
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">Al usar Paisaxe, te comprometes a:</p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>Proporcionar información veraz</li>
              <li>No usar el servicio para fines ilegales</li>
              <li>No intentar acceder a áreas restringidas del sistema</li>
              <li>Respetar a otros usuarios y al personal de Paisaxe</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              3. VoicePass y pagos
            </h2>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Precio y duración</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              El VoicePass de 24 horas cuesta 1,99 € y te da acceso ilimitado a
              Pelayo, nuestro guía de voz, durante ese período.
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Procesamiento de pagos</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              Los pagos se procesan de forma segura a través de Stripe. Al realizar
              una compra, aceptas también los términos de servicio de Stripe.
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Reembolsos</h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              Dado que el VoicePass proporciona acceso inmediato a un servicio
              digital, no ofrecemos reembolsos una vez activado. Si experimentas
              problemas técnicos que impidan usar el servicio, contacta con nosotros
              para buscar una solución.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              4. Contenido generado por IA
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              Nuestros asistentes de chat y voz utilizan inteligencia artificial.
              Ten en cuenta que:
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>La información proporcionada es orientativa y puede contener errores</li>
              <li>Debes verificar información crítica (horarios, precios, reservas) directamente con los establecimientos</li>
              <li>No nos hacemos responsables de decisiones tomadas basándose únicamente en las respuestas de la IA</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              5. Reservas
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              Cuando Pelayo realiza una reserva en tu nombre, actúa como
              intermediario. La reserva final está sujeta a la confirmación del
              establecimiento. Paisaxe no es responsable de:
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>Cancelaciones por parte del establecimiento</li>
              <li>Cambios en disponibilidad o precios</li>
              <li>La calidad del servicio del establecimiento</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              6. Propiedad intelectual
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Todo el contenido de Paisaxe (textos, imágenes, diseño, código) es
              propiedad de Paisaxe o sus licenciantes. No está permitido copiar,
              modificar o distribuir este contenido sin autorización.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              7. Limitación de responsabilidad
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Paisaxe se proporciona &quot;tal cual&quot;. No garantizamos que el
              servicio esté libre de errores o interrupciones. En la medida
              permitida por la ley, no seremos responsables de daños indirectos,
              incidentales o consecuentes.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              8. Modificaciones
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Nos reservamos el derecho de modificar estos términos. Los cambios
              entrarán en vigor cuando se publiquen en esta página. El uso
              continuado del servicio implica la aceptación de los nuevos términos.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              9. Legislación aplicable
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Estos términos se rigen por la legislación española. Cualquier
              disputa se someterá a los tribunales de Asturias, España.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              10. Contacto
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Para cualquier consulta sobre estos términos, contacta con nosotros
              en:{" "}
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
            Privacidad
          </Link>
          <span className="text-neutral-700" aria-hidden="true">&middot;</span>
          <Link href="/about" className="hover:text-neutral-300 transition-colors">
            Sobre Paisaxe
          </Link>
        </div>
      </main>
    </div>
  );
}
