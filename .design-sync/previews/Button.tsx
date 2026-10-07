import { Button } from "paisaxe";
import { ArrowRight, Shuffle } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3 p-6 bg-white">
    <Button>Reservar</Button>
    <Button variant="secondary">Ver opciones</Button>
    <Button variant="outline">Cancelar</Button>
    <Button variant="destructive">Eliminar</Button>
    <Button variant="ghost">Más tarde</Button>
    <Button variant="link">Términos</Button>
  </div>
);

export const OnImmersiveDark = () => (
  <div className="flex flex-wrap items-center gap-3 p-6">
    <Button variant="glass">
      Sorpréndeme <Shuffle />
    </Button>
    <Button variant="glassIcon" aria-label="Siguiente historia">
      <ArrowRight />
    </Button>
  </div>
);

/** Calls to action on the booking screens: brand green, PayPal gold, and the quiet red-tint cancel. */
export const BookingActions = () => (
  <div className="flex flex-col gap-3 p-6" style={{ width: 360 }}>
    <Button variant="brand">Aceptar oferta</Button>
    <Button variant="paypal" aria-label="Pagar con PayPal">
      Pagar con PayPal
    </Button>
    <Button variant="glassDestructive">Cancelar y recibir 40,00 €</Button>
    <Button variant="glass" className="rounded-md">
      Volver al asistente
    </Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3 p-6 bg-white">
    <Button size="sm">Pequeño</Button>
    <Button>Normal</Button>
    <Button size="lg">Grande</Button>
    <Button size="icon" aria-label="Siguiente">
      <ArrowRight />
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex items-center gap-3 p-6 bg-white">
    <Button disabled>Procesando…</Button>
    <Button variant="outline" disabled>
      No disponible
    </Button>
  </div>
);
