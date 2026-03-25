import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock admin-api to avoid fetch calls
vi.mock("@/lib/admin-api", () => ({
  fetchFeatureFlags: vi.fn().mockResolvedValue({ data: [] }),
  updateFeatureFlag: vi.fn().mockResolvedValue({ data: null }),
  updateFeatureFlagConfig: vi.fn().mockResolvedValue({ data: null }),
  fetchSuggestions: vi.fn().mockResolvedValue({ data: [] }),
  updateSuggestion: vi.fn().mockResolvedValue({ data: null }),
  deleteSuggestion: vi.fn().mockResolvedValue({ data: null }),
  fetchAgentsSummary: vi.fn().mockResolvedValue({
    data: { overallHealth: "green", agents: [], sharedContext: [], recentActivity: [] },
  }),
  fetchAgentConfig: vi.fn().mockResolvedValue({ data: {} }),
  updateAgentConfig: vi.fn().mockResolvedValue({ data: null }),
  triggerOptimizerRun: vi.fn().mockResolvedValue({ data: null }),
}));

// Mock analytics cache context for agents-dashboard
vi.mock("../analytics-cache-context", () => ({
  AnalyticsCacheProvider: ({ children }: { children: React.ReactNode }) => children,
  useAnalyticsData: () => ({
    data: { overallHealth: "green", agents: [], sharedContext: [], recentActivity: [] },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock ElevenLabs for voice-agent-chat
vi.mock("@elevenlabs/react", () => ({
  useConversation: () => ({
    status: "disconnected",
    isSpeaking: false,
    startSession: vi.fn(),
    endSession: vi.fn(),
    sendUserMessage: vi.fn(),
  }),
}));

vi.mock("@/config/elevenlabs-agents", () => ({
  ELEVENLABS_AGENT_IDS: {},
}));

vi.mock("@/config/agent-prompts", () => ({
  AGENT_PROMPT_DEFAULTS: {},
}));

vi.mock("@/config/service-registry", () => ({
  SERVICE_REGISTRY: [],
}));

vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({}),
}));

// We need React for JSX
import React from "react";

describe("Admin a11y: heading hierarchy", () => {
  it("AnalyticsTabs should use h2 for its panel heading (not h1)", async () => {
    const { AnalyticsTabs } = await import("./analytics-tabs");
    render(
      <AnalyticsTabs activeTab="visitors" onTabChange={vi.fn()}>
        <div>content</div>
      </AnalyticsTabs>,
    );
    const heading = screen.getByText("Analytics");
    expect(heading.tagName).toBe("H2");
  });

  it("FeatureTogglesPanel should use h2 for its panel heading (not h1)", async () => {
    const { FeatureTogglesPanel } = await import("./feature-toggles-panel");
    render(<FeatureTogglesPanel />);
    // Wait for loading to finish
    const heading = await screen.findByText("Features");
    expect(heading.tagName).toBe("H2");
  });

  it("MarketingDashboard should use h2 for its panel heading (not h1)", async () => {
    // Mock the fetch for the marketing dashboard
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          accounts: [],
          stats: { totalPosts: 0, postsThisWeek: 0, failedPosts: 0 },
          upcomingPosts: [],
          recentPosts: [],
          schedules: [],
        },
      }),
    });
    const { MarketingDashboard } = await import(
      "./marketing-dashboard/marketing-dashboard"
    );
    render(<MarketingDashboard />);
    const heading = await screen.findByText("Marketing Automation");
    expect(heading.tagName).toBe("H2");
  });

  it("AgentsDashboard should use h2 for its panel heading (not h1)", async () => {
    // AgentsDashboard has complex dependencies that are hard to mock fully.
    // Verify the source code uses h2 (not h1) for the "Agent Intelligence" heading.
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/admin/agents-dashboard/index.tsx", "utf-8");
    // Should NOT have <h1 containing "Agent Intelligence"
    expect(source).not.toMatch(/<h1[^>]*>[\s\S]*?Agent Intelligence/);
    // Should have <h2 containing "Agent Intelligence"
    expect(source).toMatch(/<h2[^>]*>[\s\S]*?Agent Intelligence/);
  });

  it("SuggestionsPanel should use h2 for its panel heading (not h1)", async () => {
    const { SuggestionsPanel } = await import("./suggestions-panel");
    render(<SuggestionsPanel />);
    const heading = await screen.findByText("Story Suggestions");
    expect(heading.tagName).toBe("H2");
  });
});

describe("Admin a11y: focus-visible styles", () => {
  it("VisitorVoiceConfigPanel inputs should use focus-visible not focus", async () => {
    const { VisitorVoiceConfigPanel } = await import(
      "./visitor-voice-config-panel"
    );
    const flag = {
      id: "1",
      flagKey: "visitor_voice_agent",
      label: "Voice Agent",
      enabled: true,
      config: {},
      description: "",
      createdAt: "",
      updatedAt: "",
    };
    const { container } = render(
      <VisitorVoiceConfigPanel flag={flag as never} onUpdate={vi.fn()} />,
    );
    const inputs = container.querySelectorAll("input");
    inputs.forEach((input) => {
      const cls = input.className;
      // Should not have bare focus: classes (except focus-visible:)
      const focusMatches = cls.match(/(?<!\-)focus:/g);
      if (focusMatches) {
        // Every focus: should be focus-visible:
        expect(focusMatches).toHaveLength(0);
      }
    });
  });

  it("MaintenanceConfigPanel inputs should use focus-visible not focus", async () => {
    const { MaintenanceConfigPanel } = await import(
      "./maintenance-config-panel"
    );
    const flag = {
      id: "1",
      flagKey: "maintenance_mode",
      label: "Maintenance",
      enabled: false,
      config: {},
      description: "",
      createdAt: "",
      updatedAt: "",
    };
    const { container } = render(
      <MaintenanceConfigPanel flag={flag as never} onUpdate={vi.fn()} />,
    );
    const inputs = container.querySelectorAll("input, textarea");
    inputs.forEach((input) => {
      const cls = input.className;
      const focusMatches = cls.match(/(?<!\-)focus:/g);
      if (focusMatches) {
        expect(focusMatches).toHaveLength(0);
      }
    });
  });

  it("AgentConfigPanel textarea should use focus-visible not focus", async () => {
    const { AgentConfigPanel } = await import("./agent-config-panel");
    const flag = {
      id: "1",
      flagKey: "qa_agent_enabled",
      label: "QA Agent",
      enabled: true,
      config: {},
      description: "",
      createdAt: "",
      updatedAt: "",
    };
    const { container } = render(
      <AgentConfigPanel flag={flag as never} onUpdate={vi.fn()} />,
    );
    const textareas = container.querySelectorAll("textarea");
    textareas.forEach((ta) => {
      const cls = ta.className;
      const focusMatches = cls.match(/(?<!\-)focus:/g);
      if (focusMatches) {
        expect(focusMatches).toHaveLength(0);
      }
    });
  });

  it("FeatureTogglesPanel search input should use focus-visible not focus", async () => {
    const { FeatureTogglesPanel } = await import("./feature-toggles-panel");
    render(<FeatureTogglesPanel />);
    const searchInput = await screen.findByPlaceholderText("Search...");
    const cls = searchInput.className;
    const focusMatches = cls.match(/(?<!\-)focus:/g);
    if (focusMatches) {
      expect(focusMatches).toHaveLength(0);
    }
  });

  it("VoiceAgentChat text input should use focus-visible not focus", async () => {
    // Mock navigator.mediaDevices for test environment
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("not allowed")),
      },
      writable: true,
      configurable: true,
    });
    const { VoiceAgentChat } = await import("./voice-agent-chat");
    const { container } = render(<VoiceAgentChat agentIds={{}} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    inputs.forEach((input) => {
      const cls = input.className;
      const focusMatches = cls.match(/(?<!\-)focus:/g);
      if (focusMatches) {
        expect(focusMatches).toHaveLength(0);
      }
    });
  });
});

describe("Checkout a11y: breadcrumb heading", () => {
  it("checkout breadcrumb should not be an h1", async () => {
    vi.mock("@/hooks/use-auth", () => ({
      useAuth: () => ({
        user: { id: "1" },
        session: { access_token: "x" },
        signInWithGoogle: vi.fn(),
      }),
    }));
    vi.mock("@/lib/i18n", () => ({
      useTranslation: () => ({
        t: (key: string) => key,
      }),
    }));
    vi.mock("next/navigation", () => ({
      useSearchParams: () => ({
        get: () => null,
      }),
    }));
    vi.mock("@stripe/stripe-js", () => ({
      loadStripe: vi.fn().mockResolvedValue(null),
    }));
    vi.mock("@stripe/react-stripe-js", () => ({
      EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) =>
        children,
      EmbeddedCheckout: () => <div data-testid="stripe-checkout" />,
    }));

    const CheckoutPage = (await import("@/app/pricing/checkout/page")).default;
    render(<CheckoutPage />);

    const breadcrumb = screen.getByText("premium.checkout_title");
    expect(breadcrumb.tagName).not.toBe("H1");
  });
});
