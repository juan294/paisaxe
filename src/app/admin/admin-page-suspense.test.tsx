import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * FE-M3 (#564): AdminShell reads useSearchParams (a CSR-bailout hook) and must be
 * wrapped in a Suspense boundary by the route file so a suspending shell shows a
 * fallback instead of bubbling the suspension to the framework root.
 *
 * We mock AdminShell to suspend (throw a never-resolving promise) and assert the
 * route-level Suspense fallback renders.
 */

// Mock theme provider so it just renders children.
vi.mock("@/components/admin/theme-provider", () => ({
  AdminThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock AdminShell to suspend forever — proves a Suspense boundary catches it.
const neverResolves = new Promise<never>(() => {});
vi.mock("@/components/admin/admin-shell", () => ({
  AdminShell: () => {
    throw neverResolves;
  },
}));

import AdminPage from "./page";

describe("AdminPage Suspense boundary (#564)", () => {
  it("renders a fallback instead of throwing when the shell suspends", () => {
    render(<AdminPage />);
    // The route-level <Suspense fallback> must catch the suspension.
    expect(screen.getByTestId("admin-shell-fallback")).toBeInTheDocument();
  });
});
