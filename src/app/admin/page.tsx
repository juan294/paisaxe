"use client";

/**
 * Admin page entry point.
 *
 * This file is intentionally thin — all logic lives in AdminShell (AR-M2).
 * AdminThemeProvider wraps the shell to provide dark/light mode for admin UI.
 */

import { AdminThemeProvider } from "@/components/admin/theme-provider";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminPage() {
  return (
    <AdminThemeProvider>
      <AdminShell />
    </AdminThemeProvider>
  );
}
