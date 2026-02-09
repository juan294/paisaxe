import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio | Paisaxe",
  description: "Términos y condiciones de uso de Paisaxe",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <article className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Términos de Servicio</h1>
        <p className="text-muted-foreground">
          Última actualización: 5 de febrero de 2026
        </p>

        <p>
          Bienvenido a Paisaxe. Al usar nuestro sitio web y servicios, aceptas
          estos términos. Por favor, léelos con atención.
        </p>

        <h2>1. Descripción del servicio</h2>
        <p>
          Paisaxe es una plataforma de turismo que ofrece información sobre
          Asturias, España, a través de:
        </p>
        <ul>
          <li>Un asistente de chat con inteligencia artificial</li>
          <li>
            Un guía de voz (Pelayo) disponible mediante VoicePass de pago
          </li>
          <li>Contenido editorial sobre destinos, gastronomía y cultura</li>
        </ul>

        <h2>2. Uso del servicio</h2>
        <p>Al usar Paisaxe, te comprometes a:</p>
        <ul>
          <li>Proporcionar información veraz</li>
          <li>No usar el servicio para fines ilegales</li>
          <li>No intentar acceder a áreas restringidas del sistema</li>
          <li>Respetar a otros usuarios y al personal de Paisaxe</li>
        </ul>

        <h2>3. VoicePass y pagos</h2>
        <h3>Precio y duración</h3>
        <p>
          El VoicePass de 24 horas cuesta 1,99 € y te da acceso ilimitado a
          Pelayo, nuestro guía de voz, durante ese período.
        </p>

        <h3>Procesamiento de pagos</h3>
        <p>
          Los pagos se procesan de forma segura a través de Stripe. Al realizar
          una compra, aceptas también los términos de servicio de Stripe.
        </p>

        <h3>Reembolsos</h3>
        <p>
          Dado que el VoicePass proporciona acceso inmediato a un servicio
          digital, no ofrecemos reembolsos una vez activado. Si experimentas
          problemas técnicos que impidan usar el servicio, contacta con nosotros
          para buscar una solución.
        </p>

        <h2>4. Contenido generado por IA</h2>
        <p>
          Nuestros asistentes de chat y voz utilizan inteligencia artificial.
          Ten en cuenta que:
        </p>
        <ul>
          <li>
            La información proporcionada es orientativa y puede contener errores
          </li>
          <li>
            Debes verificar información crítica (horarios, precios, reservas)
            directamente con los establecimientos
          </li>
          <li>
            No nos hacemos responsables de decisiones tomadas basándose
            únicamente en las respuestas de la IA
          </li>
        </ul>

        <h2>5. Reservas</h2>
        <p>
          Cuando Pelayo realiza una reserva en tu nombre, actúa como
          intermediario. La reserva final está sujeta a la confirmación del
          establecimiento. Paisaxe no es responsable de:
        </p>
        <ul>
          <li>Cancelaciones por parte del establecimiento</li>
          <li>Cambios en disponibilidad o precios</li>
          <li>La calidad del servicio del establecimiento</li>
        </ul>

        <h2>6. Propiedad intelectual</h2>
        <p>
          Todo el contenido de Paisaxe (textos, imágenes, diseño, código) es
          propiedad de Paisaxe o sus licenciantes. No está permitido copiar,
          modificar o distribuir este contenido sin autorización.
        </p>

        <h2>7. Limitación de responsabilidad</h2>
        <p>
          Paisaxe se proporciona &quot;tal cual&quot;. No garantizamos que el
          servicio esté libre de errores o interrupciones. En la medida
          permitida por la ley, no seremos responsables de daños indirectos,
          incidentales o consecuentes.
        </p>

        <h2>8. Modificaciones</h2>
        <p>
          Nos reservamos el derecho de modificar estos términos. Los cambios
          entrarán en vigor cuando se publiquen en esta página. El uso
          continuado del servicio implica la aceptación de los nuevos términos.
        </p>

        <h2>9. Legislación aplicable</h2>
        <p>
          Estos términos se rigen por la legislación española. Cualquier
          disputa se someterá a los tribunales de Asturias, España.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta sobre estos términos, contacta con nosotros
          en:{" "}
          <a href="mailto:support@paisaxe.es">
            support@paisaxe.es
          </a>
        </p>
      </article>
    </main>
  );
}
