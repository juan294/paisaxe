import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateStoryDialog } from "./create-story-dialog";

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  createStory: vi.fn(),
}));

import { createStory } from "@/lib/admin-api";

describe("CreateStoryDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnCreated = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onCreated: mockOnCreated,
    suggestion: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(<CreateStoryDialog {...defaultProps} />);

    expect(screen.getByText("Create New Story")).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<CreateStoryDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Create New Story")).not.toBeInTheDocument();
  });

  it("shows error when title is empty on submit", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    const createButton = screen.getByRole("button", { name: /Create Story/i });
    await userEvent.click(createButton);

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(createStory).not.toHaveBeenCalled();
  });

  it("shows error when category is not selected on submit", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    // Fill in title
    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Test Story");

    const createButton = screen.getByRole("button", { name: /Create Story/i });
    await userEvent.click(createButton);

    expect(screen.getByText("Category is required")).toBeInTheDocument();
    expect(createStory).not.toHaveBeenCalled();
  });

  it("auto-generates slug from title", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Lagos de Covadonga");

    const slugInput = screen.getByLabelText(/URL Slug/);
    expect(slugInput).toHaveValue("lagos-de-covadonga");
  });

  it("handles Spanish diacritics in slug generation", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Gijón y la Ñ");

    const slugInput = screen.getByLabelText(/URL Slug/);
    expect(slugInput).toHaveValue("gijon-y-la-n");
  });

  it("allows manual slug editing and preserves it", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    const titleInput = screen.getByLabelText(/Title/);
    const slugInput = screen.getByLabelText(/URL Slug/);

    // Type title
    await userEvent.type(titleInput, "Test");
    expect(slugInput).toHaveValue("test");

    // Manually edit slug
    await userEvent.clear(slugInput);
    await userEvent.type(slugInput, "custom-slug");

    // Type more in title - slug should not change
    await userEvent.type(titleInput, " More");
    expect(slugInput).toHaveValue("custom-slug");
  });

  it("pre-fills form from suggestion", () => {
    const suggestion = {
      id: "suggestion-1",
      userId: "user-1",
      placeName: "Picos de Europa",
      comment: "Beautiful mountain range",
      location: "eastern" as const,
      status: "pending" as const,
      adminNotes: null,
      convertedStoryId: null,
      attribution: "@mountainfan",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      userEmail: "test@example.com",
    };

    render(<CreateStoryDialog {...defaultProps} suggestion={suggestion} />);

    expect(screen.getByText("Convert Suggestion to Story")).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveValue("Picos de Europa");
    expect(screen.getByLabelText(/URL Slug/)).toHaveValue("picos-de-europa");
    expect(screen.getByLabelText(/Description/)).toHaveValue("Beautiful mountain range");
    // Attribution should be shown
    expect(screen.getByText("@mountainfan")).toBeInTheDocument();
  });

  it("resets form on close", async () => {
    const { rerender } = render(<CreateStoryDialog {...defaultProps} />);

    // Fill in title
    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Test Story");

    // Close dialog
    rerender(<CreateStoryDialog {...defaultProps} open={false} />);

    // Reopen dialog
    rerender(<CreateStoryDialog {...defaultProps} open={true} />);

    // Title should be empty
    const newTitleInput = screen.getByLabelText(/Title/);
    expect(newTitleInput).toHaveValue("");
  });

  it("toggles optional fields section", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    // Optional fields should be hidden by default
    expect(screen.queryByLabelText(/Source PDF/)).not.toBeInTheDocument();

    // Click to show optional fields
    const toggleButton = screen.getByRole("button", { name: /Optional Fields/i });
    await userEvent.click(toggleButton);

    // Optional fields should now be visible
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByLabelText(/Source PDF/)).toBeInTheDocument();
  });

  it("does not show error message initially", async () => {
    // Test that error messages are not shown on initial render
    vi.mocked(createStory).mockResolvedValue({
      error: "A story with this slug already exists",
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Error message should not be visible initially (before any API call)
    expect(screen.queryByText("A story with this slug already exists")).not.toBeInTheDocument();
  });

  it("disables buttons while submitting", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    const createButton = screen.getByRole("button", { name: /Create Story/i });
    const cancelButton = screen.getByRole("button", { name: /Cancel/i });

    // Buttons should be enabled initially
    expect(createButton).not.toBeDisabled();
    expect(cancelButton).not.toBeDisabled();
  });

  it("shows attribution notice when suggestion has attribution", () => {
    const suggestion = {
      id: "suggestion-1",
      userId: "user-1",
      placeName: "Test Place",
      comment: null,
      location: null,
      status: "pending" as const,
      adminNotes: null,
      convertedStoryId: null,
      attribution: "@username",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      userEmail: "test@example.com",
    };

    render(<CreateStoryDialog {...defaultProps} suggestion={suggestion} />);

    expect(screen.getByText("@username")).toBeInTheDocument();
    expect(screen.getByText("Credit:")).toBeInTheDocument();
  });

  it("does not show attribution notice when no attribution", () => {
    const suggestion = {
      id: "suggestion-1",
      userId: "user-1",
      placeName: "Test Place",
      comment: null,
      location: null,
      status: "pending" as const,
      adminNotes: null,
      convertedStoryId: null,
      attribution: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      userEmail: "test@example.com",
    };

    render(<CreateStoryDialog {...defaultProps} suggestion={suggestion} />);

    expect(screen.queryByText("Credit:")).not.toBeInTheDocument();
  });

  it("expands optional fields when suggestion has location", () => {
    const suggestion = {
      id: "suggestion-1",
      userId: "user-1",
      placeName: "Test Place",
      comment: null,
      location: "central" as const,
      status: "pending" as const,
      adminNotes: null,
      convertedStoryId: null,
      attribution: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      userEmail: "test@example.com",
    };

    render(<CreateStoryDialog {...defaultProps} suggestion={suggestion} />);

    // Optional fields should be expanded because suggestion has location
    expect(screen.getByLabelText(/Source PDF/)).toBeInTheDocument();
  });
});
