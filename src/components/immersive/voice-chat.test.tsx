import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceChat } from "./voice-chat";
import { Story } from "@/types/immersive";
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

// Mutable mock state for useVoiceAccess
const mockVoiceAccess = {
  canUseVoice: false,
  needsSignIn: false,
  needsPurchase: false,
  agentId: "",
  expiresAt: null as Date | null,
  hoursUntilExpiry: null as number | null,
  isLoading: false,
  isWhitelisted: false,
  hasAccess: false,
  refresh: vi.fn(),
};

// Mock useVoiceAccess hook
vi.mock("@/hooks/use-voice-access", () => ({
  useVoiceAccess: () => mockVoiceAccess,
}));

// Mock PostHog
const mockCapture = vi.fn();
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

// Mock Supabase browser client
vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// Mock VoiceChatElevenLabs component (to avoid navigator.mediaDevices issues in tests)
vi.mock("./voice-chat-elevenlabs", () => ({
  VoiceChatElevenLabs: ({ story }: { story: { title: string } }) => (
    <div data-testid="elevenlabs-voice-chat">
      Voice chat active for {story.title}
    </div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Helper to create a mock streaming response.
 * Simulates SSE events for the streaming chat endpoint.
 */
function createStreamingResponse(message: string, images: unknown[] = []) {
  const encoder = new TextEncoder();

  // Create SSE events for each word (simulating streaming)
  const words = message.split(" ");
  const events: Uint8Array[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = i === 0 ? words[i] : " " + words[i];
    const event = `data: ${JSON.stringify({ type: "text", content: word })}\n\n`;
    events.push(encoder.encode(event));
  }

  // Final event with images
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

const mockStory: Story = {
  id: "story-1",
  title: "Lagos de Covadonga",
  subtitle: "Picos de Europa",
  description: "Beautiful glacial lakes in the mountains",
  image: "/images/lagos.jpg",
  category: "nature",
  sourcePdf: "nature-guide.pdf",
};

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

// Mock VoicePurchaseCTA component
vi.mock("@/components/premium/voice-purchase-cta", () => ({
  VoicePurchaseCTA: () => (
    <div data-testid="voice-purchase-cta">
      Purchase voice access
    </div>
  ),
}));

// Helper to reset mock voice access state
const resetMockVoiceAccess = () => {
  mockVoiceAccess.canUseVoice = false;
  mockVoiceAccess.needsSignIn = false;
  mockVoiceAccess.needsPurchase = false;
  mockVoiceAccess.agentId = "";
  mockVoiceAccess.expiresAt = null;
  mockVoiceAccess.hoursUntilExpiry = null;
  mockVoiceAccess.isLoading = false;
  mockVoiceAccess.isWhitelisted = false;
  mockVoiceAccess.hasAccess = false;
};

describe("VoiceChat", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockCapture.mockReset();
    localStorageMock.clear();
    resetMockVoiceAccess();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should not render when closed", () => {
      const { container } = render(
        <VoiceChat story={mockStory} open={false} onClose={() => {}} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render when open", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
    });

    it("should show placeholder text when no messages", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByText("Pregunta lo que quieras sobre este lugar")
      ).toBeInTheDocument();
    });

    it("should render close button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      // Look for the X icon in the close button by finding button with X svg
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-x");
      });
      expect(closeButton).toBeInTheDocument();
    });

    it("should render input field", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByPlaceholderText("Escribe tu pregunta...")
      ).toBeInTheDocument();
    });

    it("should have aria-label on chat input", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      expect(input).toHaveAttribute("aria-label", "Escribe tu pregunta...");
    });

    it("should render submit button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const submitButton = buttons.find((btn) =>
        btn.getAttribute("type") === "submit"
      );
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe("close functionality", () => {
    it("should call onClose when close button is clicked", () => {
      const onClose = vi.fn();
      render(<VoiceChat story={mockStory} open={true} onClose={onClose} />);

      // Look for the X icon close button
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-x");
      });

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it("should call onClose when clicking backdrop", () => {
      const onClose = vi.fn();
      render(<VoiceChat story={mockStory} open={true} onClose={onClose} />);

      const backdrop = document.querySelector(".bg-black\\/60");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe("message sending", () => {
    it("should send message on form submit", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Response from AI"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Tell me about the lakes");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("Tell me about the lakes"),
        });
      });
    });

    it("should display user message after sending", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Response from AI"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "My question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("My question")).toBeInTheDocument();
      });
    });

    it("should display assistant response", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("This is the AI response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("This is the AI response")).toBeInTheDocument();
      });
    });

    it("should show skeleton loading indicator while waiting for response", async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        // Should show a skeleton message bubble with role="status"
        const skeleton = screen.getByRole("status");
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveAttribute("aria-label", "Loading");
      });

      // Resolve and wait for state update to complete
      await act(async () => {
        resolvePromise!(createStreamingResponse("Done"));
      });
    });

    it("should display error message on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Lo siento, hubo un error. Intenta de nuevo.")
        ).toBeInTheDocument();
      });
    });

    it("should display fallback message when streaming returns error event", async () => {
      // Create an error stream response
      const encoder = new TextEncoder();
      const errorEvent = `data: ${JSON.stringify({ type: "error", message: "Error" })}\n\n`;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: stream,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Lo siento, hubo un error. Intenta de nuevo.")
        ).toBeInTheDocument();
      });
    });

    it("should not submit empty message", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      const form = input.closest("form");

      if (form) {
        fireEvent.submit(form);
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not submit whitespace-only message", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "   ");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should clear input after sending message", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...") as HTMLInputElement;
      await userEvent.type(input, "My question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("should include story context in API request", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.context).toContain("Lagos de Covadonga");
        expect(callBody.context).toContain("Picos de Europa");
        expect(callBody.context).toContain("nature-guide.pdf");
      });
    });
  });

  describe("story change", () => {
    it("should reset messages when story changes", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("First response"));

      const { rerender } = render(
        <VoiceChat story={mockStory} open={true} onClose={() => {}} />
      );

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("First response")).toBeInTheDocument();
      });

      // Change story
      const newStory: Story = {
        ...mockStory,
        id: "story-2",
        title: "Different Story",
      };

      rerender(<VoiceChat story={newStory} open={true} onClose={() => {}} />);

      // Messages should be cleared
      expect(screen.queryByText("First response")).not.toBeInTheDocument();
      expect(screen.queryByText("Question")).not.toBeInTheDocument();
    });
  });

  describe("submit button state", () => {
    it("should disable submit button when input is empty", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const submitButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("type") === "submit");

      expect(submitButton).toBeDisabled();
    });

    it("should enable submit button when input has text", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Some text");

      const submitButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("type") === "submit");

      expect(submitButton).not.toBeDisabled();
    });

    it("should disable submit button while loading", async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const submitButton = screen
          .getAllByRole("button")
          .find((btn) => btn.getAttribute("type") === "submit");
        expect(submitButton).toBeDisabled();
      });

      // Resolve and wait for state update to complete
      await act(async () => {
        resolvePromise!(createStreamingResponse("Done"));
      });
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Lo siento, hubo un error. Intenta de nuevo.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("message styling", () => {
    it("should style user messages differently from assistant messages", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("AI response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "User message");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const userMsg = screen.getByText("User message");
        const aiMsg = screen.getByText("AI response");

        expect(userMsg.closest("div")).toHaveClass("ml-auto", "bg-white");
        expect(aiMsg.closest("div")).toHaveClass("bg-white/20");
      });
    });
  });

  describe("privacy notice", () => {
    it("should show privacy notice on first open", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByText(/Tus preguntas se procesan con inteligencia artificial/)
      ).toBeInTheDocument();
    });

    it("should hide privacy notice after dismissal", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      fireEvent.click(screen.getByText("Entendido"));

      expect(
        screen.queryByText(/Tus preguntas se procesan con inteligencia artificial/)
      ).not.toBeInTheDocument();
    });

    it("should store dismissal in localStorage", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      fireEvent.click(screen.getByText("Entendido"));

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "paisaxe-privacy-acknowledged",
        "true"
      );
    });

    it("should not show notice if already acknowledged", () => {
      localStorageMock.getItem.mockReturnValue("true");

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.queryByText(/Tus preguntas se procesan con inteligencia artificial/)
      ).not.toBeInTheDocument();
    });
  });

  describe("PostHog chat tracking", () => {
    it("should fire chat_conversation_started on first message", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "First question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockCapture).toHaveBeenCalledWith("chat_conversation_started", {
          story_id: "story-1",
        });
      });
    });

    it("should fire chat_message_sent on every message", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "My question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockCapture).toHaveBeenCalledWith("chat_message_sent", {
          story_id: "story-1",
          message_index: 0,
        });
      });
    });

    it("should not fire chat_conversation_started on subsequent messages", async () => {
      // First message
      mockFetch.mockResolvedValueOnce(createStreamingResponse("First response"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "First");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("First response")).toBeInTheDocument();
      });

      // Second message
      mockCapture.mockClear();
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Second response"));

      await userEvent.type(input, "Second");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("Second response")).toBeInTheDocument();
      });

      // Should have chat_message_sent but NOT chat_conversation_started
      expect(mockCapture).toHaveBeenCalledWith("chat_message_sent", expect.any(Object));
      expect(mockCapture).not.toHaveBeenCalledWith("chat_conversation_started", expect.any(Object));
    });
  });

  describe("chat response images", () => {
    it("should display images from chat response", async () => {
      mockFetch.mockResolvedValueOnce(
        createStreamingResponse("Here are some beautiful lakes.", [
          {
            id: "img-1",
            path: "https://example.supabase.co/storage/v1/images/lagos.jpg",
            caption: "Lagos de Covadonga at sunset",
            sourcePdf: "nature-guide.pdf",
          },
        ])
      );

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Show me the lakes");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const img = screen.getByRole("img", { name: "Lagos de Covadonga at sunset" });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", "https://example.supabase.co/storage/v1/images/lagos.jpg");
      });
    });

    it("should display image caption when available", async () => {
      mockFetch.mockResolvedValueOnce(
        createStreamingResponse("Beautiful place.", [
          {
            id: "img-1",
            path: "https://example.supabase.co/storage/v1/images/lagos.jpg",
            caption: "Picos de Europa mountain view",
            sourcePdf: "nature-guide.pdf",
          },
        ])
      );

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("Picos de Europa mountain view")).toBeInTheDocument();
      });
    });

    it("should display source attribution for images", async () => {
      mockFetch.mockResolvedValueOnce(
        createStreamingResponse("A lovely area.", [
          {
            id: "img-1",
            path: "https://example.supabase.co/storage/v1/images/test.jpg",
            caption: "Test image",
            sourcePdf: "hiking-guide.pdf",
          },
        ])
      );

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText(/hiking-guide\.pdf/)).toBeInTheDocument();
      });
    });

    it("should display multiple images from chat response", async () => {
      mockFetch.mockResolvedValueOnce(
        createStreamingResponse("Here are several views.", [
          {
            id: "img-1",
            path: "https://example.supabase.co/storage/v1/images/img1.jpg",
            caption: "First image",
            sourcePdf: "guide-1.pdf",
          },
          {
            id: "img-2",
            path: "https://example.supabase.co/storage/v1/images/img2.jpg",
            caption: "Second image",
            sourcePdf: "guide-2.pdf",
          },
        ])
      );

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Show me views");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const images = screen.getAllByRole("img");
        expect(images.length).toBe(2);
        expect(screen.getByText("First image")).toBeInTheDocument();
        expect(screen.getByText("Second image")).toBeInTheDocument();
      });
    });

    it("should handle response with no images gracefully", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("No images for this response."));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("No images for this response.")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
      });
    });

    it("should handle response with empty images array gracefully", async () => {
      mockFetch.mockResolvedValueOnce(createStreamingResponse("Empty images array.", []));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("Empty images array.")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
      });
    });

    it("should use fallback alt text when image has no caption", async () => {
      mockFetch.mockResolvedValueOnce(
        createStreamingResponse("Image without caption.", [
          {
            id: "img-1",
            path: "https://example.supabase.co/storage/v1/images/no-caption.jpg",
            sourcePdf: "guide.pdf",
          },
        ])
      );

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const img = screen.getByRole("img");
        expect(img).toBeInTheDocument();
        // Should have a meaningful alt text even without caption
        expect(img.getAttribute("alt")).toBeTruthy();
        expect(img.getAttribute("alt")).not.toBe("");
      });
    });
  });
});

// Separate test suite with voice access enabled
describe("VoiceChat with voice access", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
    // Enable voice access for these tests
    mockVoiceAccess.canUseVoice = true;
    mockVoiceAccess.needsSignIn = false;
    mockVoiceAccess.needsPurchase = false;
    mockVoiceAccess.agentId = "test-agent-id";
    mockVoiceAccess.expiresAt = null;
    mockVoiceAccess.hoursUntilExpiry = null;
    mockVoiceAccess.isLoading = false;
    mockVoiceAccess.isWhitelisted = true;
    mockVoiceAccess.hasAccess = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetMockVoiceAccess();
  });

  it("should default to voice mode when user has voice access", async () => {
    render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

    // When voice is active by default, the ElevenLabs voice chat should be rendered
    await waitFor(() => {
      expect(screen.getByTestId("elevenlabs-voice-chat")).toBeInTheDocument();
    });

    // The toggle button should show keyboard icon (to switch TO text)
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      const toggleButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-keyboard");
      });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  it("should allow switching to text mode when voice is default", async () => {
    render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

    // Verify voice mode is active by default
    await waitFor(() => {
      expect(screen.getByTestId("elevenlabs-voice-chat")).toBeInTheDocument();
    });

    // Click the toggle to switch to text mode
    const buttons = screen.getAllByRole("button");
    const toggleButton = buttons.find((btn) => {
      const svg = btn.querySelector("svg");
      return svg?.classList.contains("lucide-keyboard");
    });

    expect(toggleButton).toBeInTheDocument();
    if (toggleButton) {
      fireEvent.click(toggleButton);
    }

    // Now voice chat should be gone and text input should appear
    await waitFor(() => {
      expect(screen.queryByTestId("elevenlabs-voice-chat")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Escribe tu pregunta...")).toBeInTheDocument();
    });
  });
});
