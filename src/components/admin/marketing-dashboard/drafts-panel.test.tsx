import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DraftsPanel } from "./drafts-panel";

// Mock the create-draft-dialog
vi.mock("./create-draft-dialog", () => ({
  CreateDraftDialog: () => null,
}));

const mockDrafts = [
  {
    id: "d1",
    platform: "x" as const,
    content: "Check out the stunning Covadonga lakes!",
    hashtags: ["#Asturias", "#Travel"],
    status: "draft" as const,
    scheduledAt: null,
    publishedAt: null,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "d2",
    platform: "instagram" as const,
    content: "Golden hour at Playa de Gulpiyuri",
    hashtags: [],
    status: "draft" as const,
    scheduledAt: null,
    publishedAt: null,
    createdAt: "2024-01-14T10:00:00Z",
  },
];

describe("DraftsPanel", () => {
  const onDraftPosted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("displays draft count", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDrafts }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("2 drafts ready to post")).toBeInTheDocument();
    });
  });

  it("displays draft content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDrafts }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("Check out the stunning Covadonga lakes!")).toBeInTheDocument();
    });

    expect(screen.getByText("Golden hour at Playa de Gulpiyuri")).toBeInTheDocument();
  });

  it("displays hashtags", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDrafts }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("#Asturias #Travel")).toBeInTheDocument();
    });
  });

  it("shows empty state when no drafts", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("No drafts yet. Chat with the marketing agents to create content.")).toBeInTheDocument();
    });
  });

  it("renders New Draft button", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("New Draft")).toBeInTheDocument();
    });
  });

  it("renders action buttons for each draft", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDrafts }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      // "Posted" buttons for marking as posted
      const postedButtons = screen.getAllByText("Posted");
      expect(postedButtons).toHaveLength(2);
    });
  });
});
