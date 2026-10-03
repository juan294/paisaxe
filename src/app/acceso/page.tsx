import type { Metadata } from "next";
import { VoucherForm } from "./voucher-form";

export const metadata: Metadata = {
  title: "Acceso | Paisaxe",
  robots: { index: false, follow: false },
};

/**
 * Voucher entry to the booking demo (PayPal hackathon plan, Phase 2).
 *
 * Static on purpose. Whether the page exists is decided in proxy.ts
 * (lib/proxy/booking-surface.ts), which answers with a real 404 while the
 * experience_booking flag is off or on a Preview: under PPR a notFound()
 * here would arrive after the shell's 200. The redemption API enforces the
 * same gate on its own.
 */
export default function AccesoPage() {
  return <VoucherForm />;
}
