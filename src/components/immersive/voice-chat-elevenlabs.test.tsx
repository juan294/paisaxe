import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { VoiceChatElevenLabs } from "./voice-chat-elevenlabs";
import { getElevenLabsLanguage } from "@/hooks/use-voice-session";
import type { Story } from "@/types/immersive";

// Mock ElevenLabs React hook
const mockStartSession = vi.fn();
const mockEndSession = vi.fn();
const mockUseConversation = vi.fn();
const mockIncrementConversation = vi.fn();
const mockSetMuted = vi.fn();

vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: React.ReactNode }) => children,
  useConversation: (options: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onMessage?: (msg: { message?: string; source?: string }) => void;
    onError?: (error: unknown) => void;
  }) => mockUseConversation(options),
}));

// Mock localize-story
vi.mock("@/lib/localize-story", () => ({
  getLocalizedStory: (story: { title: string; subtitle: string; description: string }) => ({
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
  }),
}));

// Mock voice session hook
vi.mock("@/hooks/use-voice-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-voice-session")>();
  return {
    ...actual,
    useVoiceSession: () => ({
      conversationCount: 0,
      isReturning: false,
      userLocale: "es-ES",
      preferredLanguage: "Spanish" as const,
      timeOfDay: "morning" as const,
      incrementConversation: mockIncrementConversation,
      resetSession: vi.fn(),
    }),
  };
});

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        "voice.connecting": "Conectando...",
        "voice.connected": "Conectado",
        "voice.speaking": "Pelayo esta hablando...",
        "voice.listening": "Te escucho...",
        "voice.tap_to_talk": "Toca para hablar",
        "voice.talk_to_me": "Háblame",
        "voice.stop": "Parar",
        "voice.mute": "Silenciar",
        "voice.unmute": "Activar sonido",
        "voice.error": "Error de conexión",
        "voice.error_not_configured": "Agente de voz no configurado",
        "voice.no_permission": "Necesito acceso al micrófono",
        "voice.you": "Tú",
        "voice.welcome_message": "Bienvenido a {title}",
      };
      return translations[key] || key;
    },
  }),
}));

const mockStory: Story = {
  id: "story-1",
  title: "Lagos de Covadonga",
  subtitle: "Picos de Europa",
  description: "Beautiful glacial lakes in the mountains",
  image: "/images/lagos.jpg",
  category: "nature",
  sourcePdf: "nature-guide.pdf",
};

describe("VoiceChatElevenLabs", () => {
  let conversationHandlers: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onMessage?: (msg: { message?: string; source?: string }) => void;
    onError?: (error: unknown) => void;
  } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    conversationHandlers = {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ signedUrl: "wss://signed.example/visitor" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    mockUseConversation.mockImplementation((options) => {
      conversationHandlers = options;
      return {
        status: "disconnected",
        isSpeaking: false,
        startSession: mockStartSession,
        endSession: mockEndSession,
        setMuted: mockSetMuted,
      };
    });

    // Mock mediaDevices for permission check
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({}),
      },
      writable: true,
    });
  });

  describe("rendering", () => {
    it("should render voice orb button when disconnected", () => {
      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      expect(screen.getByRole("button", { name: /Háblame/i })).toBeInTheDocument();
    });

    it("should show 'Tap to talk' status text when disconnected", () => {
      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      expect(screen.getByText(/Toca para hablar/i)).toBeInTheDocument();
    });
  });

  describe("starting a conversation", () => {
    it("should mint and use a signed session when orb is clicked", async () => {
      mockStartSession.mockResolvedValue(undefined);

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent-123"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalledWith(
          expect.objectContaining({
            signedUrl: "wss://signed.example/visitor",
          })
        );
      });
      expect(fetch).toHaveBeenCalledWith(
        "/api/voice-session",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ agentKey: "pelayo" }),
        })
      );
      expect(mockStartSession.mock.calls[0][0]).not.toHaveProperty("agentId");
    });

    it("should pass user_access_token as dynamic variable when provided", async () => {
      mockStartSession.mockResolvedValue(undefined);

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent-123"
          onFallbackToText={() => {}}
          userAccessToken="test-supabase-token-abc"
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalledWith(
          expect.objectContaining({
            dynamicVariables: expect.objectContaining({
              user_access_token: "test-supabase-token-abc",
            }),
          })
        );
      });
    });

    it("should not include user_access_token when not provided", async () => {
      mockStartSession.mockResolvedValue(undefined);

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent-123"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalled();
        const callArgs = mockStartSession.mock.calls[0][0];
        expect(callArgs.dynamicVariables).not.toHaveProperty("user_access_token");
      });
    });
  });

  describe("connection states", () => {
    it("should show listening state when connected and not speaking", () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
          setMuted: mockSetMuted,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      expect(screen.getByText(/Te escucho/i)).toBeInTheDocument();
    });

    it("should show speaking state when agent is speaking", () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: true,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      expect(screen.getByText(/Pelayo esta hablando/i)).toBeInTheDocument();
    });
  });

  describe("ending a conversation", () => {
    it("should call endSession when stop button is clicked", async () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
          setMuted: mockSetMuted,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      const stopButton = screen.getByRole("button", { name: /Parar/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockEndSession).toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    it("should call onFallbackToText when connection fails", async () => {
      const onFallbackToText = vi.fn();
      mockStartSession.mockRejectedValue(new Error("Connection failed"));

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={onFallbackToText}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(onFallbackToText).toHaveBeenCalled();
      });
    });

    it("should show error message when microphone permission is denied (on click)", async () => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
        writable: true,
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // UX-H1: permission is only requested when the user clicks start, not on mount
      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(screen.getByText(/acceso al micrófono/i)).toBeInTheDocument();
      });
    });
  });

  describe("transcript display", () => {
    it("should display messages from conversation", async () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Simulate receiving a message
      if (conversationHandlers.onMessage) {
        conversationHandlers.onMessage({
          message: "Hello, how can I help you today?",
          source: "ai",
        });
      }

      await waitFor(() => {
        expect(screen.getByText("Hello, how can I help you today?")).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("should have accessible voice orb button", () => {
      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      expect(orbButton).toHaveAttribute("aria-label");
    });
  });

  describe("onConnect callback", () => {
    it("should clear error and add welcome message when connected", async () => {
      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Trigger the onConnect callback
      act(() => {
        conversationHandlers.onConnect?.();
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Bienvenido a Lagos de Covadonga/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("onDisconnect callback", () => {
    it("should increment conversation count when disconnected", () => {
      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Trigger the onDisconnect callback
      act(() => {
        conversationHandlers.onDisconnect?.();
      });

      expect(mockIncrementConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe("onError callback", () => {
    it("should show error message and call onFallbackToText", async () => {
      const onFallbackToText = vi.fn();

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={onFallbackToText}
        />
      );

      // Trigger the onError callback
      act(() => {
        conversationHandlers.onError?.(new Error("test error"));
      });

      await waitFor(() => {
        expect(screen.getByText(/Error de conexión/i)).toBeInTheDocument();
      });

      expect(onFallbackToText).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty agentId", () => {
    it("should show error and call fallback when agentId is empty", async () => {
      const onFallbackToText = vi.fn();

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId=""
          onFallbackToText={onFallbackToText}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(screen.getByText("Agente de voz no configurado")).toBeInTheDocument();
      });

      expect(onFallbackToText).toHaveBeenCalledTimes(1);
      // startSession should NOT have been called
      expect(mockStartSession).not.toHaveBeenCalled();
    });
  });

  describe("connecting status", () => {
    it("should show 'Conectando...' text when status is connecting", () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connecting",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      expect(screen.getByText("Conectando...")).toBeInTheDocument();
    });
  });

  describe("mute toggle", () => {
    it("should toggle mute button aria-label when clicked", () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
          setMuted: mockSetMuted,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Initially unmuted - should show "Silenciar" label
      const muteButton = screen.getByRole("button", { name: /Silenciar/i });
      expect(muteButton).toBeInTheDocument();

      // Click to mute
      fireEvent.click(muteButton);
      expect(mockSetMuted).toHaveBeenLastCalledWith(true);

      // Now should show "Activar sonido" label
      const unmuteButton = screen.getByRole("button", { name: /Activar sonido/i });
      expect(unmuteButton).toBeInTheDocument();

      fireEvent.click(unmuteButton);
      expect(mockSetMuted).toHaveBeenLastCalledWith(false);
      expect(
        screen.queryByRole("button", { name: /Activar sonido/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("user message prefix", () => {
    it("should display user prefix when message source is user", async () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Simulate a user message
      act(() => {
        conversationHandlers.onMessage?.({
          message: "Donde puedo comer fabada?",
          source: "user",
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Tú:/i)).toBeInTheDocument();
        expect(screen.getByText(/Donde puedo comer fabada\?/i)).toBeInTheDocument();
      });
    });
  });

  describe("onMessage with empty message (line 136 false branch)", () => {
    it("should not add a message when message.message is falsy", async () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Simulate a message with no message text (empty/undefined)
      act(() => {
        conversationHandlers.onMessage?.({ source: "ai" });
      });

      // No transcript section should appear since no message was added
      expect(screen.queryByText("Pelayo:")).not.toBeInTheDocument();
    });
  });

  describe("app-selected language override", () => {
    it("keeps the selected Spanish locale when the browser prefers English", async () => {
      // Browser/session metadata says English, while the app language mock is Spanish.
      const voiceSessionModule = await import("@/hooks/use-voice-session");
      vi.spyOn(voiceSessionModule, "useVoiceSession").mockReturnValue({
        conversationCount: 2,
        isReturning: true,
        userLocale: "en-US",
        preferredLanguage: "English" as "Spanish" | "English",
        timeOfDay: "afternoon" as "morning" | "afternoon" | "evening",
        incrementConversation: mockIncrementConversation,
        resetSession: vi.fn(),
      });

      mockStartSession.mockResolvedValue(undefined);

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent-123"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalledWith(
          expect.objectContaining({
            overrides: {
              agent: {
                language: "es",
              },
            },
            dynamicVariables: expect.objectContaining({
              user_locale: "es",
              preferred_language: "Spanish",
              is_returning: "true",
              conversation_count: "2",
            }),
          })
        );
      });

      vi.restoreAllMocks();
    });
  });

  describe("native language routing", () => {
    it("maps French and Portuguese app selections to native presets", () => {
      expect(getElevenLabsLanguage("fr")).toBe("fr");
      expect(getElevenLabsLanguage("pt")).toBe("pt-br");
    });
  });

  describe("story category/location fallbacks (lines 195-196)", () => {
    it("should use 'general' when story has no category and 'Asturias' when no location", async () => {
      mockStartSession.mockResolvedValue(undefined);

      const storyWithoutCategoryLocation: Story = {
        ...mockStory,
        category: undefined as unknown as Story["category"],
        location: undefined,
      };

      render(
        <VoiceChatElevenLabs
          story={storyWithoutCategoryLocation}
          agentId="test-agent-123"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalledWith(
          expect.objectContaining({
            dynamicVariables: expect.objectContaining({
              story_category: "general",
              story_location: "Asturias",
            }),
          })
        );
      });
    });
  });

  describe("endConversation error handling", () => {
    it("should handle endSession throwing an error gracefully", async () => {
      mockEndSession.mockRejectedValue(new Error("disconnect failed"));

      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      const stopButton = screen.getByRole("button", { name: /Parar/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockEndSession).toHaveBeenCalled();
      });

      // The error should be caught silently (logged to console)
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("[VOICE_END_FAILURE]")
        );
      });

      consoleSpy.mockRestore();
    });
  });

  // FE-H1: unmount cleanup — endSession + mic track teardown
  describe("FE-H1: unmount cleanup", () => {
    it("calls endSession when the component unmounts", () => {
      const { unmount } = render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      unmount();

      expect(mockEndSession).toHaveBeenCalled();
    });

    it("stops mic tracks when component unmounts after a session was started", async () => {
      const mockTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
      } as unknown as MediaStream;

      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        writable: true,
      });

      mockStartSession.mockResolvedValue(undefined);

      const { unmount } = render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Start conversation to capture the MediaStream
      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(mockStartSession).toHaveBeenCalled();
      });

      unmount();

      // After unmount, mic tracks must be stopped
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  // UX-H1: getUserMedia should NOT be called on mount — only on startConversation click
  describe("UX-H1: deferred microphone permission", () => {
    it("should NOT call getUserMedia on mount", async () => {
      const getUserMediaMock = vi.fn().mockResolvedValue({});
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Give effects time to run
      await new Promise((r) => setTimeout(r, 50));
      expect(getUserMediaMock).not.toHaveBeenCalled();
    });

    it("should call getUserMedia when startConversation is triggered", async () => {
      const getUserMediaMock = vi.fn().mockResolvedValue({});
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });
      mockStartSession.mockResolvedValue(undefined);

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
      });
    });

    it("should show permission error when getUserMedia fails on click", async () => {
      const getUserMediaMock = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        expect(screen.getByText(/acceso al micrófono/i)).toBeInTheDocument();
      });
    });

    it("should keep hasPermission as null until the user clicks start", async () => {
      const getUserMediaMock = vi.fn().mockResolvedValue({});
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // The mic permission warning should NOT be visible (hasPermission is null, not false)
      expect(screen.queryByText(/acceso al micrófono/i)).not.toBeInTheDocument();
    });
  });

  // UX-H6: ARIA live regions on voice errors and transcript
  describe("UX-H6: ARIA live regions", () => {
    it("should have role=alert on mic permission warning", async () => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
        writable: true,
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Trigger the permission check by clicking start
      const orbButton = screen.getByRole("button", { name: /Háblame/i });
      fireEvent.click(orbButton);

      await waitFor(() => {
        const alert = screen.getAllByRole("alert");
        expect(alert.length).toBeGreaterThan(0);
      });
    });

    it("should have role=alert on error display", async () => {
      const onFallbackToText = vi.fn();

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={onFallbackToText}
        />
      );

      // Trigger the onError callback
      act(() => {
        conversationHandlers.onError?.(new Error("connection error"));
      });

      await waitFor(() => {
        const alerts = screen.getAllByRole("alert");
        expect(alerts.some((a) => a.textContent?.includes("Error de conexión"))).toBe(true);
      });
    });

    it("should have role=log and aria-live=polite on transcript wrapper", async () => {
      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Simulate a message to make the transcript visible
      act(() => {
        conversationHandlers.onMessage?.({ message: "Hola!", source: "ai" });
      });

      await waitFor(() => {
        const log = screen.getByRole("log");
        expect(log).toHaveAttribute("aria-live", "polite");
      });
    });
  });

  describe("startConversation error handling (lines 260-265)", () => {
    it("shows error and calls onFallbackToText when startSession throws an Error", async () => {
      mockStartSession.mockRejectedValue(new Error("WebRTC failed"));
      const onFallbackToText = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={onFallbackToText}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Háblame/i }));

      await waitFor(() => {
        expect(onFallbackToText).toHaveBeenCalled();
      });

      await waitFor(() => {
        const alerts = screen.getAllByRole("alert");
        expect(alerts.some((a) => a.textContent?.includes("Error de conexión"))).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    it("covers String(err) branch when startSession throws a non-Error value (line 261 false branch)", async () => {
      // Throwing a non-Error (e.g. a string) exercises the `String(err)` else-branch of
      // `err instanceof Error ? err.message : String(err)` inside the catch block.
      mockStartSession.mockRejectedValue("plain string error");
      const onFallbackToText = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={onFallbackToText}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Háblame/i }));

      await waitFor(() => {
        expect(onFallbackToText).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe("endConversation non-Error throw (line 273 false branch)", () => {
    it("covers String(err) branch when endSession throws a non-Error value", async () => {
      mockEndSession.mockRejectedValue("connection closed unexpectedly");

      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      const stopButton = screen.getByRole("button", { name: /Parar/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockEndSession).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("[VOICE_END_FAILURE]")
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("auto-scroll with prefersReducedMotion (line 196)", () => {
    it("calls scrollIntoView with behavior='auto' when reduced motion is preferred", async () => {
      // Configure matchMedia to signal prefers-reduced-motion
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("prefers-reduced-motion: reduce"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const scrollSpy = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollSpy;

      mockUseConversation.mockImplementation((options) => {
        conversationHandlers = options;
        return {
          status: "connected",
          isSpeaking: false,
          startSession: mockStartSession,
          endSession: mockEndSession,
        };
      });

      render(
        <VoiceChatElevenLabs
          story={mockStory}
          agentId="test-agent"
          onFallbackToText={() => {}}
        />
      );

      // Trigger a message so the messages state changes and the scroll effect fires
      act(() => {
        conversationHandlers.onMessage?.({ message: "Hola!", source: "ai" });
      });

      await waitFor(() => {
        // With prefersReducedMotion=true the effect uses behavior:"auto"
        expect(scrollSpy).toHaveBeenCalledWith(
          expect.objectContaining({ behavior: "auto" })
        );
      });

      // Restore matchMedia
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });
  });
});
