import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Paisaxe",
  description: "Política de privacidad de Paisaxe",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <article className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Política de Privacidad</h1>
        <p className="text-muted-foreground">
          Última actualización: 5 de febrero de 2026
        </p>

        <p>
          En Paisaxe, respetamos tu privacidad y nos comprometemos a proteger
          tus datos personales. Esta política explica qué información
          recopilamos, cómo la usamos y cuáles son tus derechos.
        </p>

        <h2>1. Información que recopilamos</h2>

        <h3>Datos de cuenta</h3>
        <p>
          Cuando inicias sesión con Google, recopilamos tu dirección de correo
          electrónico para crear y gestionar tu cuenta.
        </p>

        <h3>Datos de reservas (VoicePass)</h3>
        <p>
          Si utilizas nuestro servicio de voz para hacer reservas, recopilamos:
        </p>
        <ul>
          <li>Nombre</li>
          <li>Número de teléfono</li>
          <li>Detalles de la reserva (fecha, hora, número de personas)</li>
        </ul>

        <h3>Datos de pago</h3>
        <p>
          Los pagos se procesan a través de Stripe. No almacenamos datos de
          tarjetas de crédito en nuestros servidores. Stripe gestiona esta
          información de forma segura según sus propias políticas de privacidad.
        </p>

        <h3>Datos de uso</h3>
        <p>
          Recopilamos información sobre cómo interactúas con nuestro servicio
          para mejorar la experiencia, incluyendo conversaciones con nuestro
          asistente de IA.
        </p>

        <h2>2. Cómo usamos tu información</h2>
        <ul>
          <li>Proporcionar y mantener nuestros servicios</li>
          <li>Procesar reservas y pagos</li>
          <li>Enviarte confirmaciones por SMS</li>
          <li>Mejorar nuestros servicios de IA</li>
          <li>Comunicarnos contigo sobre tu cuenta</li>
        </ul>

        <h2>3. Servicios de terceros</h2>
        <p>Utilizamos los siguientes proveedores para operar nuestro servicio:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — Base de datos y autenticación
          </li>
          <li>
            <strong>Google</strong> — Inicio de sesión (OAuth)
          </li>
          <li>
            <strong>Stripe</strong> — Procesamiento de pagos
          </li>
          <li>
            <strong>Anthropic (Claude)</strong> — Asistente de IA para chat
          </li>
          <li>
            <strong>ElevenLabs</strong> — Guía de voz
          </li>
          <li>
            <strong>Twilio</strong> — Envío de SMS
          </li>
        </ul>
        <p>
          Cada uno de estos servicios tiene sus propias políticas de privacidad
          que te recomendamos revisar.
        </p>

        <h2>4. Cookies</h2>
        <p>
          Usamos cookies esenciales para mantener tu sesión iniciada. No
          utilizamos cookies de seguimiento publicitario.
        </p>

        <h2>5. Retención de datos</h2>
        <p>
          Conservamos tus datos mientras mantengas una cuenta activa. Puedes
          solicitar la eliminación de tus datos en cualquier momento.
        </p>

        <h2>6. Tus derechos</h2>
        <p>Tienes derecho a:</p>
        <ul>
          <li>Acceder a tus datos personales</li>
          <li>Rectificar datos incorrectos</li>
          <li>Solicitar la eliminación de tus datos</li>
          <li>Oponerte al procesamiento de tus datos</li>
          <li>Portar tus datos a otro servicio</li>
        </ul>

        <h2>7. Seguridad</h2>
        <p>
          Implementamos medidas de seguridad técnicas y organizativas para
          proteger tus datos, incluyendo cifrado en tránsito (HTTPS) y en
          reposo.
        </p>

        <h2>8. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta política ocasionalmente. Te notificaremos de
          cambios significativos por correo electrónico o mediante un aviso en
          nuestro sitio.
        </p>

        <h2>9. Contacto</h2>
        <p>
          Para cualquier consulta sobre privacidad, contacta con nosotros en:{" "}
          <a href="mailto:support@paisaxe.es">
            support@paisaxe.es
          </a>
        </p>
      </article>
    </main>
  );
}
