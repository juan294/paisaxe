import type { Metadata } from "next";
import { Suspense } from "react";
import { OperatorDashboard } from "./operator-dashboard";

// A dynamic segment whose layout reads usePathname() outside Suspense
// (src/app/providers.tsx) cannot be prerendered: render per request. A
// capability page has nothing to cache anyway.
export const instant = false;

export const metadata: Metadata = {
  title: "Operador | Paisaxe",
  robots: { index: false, follow: false },
};

/**
 * The operator view behind an operator capability link (PayPal hackathon
 * plan, Phase 5).
 *
 * A static shell, like the booking page: the data loads in the browser
 * through /api/operator/<capability>, which verifies the capability and
 * answers a real 404 for a bad or expired one (a notFound() here would arrive
 * after PPR's 200 shell). The shell holds no merchant data. No-referrer and
 * noindex come from next.config; no-store from the API routes.
 */
export default function OperatorPage() {
  return (
    <Suspense>
      <OperatorDashboard />
    </Suspense>
  );
}
