import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateDraftDialog } from "./create-draft-dialog";

// Mock csrfHeaders
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "x-csrf-token": "test-token" }),
}));

describe("CreateDraftDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog when open is true", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("Create Draft")).toBeInTheDocument();
    expect(
      screen.getByText("Create a new content draft for manual posting")
    ).toBeInTheDocument();
  });

  it("renders platform selector with X, Instagram, Pinterest", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("IG")).toBeInTheDocument();
    expect(screen.getByText("Pi")).toBeInTheDocument();
  });

  it("defaults to X platform", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    // Check the placeholder text references X (Twitter)
    expect(
      screen.getByPlaceholderText("Write your X (Twitter) post...")
    ).toBeInTheDocument();
  });

  it("shows character counter starting at 0/280 for X", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("0/280")).toBeInTheDocument();
  });

  it("updates character counter as user types", async () => {
    const user = userEvent.setup();
    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Hello!");

    expect(screen.getByText("6/280")).toBeInTheDocument();
  });

  it("switches to Instagram with 2200 char limit", async () => {
    const user = userEvent.setup();
    render(<CreateDraftDialog {...defaultProps} />);

    await user.click(screen.getByText("IG"));

    expect(
      screen.getByPlaceholderText("Write your Instagram post...")
    ).toBeInTheDocument();
    expect(screen.getByText("0/2200")).toBeInTheDocument();
  });

  it("switches to Pinterest with 500 char limit", async () => {
    const user = userEvent.setup();
    render(<CreateDraftDialog {...defaultProps} />);

    await user.click(screen.getByText("Pi"));

    expect(
      screen.getByPlaceholderText("Write your Pinterest post...")
    ).toBeInTheDocument();
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("applies red color to counter when content exceeds max length", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    // Use fireEvent.change for long strings to avoid slow userEvent.type
    fireEvent.change(textarea, { target: { value: "a".repeat(281) } });

    const counterElement = screen.getByText("281/280");
    expect(counterElement.className).toContain("text-red-500");
  });

  it("does not apply red color when at exactly max length", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    fireEvent.change(textarea, { target: { value: "a".repeat(280) } });

    const counterElement = screen.getByText("280/280");
    expect(counterElement.className).not.toContain("text-red-500");
  });

  it("renders Cancel and Save Draft buttons", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save Draft")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<CreateDraftDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error when saving with empty content", async () => {
    const user = userEvent.setup();

    render(<CreateDraftDialog {...defaultProps} />);

    await user.click(screen.getByText("Save Draft"));

    expect(screen.getByText("Content is required")).toBeInTheDocument();
  });

  it("shows error when saving with whitespace-only content", async () => {
    const user = userEvent.setup();

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    // Use fireEvent.change to set whitespace value directly
    fireEvent.change(textarea, { target: { value: "   " } });

    await user.click(screen.getByText("Save Draft"));

    expect(screen.getByText("Content is required")).toBeInTheDocument();
  });

  it("saves draft successfully and calls onCreated", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "draft-1" } }),
    });

    render(
      <CreateDraftDialog {...defaultProps} onCreated={onCreated} />
    );

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Beautiful Asturias morning!");

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/marketing/posts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-csrf-token": "test-token",
        }),
      })
    );
  });

  it("sends correct platform and trimmed content in request body", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "draft-1" } }),
    });

    render(<CreateDraftDialog {...defaultProps} />);

    // Switch to Instagram
    await user.click(screen.getByText("IG"));

    const textarea = screen.getByPlaceholderText("Write your Instagram post...");
    // Use fireEvent.change for direct value setting to avoid timing issues
    fireEvent.change(textarea, { target: { value: "  Beautiful Asturias  " } });

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.platform).toBe("instagram");
    expect(body.content).toBe("Beautiful Asturias");
  });

  it("clears content after successful save", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "draft-1" } }),
    });

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test content");

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("shows error when API returns non-ok response", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Rate limit exceeded" }),
    });

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test");

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
    });
  });

  it("shows fallback error when API returns no error message", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test");

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(screen.getByText("Failed to create draft")).toBeInTheDocument();
    });
  });

  it("shows error when fetch throws an Error", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test");

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(screen.getByText("Network down")).toBeInTheDocument();
    });
  });

  it("shows 'Unknown error' when catch receives non-Error", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValue("some string");

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test");

    await user.click(screen.getByText("Save Draft"));

    await waitFor(() => {
      expect(screen.getByText("Unknown error")).toBeInTheDocument();
    });
  });

  it("disables Save Draft button while saving", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test content");

    await user.click(screen.getByText("Save Draft"));

    // Save button should be disabled, showing spinner
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("disables Save Draft button when content exceeds max length", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    fireEvent.change(textarea, { target: { value: "a".repeat(281) } });

    const saveButton = screen.getByText("Save Draft");
    expect(saveButton.closest("button")).toBeDisabled();
  });

  it("clears error on new save attempt", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "draft-1" } }),
      });

    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    await user.type(textarea, "Test");

    // First attempt - error
    await user.click(screen.getByText("Save Draft"));
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    // Second attempt - error should clear
    await user.click(screen.getByText("Save Draft"));
    await waitFor(() => {
      expect(screen.queryByText("Server error")).not.toBeInTheDocument();
    });
  });

  it("renders textarea with correct rows attribute", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    expect(textarea).toHaveAttribute("rows", "5");
  });

  it("preserves content when switching platforms", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Write your X (Twitter) post...");
    // Use fireEvent.change for direct value setting to avoid platform button interference
    fireEvent.change(textarea, { target: { value: "My cross-platform content" } });

    // Switch to Pinterest using fireEvent to avoid timing issues
    fireEvent.click(screen.getByText("Pi"));

    // Content should be preserved
    const pinterestTextarea = screen.getByPlaceholderText("Write your Pinterest post...");
    expect(pinterestTextarea).toHaveValue("My cross-platform content");
  });

  it("updates max length display when switching platforms", async () => {
    const user = userEvent.setup();

    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("0/280")).toBeInTheDocument();

    await user.click(screen.getByText("IG"));
    expect(screen.getByText("0/2200")).toBeInTheDocument();

    await user.click(screen.getByText("Pi"));
    expect(screen.getByText("0/500")).toBeInTheDocument();

    await user.click(screen.getByText("X"));
    expect(screen.getByText("0/280")).toBeInTheDocument();
  });

  it("shows Platform label", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("shows Content label", () => {
    render(<CreateDraftDialog {...defaultProps} />);

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("calls onClose when dialog is closed via onOpenChange", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CreateDraftDialog {...defaultProps} onClose={onClose} />
    );

    // The dialog has a close button (X) provided by DialogContent
    // which triggers onOpenChange(false) -> onClose()
    const closeButton = screen.getByRole("button", { name: /close/i });
    if (closeButton) {
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
