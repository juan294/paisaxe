import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ChatMessageList } from "./chat-message-list";
import type { StreamChatMessage } from "@/hooks/use-stream-chat";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/components/immersive/skeleton-chat-message", () => ({
  ChatMessageSkeleton: () => <div data-testid="chat-skeleton" />,
}));

vi.mock("@/components/immersive/chat-upsell-cta", () => ({
  ChatUpsellCTA: ({ reason, onDismiss }: { reason: string; onDismiss: () => void }) => (
    <div data-testid="upsell-cta">
      <span>{reason}</span>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

vi.mock("./chat-markdown", () => ({
  ChatMarkdown: ({ content }: { content: string }) => <span>{content}</span>,
}));

const makeMessage = (overrides: Partial<StreamChatMessage> = {}): StreamChatMessage => ({
  id: "msg-1",
  role: "assistant",
  content: "Hello!",
  ...overrides,
});

describe("ChatMessageList", () => {
  const noop = () => {};

  beforeEach(() => {
    // scrollIntoView is not implemented in jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders empty state when no messages", () => {
    render(<ChatMessageList messages={[]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByText("chat.empty_state")).toBeInTheDocument();
  });

  it("renders user message with bubble styling", () => {
    const msg = makeMessage({ role: "user", content: "Hola!" });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByText("Hola!")).toBeInTheDocument();
  });

  it("renders assistant message through ChatMarkdown", () => {
    const msg = makeMessage({ role: "assistant", content: "Bienvenido" });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByText("Bienvenido")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading and last message content is empty", () => {
    const msg = makeMessage({ role: "assistant", content: "" });
    render(<ChatMessageList messages={[msg]} isLoading={true} onUpsellDismiss={noop} />);
    expect(screen.getByTestId("chat-skeleton")).toBeInTheDocument();
  });

  it("does not show skeleton when isLoading but last message has content", () => {
    const msg = makeMessage({ role: "assistant", content: "streaming..." });
    render(<ChatMessageList messages={[msg]} isLoading={true} onUpsellDismiss={noop} />);
    expect(screen.queryByTestId("chat-skeleton")).not.toBeInTheDocument();
  });

  it("does not show skeleton when not loading", () => {
    const msg = makeMessage({ role: "assistant", content: "" });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.queryByTestId("chat-skeleton")).not.toBeInTheDocument();
  });

  it("renders inline images with caption and source", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "See this",
      images: [
        {
          id: "img-1",
          path: "/images/test.jpg",
          caption: "A lake",
          sourcePdf: "guide.pdf",
        },
      ],
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByAltText("A lake")).toBeInTheDocument();
    expect(screen.getByText("A lake")).toBeInTheDocument();
    expect(screen.getByText(/guide\.pdf/)).toBeInTheDocument();
  });

  it("renders image without caption using i18n fallback alt", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "Photo",
      images: [
        {
          id: "img-2",
          path: "/images/other.jpg",
          caption: undefined,
          sourcePdf: "guide.pdf",
        },
      ],
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByAltText("chat.image_alt")).toBeInTheDocument();
  });

  it("renders upsell CTA when upsellReason is set and not dismissed", () => {
    const msg = makeMessage({
      upsellReason: "booking",
      upsellDismissed: false,
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByTestId("upsell-cta")).toBeInTheDocument();
    expect(screen.getByText("booking")).toBeInTheDocument();
  });

  it("does not render upsell CTA when upsellDismissed is true", () => {
    const msg = makeMessage({
      upsellReason: "booking",
      upsellDismissed: true,
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.queryByTestId("upsell-cta")).not.toBeInTheDocument();
  });

  it("calls onUpsellDismiss with the message index when dismiss is clicked", () => {
    const onDismiss = vi.fn();
    const msg = makeMessage({
      id: "msg-0",
      upsellReason: "weather",
      upsellDismissed: false,
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={onDismiss} />);
    screen.getByRole("button", { name: "Dismiss" }).click();
    expect(onDismiss).toHaveBeenCalledWith(0);
  });

  it("has accessible log role and aria-live=polite", () => {
    render(<ChatMessageList messages={[]} isLoading={false} onUpsellDismiss={noop} />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-label", "accessibility.chat_messages");
  });

  it("sets aria-busy=true while loading", () => {
    render(<ChatMessageList messages={[]} isLoading={true} onUpsellDismiss={noop} />);
    expect(screen.getByRole("log")).toHaveAttribute("aria-busy", "true");
  });

  it("sets aria-busy=false when not loading", () => {
    render(<ChatMessageList messages={[]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByRole("log")).toHaveAttribute("aria-busy", "false");
  });

  it("calls scrollIntoView when messages update and container is near bottom", async () => {
    const spy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = spy;

    const { rerender } = render(
      <ChatMessageList messages={[]} isLoading={false} onUpsellDismiss={noop} />
    );

    await act(async () => {
      rerender(
        <ChatMessageList
          messages={[makeMessage({ content: "New message" })]}
          isLoading={false}
          onUpsellDismiss={noop}
        />
      );
    });

    // In jsdom scrollHeight/scrollTop/clientHeight are all 0, so distanceFromBottom = 0 <= 100
    expect(spy).toHaveBeenCalled();
  });

  it("renders multiple messages in order", () => {
    const messages = [
      makeMessage({ id: "1", role: "user", content: "Question" }),
      makeMessage({ id: "2", role: "assistant", content: "Answer" }),
    ];
    render(<ChatMessageList messages={messages} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
  });
});
