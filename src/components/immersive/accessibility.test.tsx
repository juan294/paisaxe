import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryViewer } from "./story-viewer";
import { VoiceChat } from "./voice-chat";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ReactNode } from "react";
import { createMockT } from "@/test/i18n-mock";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// Mock Supabase browser client
vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock feature flags - enable autoplay_button for accessibility tests
vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({
    flags: [],
    isLoading: false,
    isEnabled: (flag: string) => flag === "autoplay_button",
  }),
}));

// Mock useReducedMotion
const mockUseReducedMotion = vi.fn(() => false);
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

// Mock useVoiceAccess hook
vi.mock("@/hooks/use-voice-access", () => ({
  useVoiceAccess: () => ({
    canUseVoice: false,
    needsSignIn: false,
    needsPurchase: false,
    agentId: "",
    expiresAt: null,
    hoursUntilExpiry: null,
    isLoading: false,
    isWhitelisted: false,
    hasAccess: false,
    refresh: vi.fn(),
  }),
}));

// Mock VoicePurchaseCTA component
vi.mock("@/components/premium/voice-purchase-cta", () => ({
  VoicePurchaseCTA: () => (
    <div data-testid="voice-purchase-cta">
      Purchase voice access
    </div>
  ),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: {
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// Wrapper component for tests
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const renderWithAuth = async (ui: ReactNode) => {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui, { wrapper: TestWrapper });
  });
  return result!;
};

const mockStories: Story[] = [
  {
    id: "story-1",
    title: "Lagos de Covadonga",
    subtitle: "Picos de Europa",
    description: "Beautiful glacial lakes in the mountains",
    image: "/images/lagos.jpg",
    category: "nature",
    sourcePdf: "nature-guide.pdf",
  },
  {
    id: "story-2",
    title: "Oviedo Cathedral",
    subtitle: "Historic City",
    description: "Gothic cathedral in the heart of Oviedo",
    image: "/images/cathedral.jpg",
    category: "culture",
    sourcePdf: "culture-guide.pdf",
  },
];

const getDefaultProps = (overrides = {}) => ({
  stories: mockStories,
  allStories: mockStories,
  currentIndex: 0,
  onIndexChange: vi.fn(),
  onAskAbout: vi.fn(),
  selectedCategory: null as StoryCategory | null,
  selectedLocation: null as StoryLocation | null,
  selectedDuration: null as StoryDuration | null,
  onCategoryChange: vi.fn(),
  onLocationChange: vi.fn(),
  onDurationChange: vi.fn(),
  onClearFilters: vi.fn(),
  ...overrides,
});

// Mock fetch for VoiceChat tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Helper to create a mock streaming response for the chat endpoint.
 */
function createStreamingResponse(message: string, images: unknown[] = []) {
  const encoder = new TextEncoder();
  const words = message.split(" ");
  const events: Uint8Array[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = i === 0 ? words[i] : " " + words[i];
    const event = `data: ${JSON.stringify({ type: "text", content: word })}\n\n`;
    events.push(encoder.encode(event));
  }

  const finalEvent = `data: ${JSON.stringify({ type: "done", images, sources: [] })}\n\n`;
  events.push(encoder.encode(finalEvent));

  let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(events[index]);
        index++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: stream,
  };
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Accessibility: StoryViewer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("semantic structure", () => {
    it("should wrap the story viewer in a main element", async () => {
      const { container } = await renderWithAuth(
        <StoryViewer {...getDefaultProps()} />
      );

      const mainEl = container.querySelector("main");
      expect(mainEl).toBeInTheDocument();
    });

    it("should have role='article' on the story content area", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const article = screen.getByRole("article");
      expect(article).toBeInTheDocument();
    });
  });

  describe("aria-labels on navigation buttons", () => {
    it("should have aria-label on the previous story button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const prevButton = screen.getByRole("button", { name: /anterior/i });
      expect(prevButton).toBeInTheDocument();
    });

    it("should have aria-label on the next story button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const nextButton = screen.getByRole("button", { name: /siguiente/i });
      expect(nextButton).toBeInTheDocument();
    });

    it("should have aria-label on the auto-play toggle button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const autoPlayButton = screen.getByRole("button", { name: /reproducir|pausar/i });
      expect(autoPlayButton).toBeInTheDocument();
    });
  });

  describe("aria-live region for story changes", () => {
    it("should have an aria-live region that announces the current story", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // Multiple elements may have role="status" (e.g., bookmark toast),
      // so find the sr-only one with aria-live="polite" that announces the story
      const statusElements = screen.getAllByRole("status");
      const liveRegion = statusElements.find(
        (el) => el.getAttribute("aria-live") === "polite" && el.classList.contains("sr-only")
      );
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
      expect(liveRegion!.textContent).toContain("Lagos de Covadonga");
    });
  });

  describe("focus-visible styles", () => {
    it("should have focus-visible ring on navigation buttons", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const prevButton = screen.getByRole("button", { name: /anterior/i });
      expect(prevButton.className).toMatch(/focus-visible:/);
    });

    it("should have focus-visible ring on ask button", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const askButton = screen.getByRole("button", { name: "Preguntar sobre esto" });
      expect(askButton.className).toMatch(/focus-visible:/);
    });
  });

  describe("prefers-reduced-motion", () => {
    it("should disable auto-play when reduced motion is preferred", async () => {
      mockUseReducedMotion.mockReturnValue(true);
      const onIndexChange = vi.fn();

      await renderWithAuth(
        <StoryViewer {...getDefaultProps({ onIndexChange })} />
      );

      // Find and click the auto-play toggle
      const autoPlayButton = screen.getByRole("button", { name: /reproducir/i });
      fireEvent.click(autoPlayButton);

      // Advance time by auto-play interval
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Auto-play should NOT advance
      expect(onIndexChange).not.toHaveBeenCalled();
    });

    it("should skip transition animation when reduced motion is preferred", async () => {
      mockUseReducedMotion.mockReturnValue(true);
      const onIndexChange = vi.fn();

      await renderWithAuth(
        <StoryViewer {...getDefaultProps({ onIndexChange })} />
      );

      const nextButton = screen.getByRole("button", { name: /siguiente/i });
      fireEvent.click(nextButton);

      // With reduced motion, navigation should be immediate (no 300ms delay)
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it("should not apply zoom animation class when reduced motion is preferred", async () => {
      mockUseReducedMotion.mockReturnValue(true);

      const { container } = await renderWithAuth(
        <StoryViewer {...getDefaultProps()} />
      );

      const img = container.querySelector("img");
      expect(img?.className).not.toContain("animate-slow-zoom");
      expect(img?.className).not.toContain("animate-ambient-zoom");
    });

    it("should apply motion-reduce:transition-none on animated elements", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      // The bottom content area (article) has transition-all -- it should also have motion-reduce variant
      const bottomContent = screen
        .getByText("Lagos de Covadonga")
        .closest("[class*='bottom-0']");
      expect(bottomContent?.className).toContain("motion-reduce:");
    });
  });

  describe("progress bar accessibility", () => {
    it("should have an accessible role on the progress bar", async () => {
      await renderWithAuth(<StoryViewer {...getDefaultProps()} />);

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeInTheDocument();
    });

    it("should indicate the current position in the progress bar", async () => {
      await renderWithAuth(
        <StoryViewer {...getDefaultProps({ currentIndex: 0 })} />
      );

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow", "1");
      expect(progressBar).toHaveAttribute("aria-valuemin", "1");
      expect(progressBar).toHaveAttribute("aria-valuemax", "2");
    });
  });
});

describe("Accessibility: VoiceChat", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockStory: Story = {
    id: "story-1",
    title: "Lagos de Covadonga",
    subtitle: "Picos de Europa",
    description: "Beautiful glacial lakes in the mountains",
    image: "/images/lagos.jpg",
    category: "nature",
    sourcePdf: "nature-guide.pdf",
  };

  describe("aria-live region for chat messages", () => {
    it("should have an aria-live region for chat messages", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const liveRegion = screen.getByRole("log");
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
    });

    it("should announce new messages to screen readers", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("AI response about the lakes"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Tell me about this");

      const form = input.closest("form");
      if (form) fireEvent.submit(form);

      await waitFor(() => {
        const liveRegion = screen.getByRole("log");
        expect(liveRegion.textContent).toContain("AI response about the lakes");
      });
    });
  });

  describe("dialog semantics", () => {
    it("should have role='dialog' on the chat panel", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("should have aria-label on the chat dialog", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-label");
    });
  });

  describe("button aria-labels", () => {
    it("should have aria-label on the close button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const closeButton = screen.getByRole("button", { name: /cerrar/i });
      expect(closeButton).toBeInTheDocument();
    });

    it("should have aria-label on the submit button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const submitButton = screen.getByRole("button", { name: /enviar/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe("focus-visible styles on chat buttons", () => {
    it("should have focus-visible ring on the close button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const closeButton = screen.getByRole("button", { name: /cerrar/i });
      expect(closeButton.className).toMatch(/focus-visible:/);
    });
  });

  describe("reduced motion in chat", () => {
    it("should have motion-reduce class on the chat panel slide-in", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const chatPanel = screen.getByRole("dialog");
      const panelInner = chatPanel.querySelector("[class*='animate-in']") || chatPanel;
      // The panel or its parent should reference motion-reduce
      const hasMotionReduce =
        panelInner.className.includes("motion-reduce:") ||
        chatPanel.className.includes("motion-reduce:");
      expect(hasMotionReduce).toBe(true);
    });
  });
});
