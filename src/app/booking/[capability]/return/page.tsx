import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnStatus } from "./return-status";

// A dynamic segment whose layout reads usePathname() outside Suspense
// (src/app/providers.tsx) cannot be prerendered: render per request. A
// capability page has nothing to cache anyway.
export const instant = false;

export const metadata: Metadata = {
  title: "Pago | Paisaxe",
  robots: { index: false, follow: false },
};

/** PayPal's return URL for the deposit (PayPal hackathon plan, Phase 4); a static shell like the booking page. */
export default function BookingReturnPage() {
  return (
    <Suspense>
      <ReturnStatus />
    </Suspense>
  );
}
