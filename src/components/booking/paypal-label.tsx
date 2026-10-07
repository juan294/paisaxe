/** PayPal's full-colour logo, vendored from paypalobjects.com (docs/plans/2026-10-07-booking-ui-polish.md, D1). */
export const PAYPAL_LOGO_SRC = "/images/paypal-logo.svg";

/**
 * The content of a PayPal-gold button: "Pagar con" and the PayPal logo. The
 * caller keeps `aria-label={t("booking.cards.pay")}` so the accessible name stays
 * "Pagar con PayPal" (D5); the alt text shows if the logo fails to load.
 */
export function PayPalLabel({ prefix }: { prefix: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{prefix}</span>
      {/* A static SVG at a fixed size: next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PAYPAL_LOGO_SRC} alt="PayPal" width={64} height={18} className="h-[18px] w-auto" />
    </span>
  );
}
