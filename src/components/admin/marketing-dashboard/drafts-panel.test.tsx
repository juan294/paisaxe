import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftsPanel } from "./drafts-panel";

// Mock the create-draft-dialog
vi.mock("./create-draft-dialog", () => ({
  CreateDraftDialog: () => null,
}));

// Mock csrfHeaders
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "x-csrf-token": "test-token" }),
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

  it("copies content to clipboard on copy click", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDrafts }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("Check out the stunning Covadonga lakes!")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle("Copy content");
    await user.click(copyButtons[0]);

    expect(writeText).toHaveBeenCalledWith("Check out the stunning Covadonga lakes!");
  });

  it("marks draft as posted and reloads", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // PATCH mark-posted
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) }); // reload
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByText("Posted")).toHaveLength(2);
    });

    const postedButtons = screen.getAllByTitle("Mark as posted");
    await user.click(postedButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("action=mark-posted"),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    expect(onDraftPosted).toHaveBeenCalled();
  });

  it("deletes draft after confirm and reloads", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) }); // reload
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Delete draft")).toHaveLength(2);
    });

    const deleteButtons = screen.getAllByTitle("Delete draft");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("id=d1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("does not delete when confirm is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDrafts }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Delete draft")).toHaveLength(2);
    });

    const deleteButtons = screen.getAllByTitle("Delete draft");
    await user.click(deleteButtons[0]);

    // Only the initial load fetch should have been called
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    // Should finish loading and show empty state
    await waitFor(() => {
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).not.toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("handles non-ok response gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    // Should finish loading and show empty state (no drafts loaded)
    await waitFor(() => {
      expect(screen.getByText("No drafts yet. Chat with the marketing agents to create content.")).toBeInTheDocument();
    });
  });

  it("shows singular draft count for one draft", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [mockDrafts[0]] }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("1 draft ready to post")).toBeInTheDocument();
    });
  });
});
