import { requiredValue } from "@/test/required-value";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import fs from "fs";
import path from "path";
import RootLayout, { metadata } from "./layout";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { RequestPresentationProviderShell } from "./request-presentation-provider-shell";
import { en } from "@/lib/i18n/en";
import { resolveTranslation } from "@/lib/i18n/resolve";

// Resolve the actual async server shell before RTL renders the client tree.
// Next request APIs are the boundary; locale resolution, dictionaries, shell and
// Providers remain real. The root itself must not perform request reads.
const requestMocks = vi.hoisted(() => ({
  headers: vi.fn(async () => ({ get: () => null })),
  cookies: vi.fn(async () => ({ get: () => undefined, getAll: () => [] })),
}));
vi.mock("next/headers", () => requestMocks);
vi.mock("next/navigation", () => ({
  usePathname: () => "/about",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  localStorage.clear();
  requestMocks.headers.mockClear();
  requestMocks.cookies.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

async function resolveRequestShell(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === RequestPresentationProviderShell) {
    return RequestPresentationProviderShell({ children: element.props.children });
  }
  if (element.props.children === undefined) return element;
  const children = await Promise.all(Children.toArray(element.props.children).map(resolveRequestShell));
  return cloneElement(element, undefined, ...children);
}

async function resolvedRootLayout(props: { children: ReactNode }) {
  return resolveRequestShell(RootLayout(props));
}

const SITE_URL = "https://paisaxe.es";

describe("RootLayout", () => {
  it("keeps readable JavaScript recovery in the static root fallback until streamed content reveals", async () => {
    let ready = false;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    function StreamedContent() {
      if (!ready) throw pending;
      return <p data-testid="revealed-content">Revealed content</p>;
    }
    const tree = RootLayout({ children: <StreamedContent /> });
    expect(requestMocks.headers).not.toHaveBeenCalled();
    expect(requestMocks.cookies).not.toHaveBeenCalled();
    // Resolve the real request island at its SDK boundary, then let React's
    // actual outer Suspense hide the still-blocked child and show its fallback.
    const view = render(await resolveRequestShell(tree));
    try {
      const recovery = screen.getByRole("status");
      expect(recovery).toBeVisible();
      expect(recovery).toHaveTextContent(resolveTranslation("navigation.preparing", en));
      expect(recovery).toHaveTextContent(resolveTranslation("navigation.recovery", en));
      expect(recovery).toHaveTextContent(/JavaScript/);
      const reload = within(recovery).getByRole("link", { name: resolveTranslation("navigation.reload", en) });
      expect(reload).toBeVisible();
      expect(reload).toHaveAttribute("href", "/immersive");
      expect(reload.closest("noscript, [hidden], .sr-only")).toBeNull();
      expect(screen.queryByTestId("revealed-content")).not.toBeInTheDocument();

      await act(async () => { ready = true; release(); });
      expect(await screen.findByTestId("revealed-content")).toBeVisible();
      expect(recovery).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: resolveTranslation("navigation.reload", en) })).not.toBeInTheDocument();
    } finally {
      ready = true;
      release();
      view.unmount();
    }
  });

  it("keeps the root request-independent and resolves request state only inside its real server shell", async () => {
    const tree = RootLayout({ children: <p data-testid="streamed-child">Streamed</p> });
    expect(requestMocks.headers).not.toHaveBeenCalled();
    expect(requestMocks.cookies).not.toHaveBeenCalled();
    render(await resolveRequestShell(tree));
    expect(requestMocks.headers).toHaveBeenCalledOnce();
    expect(requestMocks.cookies).toHaveBeenCalledOnce();
    expect(screen.getByTestId("streamed-child").closest("[data-request-presentation]"))
      .toHaveAttribute("lang", "es");
  });

  describe("metadata", () => {
    it("should have correct title", () => {
      expect(metadata.title).toBe("Paisaxe | Asturias");
    });

    it("should have correct description", () => {
      // Description comes from LOCATION_CONFIG.seo.description
      expect(metadata.description).toContain("Asturias");
      expect(metadata.description).toContain("historias visuales");
    });

    it("should have relevant keywords", () => {
      // Keywords come from LOCATION_CONFIG.seo.keywords
      expect(metadata.keywords).toContain("Paisaxe");
      expect(metadata.keywords).toContain("Asturias");
      expect(metadata.keywords).toContain("turismo");
      expect(metadata.keywords).toContain("Spain");
      expect(metadata.keywords).toContain("travel");
      expect(metadata.keywords).toContain("sidra");
      expect(metadata.keywords).toContain("naturaleza");
    });

    it("should include metadataBase for resolving relative URLs", () => {
      expect(metadata.metadataBase).toBeDefined();
      expect(metadata.metadataBase!.toString()).toBe(`${SITE_URL}/`);
    });
  });

  describe("Open Graph tags", () => {
    it("should include og:title, og:type, og:site_name, and og:locale", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og).toMatchObject({
        title: "Paisaxe | Asturias",
        type: "website",
        siteName: "Paisaxe",
        locale: "es_ES",
      });
    });

    it("should include og:description", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og!.description).toBeTruthy();
      expect(og!.description).toContain("Asturias");
    });

    it("should include og:url pointing to site URL", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og!.url).toBe(SITE_URL);
    });

    it("should include og:image with dimensions and alt text", () => {
      const og = metadata.openGraph;
      expect(og).toBeDefined();
      expect(og!.images).toBeDefined();
      const images = og!.images as Array<{
        url: string;
        width: number;
        height: number;
        alt: string;
      }>;
      expect(images.length).toBeGreaterThan(0);
      expect(requiredValue(images[0], "src/app/layout.test.tsx: images[0]").url).toBe(`${SITE_URL}/opengraph-image`);
      expect(requiredValue(images[0], "src/app/layout.test.tsx: images[0]").width).toBe(1200);
      expect(requiredValue(images[0], "src/app/layout.test.tsx: images[0]").height).toBe(630);
      expect(requiredValue(images[0], "src/app/layout.test.tsx: images[0]").alt).toBe("Paisaxe · Diseño tipográfico original");
    });
  });

  describe("Twitter card tags", () => {
    it("should include twitter:card as summary_large_image", () => {
      const twitter = metadata.twitter as Record<string, unknown>;
      expect(twitter).toBeDefined();
      expect(twitter.card).toBe("summary_large_image");
    });

    it("should include twitter:title and twitter:description", () => {
      const twitter = metadata.twitter;
      expect(twitter).toBeDefined();
      expect(twitter!.title).toBe("Paisaxe | Asturias");
      expect(twitter!.description).toBeTruthy();
    });

    it("should include twitter:images", () => {
      const twitter = metadata.twitter;
      expect(twitter).toBeDefined();
      expect(twitter!.images).toEqual([{ url: `${SITE_URL}/opengraph-image`, alt: "Paisaxe · Diseño tipográfico original" }]);
    });
  });

  describe("canonical URL", () => {
    it("should include canonical URL via alternates", () => {
      expect(metadata.alternates).toBeDefined();
      expect(metadata.alternates!.canonical).toBe(SITE_URL);
    });
  });

  describe("content target", () => {
    it("renders a non-landmark #main-content target so route pages own the main landmark", async () => {
      const Component = await resolvedRootLayout({ children: <div data-testid="child">Child</div> });
      const { container } = render(Component);
      const mainTarget = container.querySelector("#main-content");
      expect(mainTarget).not.toBeNull();
      expect(mainTarget?.tagName).toBe("DIV");
      expect(container.querySelector("main#main-content")).toBeNull();
    });

    it("places children inside the #main-content target", async () => {
      const Component = await resolvedRootLayout({ children: <div data-testid="inner">Inner</div> });
      const { container } = render(Component);
      const mainTarget = container.querySelector("#main-content");
      expect(mainTarget).not.toBeNull();
      expect(mainTarget?.querySelector("[data-testid='inner']")).not.toBeNull();
    });
  });

  describe("preconnect links", () => {
    const layoutSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/layout.tsx"),
      "utf-8"
    );

    it("should not contain Google Fonts preconnect links", () => {
      expect(layoutSource).not.toContain("fonts.googleapis.com");
      expect(layoutSource).not.toContain("fonts.gstatic.com");
    });

    it("should not load a web font: font-sans is the system stack (#1010)", () => {
      // Inter was preloaded on every page (48 KB) but never applied.
      expect(layoutSource).not.toContain("next/font");
    });

    it("should keep Supabase preconnect links", () => {
      expect(layoutSource).toContain("getSupabaseUrl");
    });

    it("should keep Unsplash preconnect links", () => {
      expect(layoutSource).toContain("images.unsplash.com");
    });
  });

  describe("SITE_URL fallback", () => {
    afterEach(() => {
      vi.doUnmock("@/lib/env");
      vi.resetModules();
    });

    it("falls back to LOCATION_CONFIG.domain when getSiteUrl() returns undefined", async () => {
      // SITE_URL = getSiteUrl() ?? `https://${LOCATION_CONFIG.domain}` -- exercise
      // the ?? fallback for when NEXT_PUBLIC_SITE_URL is unset (getSiteUrl()
      // returns undefined per src/lib/env.ts).
      vi.doMock("@/lib/env", () => ({
        getSiteUrl: () => undefined,
        getSupabaseUrl: () => undefined,
      }));
      vi.resetModules();
      const { metadata: freshMetadata } = await import("./layout");
      expect(freshMetadata.metadataBase!.toString()).toBe("https://paisaxe.es/");
    });
  });

  describe("rendering", () => {
    it("should render children", async () => {
      const Component = await resolvedRootLayout({ children: <div data-testid="child">Test Child</div> });
      render(Component);

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Test Child")).toBeInTheDocument();
    });

    it("should set html lang to es", async () => {
      const Component = await resolvedRootLayout({ children: <div>Content</div> });
      render(Component);

      const html = document.documentElement;
      expect(html.getAttribute("lang")).toBe("es");
    });

    it("should apply font classes to body", async () => {
      const Component = await resolvedRootLayout({ children: <div>Content</div> });
      render(Component);

      const body = document.body;
      expect(body.className).toContain("font-sans");
      expect(body.className).toContain("antialiased");
    });

    it("should apply an explicit dark background to body (UX-M1 #894 — no white flash on overscroll)", async () => {
      // Regression test: the app is all-dark (immersive visitor UI), but body
      // previously relied on the `bg-background` token, which resolves to white
      // under `:root` because the visitor app never sets `.dark` on <html>. That
      // made the body flash white on iOS overscroll. Body must carry an explicit
      // dark background class, independent of the semantic token/.dark class
      // system (see CLAUDE.md-linked docs/agents/pre-launch-report.md UX-M1 —
      // flipping the root token palette is out of scope; it would invert the
      // ~41 existing `.dark`-semantics token consumers, including admin).
      const Component = await resolvedRootLayout({ children: <div>Content</div> });
      render(Component);

      const body = document.body;
      expect(body.className).toContain("bg-neutral-950");
    });

    it("should render JsonLd WebSite component", async () => {
      const Component = await resolvedRootLayout({ children: <div>Content</div> });
      const { container } = render(Component);
      const script = container.querySelector(
        'script[type="application/ld+json"]'
      );
      expect(script).toBeInTheDocument();
      const data = JSON.parse(script!.textContent!);
      expect(data["@type"]).toBe("WebSite");
    });
  });
});
