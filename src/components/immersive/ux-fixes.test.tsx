/**
 * Regression tests for UX-H4, UX-H5, UX-M4, UX-M7.
 *
 * UX-H4 (#470): Tap target size — buttons must use p-3 (not p-2) to hit 44×44px WCAG 2.2 AA.
 * UX-H5 (#471): Chevron direction in RelatedStories — ChevronUp when expanded, ChevronDown when collapsed.
 * UX-M4 (#477): Invalid h-4.5 w-4.5 in ChatUpsellCTA icon — must be h-4 w-4.
 * UX-M7 (#480): AuthorTypewriter must not include English/dev strings in its message cycle.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createMockT } from "@/test/i18n-mock";

import { BookmarkButton } from "./bookmark-button";
import { ShareButton } from "./share-button";
import { SurpriseMeButton } from "./surprise-me-button";
import { SuggestPlaceButton } from "./suggest-place-button";
import { ToolbarOverflowMenu } from "./toolbar-overflow-menu";
import { RelatedStories } from "./related-stories";
import { ChatUpsellCTA } from "./chat-upsell-cta";
import type { Story } from "@/types/immersive";

// ─────────────────────────────────────────────────────────────────────────────
// Shared mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockT = createMockT();

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    isLoading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    isEnabled: () => true,
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// UX-H4: Tap target size — p-3 on icon buttons (#470)
// ─────────────────────────────────────────────────────────────────────────────

describe("UX-H4: tap target size ≥ 44px (WCAG 2.2 AA — p-3 required)", () => {
  it("BookmarkButton icon variant uses p-3", () => {
    const { container } = render(
      <BookmarkButton isFavorite={false} onToggle={vi.fn()} />
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/\bp-3\b/);
    expect(btn?.className).not.toMatch(/\bp-2\b/);
  });

  it("ShareButton uses p-3", () => {
    const story: Story = {
      id: "1",
      slug: "s",
      title: "T",
      subtitle: "S",
      description: "D",
      image: "/img.png",
      category: "nature",
      sourcePdf: "f.pdf",
      location: "central",
      duration: "weekend",
    };
    const { container } = render(<ShareButton story={story} />);
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/\bp-3\b/);
    expect(btn?.className).not.toMatch(/\bp-2\b/);
  });

  it("SurpriseMeButton uses p-3", () => {
    const { container } = render(
      <SurpriseMeButton
        totalStories={5}
        currentIndex={0}
        viewedIndices={new Set()}
        onJumpTo={vi.fn()}
      />
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/\bp-3\b/);
    expect(btn?.className).not.toMatch(/\bp-2\b/);
  });

  it("SuggestPlaceButton icon variant uses p-3", () => {
    const { container } = render(<SuggestPlaceButton variant="icon" />);
    const btn = container.querySelector("button[data-suggest-place-trigger]");
    expect(btn?.className).toMatch(/\bp-3\b/);
    expect(btn?.className).not.toMatch(/\bp-2\b/);
  });

  it("ToolbarOverflowMenu trigger button uses p-3", () => {
    const { container } = render(
      <ToolbarOverflowMenu>
        <span>item</span>
      </ToolbarOverflowMenu>
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/\bp-3\b/);
    expect(btn?.className).not.toMatch(/\bp-2\b/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UX-H5: Chevron direction in RelatedStories (#471)
// ─────────────────────────────────────────────────────────────────────────────

const mockStories: Story[] = [
  {
    id: "1",
    slug: "story-1",
    title: "Story One",
    subtitle: "Sub",
    description: "Desc",
    image: "/img1.png",
    category: "nature",
    sourcePdf: "f.pdf",
    location: "eastern",
    duration: "day-trip",
  },
];

describe("UX-H5: RelatedStories chevron direction (#471)", () => {
  it("shows ChevronUp when expanded (collapse affordance)", () => {
    render(<RelatedStories stories={mockStories} onSelectStory={vi.fn()} />);

    const toggleBtn = screen.getByRole("button", {
      name: new RegExp(mockT("stories.related"), "i"),
    });

    // Starts expanded
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Lucide ChevronUp SVG path: "m18 15-6-6-6 6"
    const path = toggleBtn.querySelector("svg path");
    expect(path?.getAttribute("d")).toBe("m18 15-6-6-6 6");
  });

  it("shows ChevronDown when collapsed (expand affordance)", () => {
    render(<RelatedStories stories={mockStories} onSelectStory={vi.fn()} />);

    const toggleBtn = screen.getByRole("button", {
      name: new RegExp(mockT("stories.related"), "i"),
    });

    // Collapse it
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Lucide ChevronDown SVG path: "m6 9 6 6 6-6"
    const path = toggleBtn.querySelector("svg path");
    expect(path?.getAttribute("d")).toBe("m6 9 6 6 6-6");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UX-M4: Invalid h-4.5 w-4.5 → h-4 w-4 in ChatUpsellCTA (#477)
// ─────────────────────────────────────────────────────────────────────────────

describe("UX-M4: ChatUpsellCTA icon size (#477)", () => {
  it("reason icon uses h-4 w-4 classes (not invalid h-4.5 w-4.5)", () => {
    const { container } = render(
      <ChatUpsellCTA reason="weather" onDismiss={vi.fn()} />
    );

    // h-4.5 is not a valid Tailwind utility — verify it's gone
    const allElements = container.querySelectorAll("*");
    const hasInvalidClass = Array.from(allElements).some(
      (el) =>
        el.className &&
        typeof el.className === "string" &&
        el.className.includes("h-4.5")
    );
    expect(hasInvalidClass).toBe(false);

    // Verify valid h-4 w-4 exists on the icon SVG
    const iconSvg = container.querySelector(".h-4.w-4");
    expect(iconSvg).toBeInTheDocument();
  });

  it("all four upsell reasons render without h-4.5", () => {
    const reasons = ["weather", "booking", "realtime", "slow_typing"] as const;
    for (const reason of reasons) {
      const { container, unmount } = render(
        <ChatUpsellCTA reason={reason} onDismiss={vi.fn()} />
      );
      const allElements = container.querySelectorAll("*");
      const hasInvalidClass = Array.from(allElements).some(
        (el) =>
          el.className &&
          typeof el.className === "string" &&
          el.className.includes("h-4.5")
      );
      expect(hasInvalidClass, `reason=${reason} must not have h-4.5`).toBe(false);
      unmount();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UX-M7: AuthorTypewriter — no English/dev strings in message cycle (#480)
// ─────────────────────────────────────────────────────────────────────────────

describe("UX-M7: AuthorTypewriter — no English/dev strings in cycle (#480)", () => {
  it("messages array contains no English/dev jokes", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(__dirname, "author-typewriter.tsx"),
      "utf-8"
    );

    const forbidden = [
      "works on my machine",
      "bug-free",
      "bug_free",
      "npm run explore",
      "git push --pray",
      "TODO: fix later",
      "ship it",
      "Son of Anton",
    ];

    for (const phrase of forbidden) {
      expect(source.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("messages array contains the expected Spanish/Asturian flavor strings", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(__dirname, "author-typewriter.tsx"),
      "utf-8"
    );

    // A representative subset — full list lives in the component source
    const expectedFragments = [
      "Asturias",
      "sidra",
      "buen Camino",
      "404: sueño no encontrado",
    ];

    for (const fragment of expectedFragments) {
      expect(source).toContain(fragment);
    }
  });
});
