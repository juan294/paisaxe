import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidad | Paisaxe",
  description: "Política de privacidad de Paisaxe",
};

export default function PrivacyPage() {
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
            <Shield className="h-7 w-7 text-white/70" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">
            Política de Privacidad
          </h1>
          <p className="text-sm text-neutral-500">
            Última actualización: 5 de febrero de 2026
          </p>
        </div>

        <div className="space-y-8">
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <p className="text-sm leading-relaxed text-neutral-400">
              En Paisaxe, respetamos tu privacidad y nos comprometemos a proteger
              tus datos personales. Esta política explica qué información
              recopilamos, cómo la usamos y cuáles son tus derechos.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              1. Información que recopilamos
            </h2>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Datos de cuenta</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              Cuando inicias sesión con Google, recopilamos tu dirección de correo
              electrónico para crear y gestionar tu cuenta.
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Datos de reservas (VoicePass)</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">
              Si utilizas nuestro servicio de voz para hacer reservas, recopilamos:
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1 mb-4">
              <li>Nombre</li>
              <li>Número de teléfono</li>
              <li>Detalles de la reserva (fecha, hora, número de personas)</li>
            </ul>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Datos de pago</h3>
            <p className="text-sm leading-relaxed text-neutral-400 mb-4">
              Los pagos se procesan a través de Stripe. No almacenamos datos de
              tarjetas de crédito en nuestros servidores. Stripe gestiona esta
              información de forma segura según sus propias políticas de privacidad.
            </p>

            <h3 className="text-sm font-medium text-neutral-300 mb-2">Datos de uso</h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              Recopilamos información sobre cómo interactúas con nuestro servicio
              para mejorar la experiencia, incluyendo conversaciones con nuestro
              asistente de IA.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              2. Cómo usamos tu información
            </h2>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>Proporcionar y mantener nuestros servicios</li>
              <li>Procesar reservas y pagos</li>
              <li>Enviarte confirmaciones por SMS</li>
              <li>Mejorar nuestros servicios de IA</li>
              <li>Comunicarnos contigo sobre tu cuenta</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              3. Servicios de terceros
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-3">
              Utilizamos los siguientes proveedores para operar nuestro servicio:
            </p>
            <ul className="text-sm text-neutral-400 space-y-2">
              <li><strong className="text-neutral-300">Supabase</strong> — Base de datos y autenticación</li>
              <li><strong className="text-neutral-300">Google</strong> — Inicio de sesión (OAuth)</li>
              <li><strong className="text-neutral-300">Stripe</strong> — Procesamiento de pagos</li>
              <li><strong className="text-neutral-300">Anthropic (Claude)</strong> — Asistente de IA para chat</li>
              <li><strong className="text-neutral-300">ElevenLabs</strong> — Guía de voz</li>
              <li><strong className="text-neutral-300">Twilio</strong> — Envío de SMS</li>
            </ul>
            <p className="text-sm leading-relaxed text-neutral-400 mt-3">
              Cada uno de estos servicios tiene sus propias políticas de privacidad
              que te recomendamos revisar.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              4. Cookies
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Usamos cookies esenciales para mantener tu sesión iniciada. No
              utilizamos cookies de seguimiento publicitario.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              5. Retención de datos
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Conservamos tus datos mientras mantengas una cuenta activa. Puedes
              solicitar la eliminación de tus datos en cualquier momento.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              6. Tus derechos
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400 mb-2">Tienes derecho a:</p>
            <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
              <li>Acceder a tus datos personales</li>
              <li>Rectificar datos incorrectos</li>
              <li>Solicitar la eliminación de tus datos</li>
              <li>Oponerte al procesamiento de tus datos</li>
              <li>Portar tus datos a otro servicio</li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              7. Seguridad
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Implementamos medidas de seguridad técnicas y organizativas para
              proteger tus datos, incluyendo cifrado en tránsito (HTTPS) y en
              reposo.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              8. Cambios a esta política
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Podemos actualizar esta política ocasionalmente. Te notificaremos de
              cambios significativos por correo electrónico o mediante un aviso en
              nuestro sitio.
            </p>
          </section>

          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="text-lg font-medium text-white mb-4">
              9. Contacto
            </h2>
            <p className="text-sm leading-relaxed text-neutral-400">
              Para cualquier consulta sobre privacidad, contacta con nosotros en:{" "}
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
            Términos de servicio
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
