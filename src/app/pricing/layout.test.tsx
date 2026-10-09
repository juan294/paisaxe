import type { ComponentType, ReactNode } from "react";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import PricingPage from "./page";
import CheckoutPage from "./checkout/page";
import CheckoutReturnPage from "./checkout/return/page";
import PricingLoading from "./loading";
import { AuthProvider } from "@/components/auth/auth-provider";
import { FeatureFlagsProvider } from "@/hooks/use-feature-flags";
import { LanguageProvider } from "@/lib/i18n";

// Next navigation is the platform boundary. No owned hooks/components mocked.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("pricing family layout legal access", () => {
  // The absent layout is an API/architecture RED, separately disclosed from
  // the behavioral failures in the existing SiteFooter and favorites layout.
  async function loadLayout() {
    const layoutModule = await vi.importActual<{ default: ComponentType<{ children: ReactNode }> }>("./layout");
    return layoutModule.default;
  }
  it.each([
    ["pricing", PricingPage], ["anonymous checkout", CheckoutPage],
    ["checkout return", CheckoutReturnPage], ["loading shell", PricingLoading],
  ] as const)("provides one flow footer after the real %s content", async (_name, Page) => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Unexpected network boundary"); }));
    const Layout = await loadLayout();
    render(<LanguageProvider initialLocale="es"><FeatureFlagsProvider enabled={false} initialFlags={{ visitor_voice_agent: false }}>
      <AuthProvider deferInitialAuth><Layout><Page /></Layout></AuthProvider>
    </FeatureFlagsProvider></LanguageProvider>);
    const footer = screen.getByRole("contentinfo");
    expect(footer).not.toHaveClass("fixed");
    expect(within(footer).getByRole("link", { name: "Condiciones de Uso" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "Política de Privacidad" })).toHaveAttribute("href", "/privacy");
    expect(footer.previousElementSibling).not.toBeNull();
  });
  it("keeps legal links outside a pending child Suspense boundary", async () => {
    const Layout = await loadLayout();
    const pending = new Promise<never>(() => {});
    function PendingChild(): never { throw pending; }
    render(<LanguageProvider initialLocale="es"><Layout>
      <Suspense fallback={<p role="status">Preparando pago</p>}><PendingChild /></Suspense>
    </Layout></LanguageProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando pago");
    expect(screen.getByRole("contentinfo")).not.toHaveClass("fixed");
  });
});
