import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { ReactEventHandler } from "react";
import { ChatMessageList } from "./chat-message-list";
import type { StreamChatMessage } from "@/hooks/use-stream-chat";
import { imageProvenanceFixture } from "@/test/image-provenance-fixture";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "@/lib/image-provenance";

const requestedImageSources = vi.hoisted((): string[] => []);

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
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: ReactEventHandler<HTMLImageElement> }) => {
    requestedImageSources.push(src);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} onError={onError} />
    );
  },
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
    requestedImageSources.length = 0;
    // scrollIntoView is not implemented in jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders empty state when no messages", () => {
    render(<ChatMessageList messages={[]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByText("chat.empty_state")).toBeInTheDocument();
  });

  // UX-M7 (#900): this state copy computed to roughly 2.8:1 contrast against
  // its background at text-white/50 — well below the 4.5:1 AA floor. Raise
  // the floor for state-carrying text specifically (not every low-alpha use).
  it("renders the empty state at a contrast-safe opacity (not text-white/50 or lower)", () => {
    render(<ChatMessageList messages={[]} isLoading={false} onUpsellDismiss={noop} />);
    const emptyState = screen.getByText("chat.empty_state").closest("div");
    expect(emptyState?.className).not.toMatch(/text-white\/(0|10|20|30|40|50)\b/);
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

  it("links official CC-BY attribution to both the dataset and license, retaining the unknown update/year and change notice", () => {
    const citation = { title: "Synthetic official fact", url: "https://www.turismoasturiasprofesional.es/open-data/turismoasturias", license: "CC-BY-4.0", revision: `sha256:${"a".repeat(64)}`,
      attribution: "Administración del Principado de Asturias · actualización no facilitada · año del producto no facilitado · campos sin modificar; selección y redacción propia" };
    const msg = makeMessage({ sources: [{ id: "official-fixture", title: citation.title, snippet: "Synthetic", citation }] });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByRole("link", { name: /Synthetic official fact/ })).toHaveAttribute("href", citation.url);
    expect(screen.getByRole("link", { name: "CC-BY-4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
    expect(screen.getByText(/actualización no facilitada/)).toHaveTextContent(citation.attribution);
    expect(screen.queryByText(/\.pdf|pág\./)).not.toBeInTheDocument();
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

  it("renders a reviewed inline image with its approved alt, credit, source URL and license instead of a PDF label", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "See this",
      images: [
        {
          id: "img-1",
          path: "/images/test.jpg",
          caption: "A lake",
          sourcePdf: "guide.pdf",
          provenance: imageProvenanceFixture("/images/test.jpg", undefined, undefined, { alt: "A lake", credit: "Reviewed synthetic lake credit" }),
        },
      ],
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByAltText("A lake")).toHaveAttribute("src", "/images/test.jpg");
    expect(screen.getByText("A lake")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reviewed synthetic lake credit" })).toHaveAttribute("href", "https://example.com/synthetic-photo-review");
    expect(screen.getByText(/owner-permission/)).toBeInTheDocument();
    expect(screen.getByText(/Imagen temática, no representa el lugar/)).toBeInTheDocument();
    expect(screen.queryByText(/guide\.pdf/)).not.toBeInTheDocument();
    expect(requestedImageSources).toEqual(["/images/test.jpg"]);
  });

  it("renders the reviewed alt even when the cached caption is absent", () => {
    const msg = makeMessage({
      role: "assistant",
      content: "Photo",
      images: [
        {
          id: "img-2",
          path: "/images/other.jpg",
          caption: undefined,
          sourcePdf: "guide.pdf",
          provenance: imageProvenanceFixture("/images/other.jpg", undefined, undefined, { alt: "Reviewed caption-free image" }),
        },
      ],
    });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByAltText("Reviewed caption-free image")).toHaveAttribute("src", "/images/other.jpg");
    expect(screen.queryByText(/guide\.pdf/)).not.toBeInTheDocument();
  });

  it.each(["legacy", "mismatched"] as const)("never requests a raw %s cached photo or displays its unsupported caption/credit", kind => {
    const rawPath = "https://example.com/unreviewed-chat-photo.jpg";
    const msg = makeMessage({ images: [{
      id: "unreviewed-photo", path: rawPath, caption: "Unsupported cached place caption", sourcePdf: "unreviewed-guide.pdf",
      ...(kind === "mismatched" ? { provenance: imageProvenanceFixture("https://example.com/different-reviewed-photo.jpg", undefined, undefined, { credit: "Mismatched synthetic credit", alt: "Mismatched synthetic alt" }) } : {}),
    }] });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    expect(screen.getByRole("img")).toHaveAttribute("alt", NEUTRAL_CREDIT);
    expect(requestedImageSources).toEqual([NEUTRAL_IMAGE]);
    expect(requestedImageSources).not.toContain(rawPath);
    expect(screen.getByText(NEUTRAL_CREDIT)).toBeInTheDocument();
    expect(screen.queryByText("Unsupported cached place caption")).not.toBeInTheDocument();
    expect(screen.queryByText("Mismatched synthetic credit")).not.toBeInTheDocument();
    expect(screen.queryByText("Mismatched synthetic alt")).not.toBeInTheDocument();
    expect(screen.queryByText(/unreviewed-guide\.pdf/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("replaces a failed reviewed photo with the neutral illustration and its credit", () => {
    const path = "/images/reviewed-chat-failure.jpg";
    const msg = makeMessage({ images: [{
      id: "reviewed-failure", path, caption: "Cached caption must not outlive the failed photo", sourcePdf: "old-guide.pdf",
      provenance: imageProvenanceFixture(path, undefined, undefined, { alt: "Reviewed failure-test landscape", credit: "Reviewed failure-test credit" }),
    }] });
    render(<ChatMessageList messages={[msg]} isLoading={false} onUpsellDismiss={noop} />);
    expect(screen.getByAltText("Reviewed failure-test landscape")).toHaveAttribute("src", path);
    expect(screen.getByRole("link", { name: "Reviewed failure-test credit" })).toBeInTheDocument();
    expect(screen.queryByText("Cached caption must not outlive the failed photo")).not.toBeInTheDocument();
    fireEvent.error(screen.getByAltText("Reviewed failure-test landscape"));
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    expect(screen.getByRole("img")).toHaveAttribute("alt", NEUTRAL_CREDIT);
    expect(screen.getByText(NEUTRAL_CREDIT)).toBeInTheDocument();
    expect(screen.queryByText("Reviewed failure-test credit")).not.toBeInTheDocument();
    expect(screen.queryByText("Cached caption must not outlive the failed photo")).not.toBeInTheDocument();
    expect(screen.queryByText(/old-guide\.pdf/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(requestedImageSources).toContain(NEUTRAL_IMAGE);
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
