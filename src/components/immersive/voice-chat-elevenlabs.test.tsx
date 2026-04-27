import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { VoiceChatElevenLabs } from "./voice-chat-elevenlabs";
import type { Story } from "@/types/immersive";

// Mock ElevenLabs React hook
const mockStartSession = vi.fn();
const mockEndSession = vi.fn();
const mockUseConversation = vi.fn();
const mockIncrementConversation = vi.fn();

vi.mock("@elevenlabs/react", () => ({
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
vi.mock("@/hooks/use-voice-session", () => ({
  useVoiceSession: () => ({
    conversationCount: 0,
    isReturning: false,
    userLocale: "es-ES",
    preferredLanguage: "Spanish" as const,
    timeOfDay: "morning" as const,
    incrementConversation: mockIncrementConversation,
    resetSession: vi.fn(),
  }),
}));

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

    mockUseConversation.mockImplementation((options) => {
      conversationHandlers = options;
      return {
        status: "disconnected",
        isSpeaking: false,
        startSession: mockStartSession,
        endSession: mockEndSession,
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
    it("should call startSession with agent ID when orb is clicked", async () => {
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
            agentId: "test-agent-123",
          })
        );
      });
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

    it("should show error message when microphone permission is denied", async () => {
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

      // Now should show "Activar sonido" label
      expect(
        screen.getByRole("button", { name: /Activar sonido/i })
      ).toBeInTheDocument();
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

  describe("language override for non-Spanish (line 185)", () => {
    it("should set language override to 'en' when preferredLanguage is not Spanish", async () => {
      // Override voice session mock to return English preference
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
                language: "en",
              },
            },
            dynamicVariables: expect.objectContaining({
              preferred_language: "English",
              is_returning: "true",
              conversation_count: "2",
            }),
          })
        );
      });

      vi.restoreAllMocks();
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
          "Failed to end conversation:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
