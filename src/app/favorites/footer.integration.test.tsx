import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import FavoritesLayout from "./layout";
import FavoritesPage from "./page";
import { AuthProvider } from "@/components/auth/auth-provider";
import { LanguageProvider } from "@/lib/i18n";
import { clearStoriesCache } from "@/hooks/use-stories";

// Only network is replaced. The page, layout, stories/auth/language providers
// and footer remain real, including anonymous useFavorites behavior.
beforeEach(() => {
  clearStoriesCache();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/stories") return new Response(JSON.stringify({ data: [] }));
    throw new Error(`Unexpected network boundary: ${String(input)}`);
  }));
});
afterEach(() => { cleanup(); clearStoriesCache(); vi.unstubAllGlobals(); });

function expectLegalFooter() {
  const footer = screen.getByRole("contentinfo");
  expect(footer).not.toHaveClass("fixed");
  expect(within(footer).getByRole("link", { name: "Condiciones de Uso" })).toHaveAttribute("href", "/terms");
  expect(within(footer).getByRole("link", { name: "Política de Privacidad" })).toHaveAttribute("href", "/privacy");
}
describe("favorites layout keeps legal access outside every page branch", () => {
  it("includes the legal footer with the real anonymous favorites page", () => {
    render(<LanguageProvider initialLocale="es"><AuthProvider deferInitialAuth>
      <FavoritesLayout><FavoritesPage /></FavoritesLayout>
    </AuthProvider></LanguageProvider>);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expectLegalFooter();
  });

  it("keeps legal links available while a child is suspended", () => {
    const pending = new Promise<never>(() => {});
    function PendingChild(): never { throw pending; }
    render(<LanguageProvider initialLocale="es"><FavoritesLayout>
      <Suspense fallback={<p role="status">Cargando guardados</p>}><PendingChild /></Suspense>
    </FavoritesLayout></LanguageProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando guardados");
    expectLegalFooter();
  });

  it.each(["empty", "populated", "retry"])("keeps the footer after the %s child without conditional coupling", (branch) => {
    render(<LanguageProvider initialLocale="es"><FavoritesLayout>
      <main data-testid="route-child">{branch}</main>
    </FavoritesLayout></LanguageProvider>);
    expectLegalFooter();
    expect(screen.getByTestId("route-child").compareDocumentPosition(screen.getByRole("contentinfo")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
