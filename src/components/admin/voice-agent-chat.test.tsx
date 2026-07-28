import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceAgentChat } from "./voice-agent-chat";

// Mock the ElevenLabs SDK
const mockUseConversation = vi.fn();
const mockSetMuted = vi.fn();
const mockStartSession = vi.fn();

vi.mock("@elevenlabs/react", () => ({
  useConversation: () => mockUseConversation(),
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn().mockRejectedValue(new Error("Permission denied"));
Object.defineProperty(navigator, "mediaDevices", {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

describe("VoiceAgentChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConversation.mockReturnValue({
      status: "disconnected",
      isSpeaking: false,
      startSession: mockStartSession,
      endSession: vi.fn(),
      sendUserMessage: vi.fn(),
      setMuted: mockSetMuted,
    });
    mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ signedUrl: "wss://signed.example/admin" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  it("renders agent selector with three agents", () => {
    render(<VoiceAgentChat />);

    expect(screen.getAllByText("Xander").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Iris").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Penny").length).toBeGreaterThanOrEqual(1);
  });

  it("shows platform badges for agents", () => {
    render(<VoiceAgentChat />);

    // Platform badges: X, IG, Pi
    expect(screen.getAllByText("X").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IG").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pi").length).toBeGreaterThanOrEqual(1);
  });

  it("renders voice/text mode toggle", () => {
    render(<VoiceAgentChat />);

    expect(screen.getByText("Switch to Text")).toBeInTheDocument();
    expect(screen.getByText("Voice Mode")).toBeInTheDocument();
  });

  it("switches to text mode", async () => {
    const user = userEvent.setup();
    render(<VoiceAgentChat />);

    await user.click(screen.getByText("Switch to Text"));

    expect(screen.getByText("Text Mode")).toBeInTheDocument();
    expect(screen.getByText("Switch to Voice")).toBeInTheDocument();
  });

  it("shows empty chat message area", () => {
    render(<VoiceAgentChat />);

    expect(screen.getByText(/Click "Start Call" to begin/)).toBeInTheDocument();
  });

  it("shows text input area", () => {
    render(<VoiceAgentChat />);

    expect(screen.getByPlaceholderText("Message Xander...")).toBeInTheDocument();
  });

  it("renders voice config warning when no agentIds", () => {
    render(<VoiceAgentChat />);

    expect(screen.getByText("Voice not configured. Run the setup script first, or use text mode.")).toBeInTheDocument();
  });

  it("shows Start Call button disabled when no voice config", () => {
    render(<VoiceAgentChat />);

    const startButton = screen.getByText("Start Call");
    expect(startButton.closest("button")).toBeDisabled();
  });

  it("renders text mode with correct placeholder on switch", async () => {
    const user = userEvent.setup();
    render(<VoiceAgentChat />);

    await user.click(screen.getByText("Switch to Text"));

    expect(
      screen.getByText(/Start a conversation with Xander/)
    ).toBeInTheDocument();
  });

  it("disables agent switching buttons in disconnected state", () => {
    render(<VoiceAgentChat />);

    // When disconnected, agent buttons should not be disabled
    const xanderButton = screen.getAllByText("Xander")[0].closest("button");
    expect(xanderButton).not.toBeDisabled();
  });

  it("switches selected agent", async () => {
    const user = userEvent.setup();
    render(<VoiceAgentChat />);

    await user.click(screen.getByText("Iris"));

    expect(screen.getByPlaceholderText("Message Iris...")).toBeInTheDocument();
  });

  it("calls the ElevenLabs mute control when toggling mute during a call", async () => {
    const user = userEvent.setup();
    mockUseConversation.mockReturnValue({
      status: "connected",
      isSpeaking: false,
      startSession: vi.fn(),
      endSession: vi.fn(),
      sendUserMessage: vi.fn(),
      setMuted: mockSetMuted,
    });

    render(<VoiceAgentChat agentIds={{ xander: "agent-admin" }} />);

    await user.click(screen.getByRole("button", { name: "Mute microphone" }));
    expect(mockSetMuted).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Unmute microphone" }));
    expect(mockSetMuted).toHaveBeenLastCalledWith(false);
  });

  it("starts an allowlisted admin agent through a signed session", async () => {
    const user = userEvent.setup();
    mockGetUserMedia.mockResolvedValue({} as MediaStream);

    render(<VoiceAgentChat agentIds={{ xander: "agent-admin" }} />);

    await user.click(screen.getByRole("button", { name: "Start Call" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/voice-session",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ agentKey: "xander" }),
        })
      );
      expect(mockStartSession).toHaveBeenCalledWith({
        signedUrl: "wss://signed.example/admin",
        connectionType: "websocket",
      });
    });
    expect(mockStartSession.mock.calls[0][0]).not.toHaveProperty("agentId");
  });
});
