"use client";

/**
 * Admin page entry point.
 *
 * This file is intentionally thin — all logic lives in AdminShell (AR-M2).
 * AdminThemeProvider wraps the shell to provide dark/light mode for admin UI.
 */

import { Suspense } from "react";
import { AdminThemeProvider } from "@/components/admin/theme-provider";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminPage() {
  return (
    <AdminThemeProvider>
      {/* #564: AdminShell reads useSearchParams (CSR bailout) — isolate it in a
          Suspense boundary so the route doesn't bubble suspension to the root. */}
      <Suspense fallback={<div data-testid="admin-shell-fallback" aria-hidden="true" />}>
        <AdminShell />
      </Suspense>
    </AdminThemeProvider>
  );
}
