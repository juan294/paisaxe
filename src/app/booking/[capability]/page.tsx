import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingStatus } from "./booking-status";

// A dynamic segment whose layout reads usePathname() outside Suspense
// (src/app/providers.tsx) cannot be prerendered: render per request. A
// capability page has nothing to cache anyway.
export const instant = false;

export const metadata: Metadata = {
  title: "Reserva | Paisaxe",
  robots: { index: false, follow: false },
};

/**
 * The booking behind a capability link (PayPal hackathon plan, Phase 4).
 *
 * A static shell: the booking loads in the browser through
 * /api/booking/bookings/<capability>, which verifies the capability and
 * answers a real 404 for an unknown one (a notFound() here would arrive after
 * PPR's 200 shell). No-referrer, noindex and no-store come from next.config.
 */
export default function BookingPage() {
  return (
    <Suspense>
      <BookingStatus />
    </Suspense>
  );
}
