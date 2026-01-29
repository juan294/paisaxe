import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoiceChatElevenLabs } from "./voice-chat-elevenlabs";
import type { Story } from "@/types/immersive";

// Mock ElevenLabs React hook
const mockStartSession = vi.fn();
const mockEndSession = vi.fn();
const mockUseConversation = vi.fn();

vi.mock("@elevenlabs/react", () => ({
  useConversation: (options: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onMessage?: (msg: { message?: string; source?: string }) => void;
    onError?: (error: unknown) => void;
  }) => mockUseConversation(options),
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
        "voice.no_permission": "Necesito acceso al micrófono",
        "voice.you": "Tú",
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
});
