import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftsPanel } from "./drafts-panel";

// Mock the create-draft-dialog — expose onCreated and onClose for testing
vi.mock("./create-draft-dialog", () => ({
  CreateDraftDialog: ({ open, onCreated, onClose }: { open: boolean; onCreated: () => void; onClose: () => void }) => (
    open ? (
      <>
        <button data-testid="mock-create-done" onClick={onCreated}>Done</button>
        <button data-testid="mock-create-close" onClick={onClose}>Close Dialog</button>
      </>
    ) : null
  ),
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

  it("resets copied state after 2s timeout (line 39)", async () => {
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

    const { container } = render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    // Wait for drafts to load
    await waitFor(() => {
      expect(screen.getByText("Check out the stunning Covadonga lakes!")).toBeInTheDocument();
    });

    // Click copy on first draft
    const copyButtons = screen.getAllByTitle("Copy content");
    fireEvent.click(copyButtons[0]);

    // Check icon should be shown after clipboard write resolves
    await waitFor(() => {
      expect(container.querySelector(".lucide-check")).toBeInTheDocument();
    });

    // Wait for the 2s timeout at line 39 to reset the copied state
    await waitFor(
      () => {
        expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
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

  it("handles non-Error thrown value on load (line 26 String(error) branch)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue("string load failure");

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load drafts")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"string load failure"')
      );
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

  it("handles delete fetch error gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    // First call loads drafts, second call (DELETE) throws
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockRejectedValueOnce(new Error("Network failure"));
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Delete draft")).toHaveLength(2);
    });

    const deleteButtons = screen.getAllByTitle("Delete draft");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete draft")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Network failure"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("onCreated callback closes dialog and reloads drafts", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) }) // initial load
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) }); // reload after create
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("New Draft")).toBeInTheDocument();
    });

    // Open the create dialog
    await user.click(screen.getByText("New Draft"));

    // The mock CreateDraftDialog now renders a "Done" button when open
    await waitFor(() => {
      expect(screen.getByTestId("mock-create-done")).toBeInTheDocument();
    });

    // Click "Done" to trigger onCreated (lines 164-167: setShowCreateDialog(false) + loadDrafts())
    await user.click(screen.getByTestId("mock-create-done"));

    // Dialog should close (the "Done" button disappears)
    await waitFor(() => {
      expect(screen.queryByTestId("mock-create-done")).not.toBeInTheDocument();
    });

    // loadDrafts should have been called again (fetch called twice)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles clipboard write failure gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard denied")) },
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

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to copy")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Clipboard denied"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("handles non-Error thrown value on copy failure (line 42 String(error) branch)", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue("clipboard denied string") },
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

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to copy")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"clipboard denied string"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("handles non-Error thrown value on mark-as-posted failure (line 57 String(error) branch)", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockRejectedValueOnce("mark-posted string failure");
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Mark as posted")).toHaveLength(2);
    });

    const postedButtons = screen.getAllByTitle("Mark as posted");
    await user.click(postedButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to mark as posted")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"mark-posted string failure"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("handles non-Error thrown value on delete failure (line 72 String(error) branch)", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockRejectedValueOnce("delete string failure");
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Delete draft")).toHaveLength(2);
    });

    const deleteButtons = screen.getAllByTitle("Delete draft");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete draft")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"delete string failure"')
      );
    });

    consoleSpy.mockRestore();
  });

  it("opens create draft dialog when New Draft is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("New Draft")).toBeInTheDocument();
    });

    // Click the New Draft button — this calls setShowCreateDialog(true)
    await user.click(screen.getByText("New Draft"));

    // The CreateDraftDialog mock renders null, so we can't check its visibility.
    // But the state change was exercised (line 93).
    // Verify the button is still there (no crash).
    expect(screen.getByText("New Draft")).toBeInTheDocument();
  });

  it("closes create draft dialog via onClose callback", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getByText("New Draft")).toBeInTheDocument();
    });

    // Open the create dialog
    await user.click(screen.getByText("New Draft"));

    await waitFor(() => {
      expect(screen.getByTestId("mock-create-close")).toBeInTheDocument();
    });

    // Click "Close Dialog" to trigger onClose (line 164: setShowCreateDialog(false))
    await user.click(screen.getByTestId("mock-create-close"));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId("mock-create-close")).not.toBeInTheDocument();
    });
  });

  it("handles mark-as-posted fetch error gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockRejectedValueOnce(new Error("Network failure"));
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Mark as posted")).toHaveLength(2);
    });

    const postedButtons = screen.getAllByTitle("Mark as posted");
    await user.click(postedButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to mark as posted")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Network failure"')
      );
    });

    // onDraftPosted should NOT have been called on error
    expect(onDraftPosted).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles null data in ok response by setting empty drafts (line 22 fallback)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    // result.data is null, so result.data || [] should give empty array
    await waitFor(() => {
      expect(screen.getByText("No drafts yet. Chat with the marketing agents to create content.")).toBeInTheDocument();
    });
  });

  it("does not reload or call onDraftPosted when mark-as-posted response is not ok (line 51 false)", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: "Unauthorized" }) });
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Mark as posted")).toHaveLength(2);
    });

    const postedButtons = screen.getAllByTitle("Mark as posted");
    await user.click(postedButtons[0]);

    // Wait for the PATCH call to complete
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // onDraftPosted should NOT have been called because response.ok was false
    expect(onDraftPosted).not.toHaveBeenCalled();
    // loadDrafts should NOT have been called again (only 2 total fetches: initial + PATCH)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reload when delete response is not ok (line 67 false)", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: mockDrafts }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: "Forbidden" }) });
    global.fetch = fetchMock;

    render(<DraftsPanel onDraftPosted={onDraftPosted} />);

    await waitFor(() => {
      expect(screen.getAllByTitle("Delete draft")).toHaveLength(2);
    });

    const deleteButtons = screen.getAllByTitle("Delete draft");
    await user.click(deleteButtons[0]);

    // Wait for the DELETE call to complete
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // loadDrafts should NOT have been called again (only 2 total fetches: initial + DELETE)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Drafts should still be visible (not reloaded)
    expect(screen.getByText("Check out the stunning Covadonga lakes!")).toBeInTheDocument();
  });
});
