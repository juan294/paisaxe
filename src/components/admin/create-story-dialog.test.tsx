import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateStoryDialog } from "./create-story-dialog";

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  createStory: vi.fn(),
}));

// Mock Select components to make onValueChange testable in jsdom.
vi.mock("@/components/ui/select", async () => {
  const ReactMock = await import("react");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SelectContext = ReactMock.createContext<any>({});

  return {
    Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void }) => (
      <SelectContext.Provider value={{ onValueChange, value }}>
        {children}
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => {
      const ctx = ReactMock.useContext(SelectContext);
      return (
        <>
          <button data-testid={`select-trigger-${id}`}>{children}</button>
          <select
            data-testid={`select-native-${id}`}
            value={ctx.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => ctx.onValueChange?.(e.target.value)}
          >
            <option value="" />
            <option value="nature">Nature</option>
            <option value="cities">Cities</option>
            <option value="culture">Culture</option>
            <option value="food">Food</option>
            <option value="activities">Activities</option>
            <option value="eastern">Eastern Asturias</option>
            <option value="central">Central Asturias</option>
            <option value="western">Western Asturias</option>
            <option value="day-trip">Day Trip</option>
            <option value="weekend">Weekend</option>
            <option value="week">Week</option>
          </select>
        </>
      );
    },
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode; value: string }) => (
      <div>{children}</div>
    ),
  };
});

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

  it("submits form successfully and calls onCreated", async () => {
    const mockResponse = {
      data: {
        id: "story-123",
        slug: "test-story",
        title: "Test Story",
        category: "nature" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    };
    vi.mocked(createStory).mockResolvedValue(mockResponse);

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill in title
    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Test Story");

    // Select category via the native select mock
    const categorySelect = screen.getByTestId("select-native-category") as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "nature" } });

    // Submit
    const createButton = screen.getByRole("button", { name: /Create Story/i });
    await userEvent.click(createButton);

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Story",
        slug: "test-story",
        category: "nature",
      })
    );
    expect(mockOnCreated).toHaveBeenCalledWith(mockResponse.data);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows API error message on failed submission", async () => {
    vi.mocked(createStory).mockResolvedValue({
      error: "Slug exists",
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill in title
    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Test Story");

    // Select category
    const categorySelect = screen.getByTestId("select-native-category") as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "nature" } });

    // Submit
    const createButton = screen.getByRole("button", { name: /Create Story/i });
    await userEvent.click(createButton);

    // Error should be displayed
    expect(screen.getByText("Slug exists")).toBeInTheDocument();
    // onCreated should NOT have been called
    expect(mockOnCreated).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("sends sourceType and suggestionId when creating from suggestion", async () => {
    const suggestion = {
      id: "suggestion-42",
      userId: "user-1",
      placeName: "Picos de Europa",
      comment: "Great mountains",
      location: null,
      status: "pending" as const,
      adminNotes: null,
      convertedStoryId: null,
      attribution: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      userEmail: "test@example.com",
    };

    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-new",
        slug: "picos-de-europa",
        title: "Picos de Europa",
        category: "nature" as const,
        displayOrder: 2,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} suggestion={suggestion} />);

    // Title should be pre-filled from suggestion
    expect(screen.getByLabelText(/Title/)).toHaveValue("Picos de Europa");

    // Select category
    const categorySelect = screen.getByTestId("select-native-category") as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "nature" } });

    // Submit
    const createButton = screen.getByRole("button", { name: /Create Story/i });
    await userEvent.click(createButton);

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Picos de Europa",
        slug: "picos-de-europa",
        category: "nature",
        sourceType: "user_submitted",
        suggestionId: "suggestion-42",
        description: "Great mountains",
      })
    );
  });

  it("calls onOpenChange when cancel button clicked", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("updates subtitle field and includes it in submission", async () => {
    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-1",
        slug: "test-story",
        title: "Test Story",
        category: "nature" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/Title/), "Test Story");
    fireEvent.change(screen.getByTestId("select-native-category"), {
      target: { value: "nature" },
    });

    // Type into subtitle field (line 322)
    const subtitleInput = screen.getByLabelText(/Subtitle/);
    await userEvent.type(subtitleInput, "A great subtitle");
    expect(subtitleInput).toHaveValue("A great subtitle");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle: "A great subtitle",
      })
    );
  });

  it("updates description field via typing", async () => {
    render(<CreateStoryDialog {...defaultProps} />);

    // The description textarea (line 339)
    const descriptionInput = screen.getByLabelText(/Description/);
    await userEvent.type(descriptionInput, "New description text");
    expect(descriptionInput).toHaveValue("New description text");
  });

  it("selects location in optional fields and includes it in submission", async () => {
    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-2",
        slug: "test-location",
        title: "Test Location",
        category: "cities" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/Title/), "Test Location");
    fireEvent.change(screen.getByTestId("select-native-category"), {
      target: { value: "cities" },
    });

    // Expand optional fields
    await userEvent.click(screen.getByRole("button", { name: /Optional Fields/i }));

    // Select location (line 373)
    const locationSelect = screen.getByTestId("select-native-location");
    fireEvent.change(locationSelect, { target: { value: "western" } });

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "western",
      })
    );
  });

  it("selects duration in optional fields and includes it in submission", async () => {
    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-3",
        slug: "test-duration",
        title: "Test Duration",
        category: "activities" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/Title/), "Test Duration");
    fireEvent.change(screen.getByTestId("select-native-category"), {
      target: { value: "activities" },
    });

    // Expand optional fields
    await userEvent.click(screen.getByRole("button", { name: /Optional Fields/i }));

    // Select duration (line 401)
    const durationSelect = screen.getByTestId("select-native-duration");
    fireEvent.change(durationSelect, { target: { value: "weekend" } });

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: "weekend",
      })
    );
  });

  it("updates source PDF field and includes it in submission", async () => {
    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-4",
        slug: "test-pdf",
        title: "Test PDF",
        category: "culture" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/Title/), "Test PDF");
    fireEvent.change(screen.getByTestId("select-native-category"), {
      target: { value: "culture" },
    });

    // Expand optional fields
    await userEvent.click(screen.getByRole("button", { name: /Optional Fields/i }));

    // Type into Source PDF field (line 430)
    const sourcePdfInput = screen.getByLabelText(/Source PDF/);
    await userEvent.type(sourcePdfInput, "asturias-guide.pdf");
    expect(sourcePdfInput).toHaveValue("asturias-guide.pdf");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePdf: "asturias-guide.pdf",
      })
    );
  });

  it("uses generateSlug fallback when slug is empty on submit (line 170)", async () => {
    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-auto-slug",
        slug: "test-story",
        title: "Test Story",
        category: "nature" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill in title
    const titleInput = screen.getByLabelText(/Title/);
    await userEvent.type(titleInput, "Test Story");

    // Clear the slug field so it's empty
    const slugInput = screen.getByLabelText(/URL Slug/);
    await userEvent.clear(slugInput);

    // Select category
    const categorySelect = screen.getByTestId("select-native-category") as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "nature" } });

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    // The slug should be auto-generated from title via the fallback
    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "test-story",
      })
    );
  });

  it("handles createStory returning neither error nor data (line 193 false branch)", async () => {
    // createStory returns no error and no data — both branches are skipped
    vi.mocked(createStory).mockResolvedValue({});

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/Title/), "Test Story");
    fireEvent.change(screen.getByTestId("select-native-category"), {
      target: { value: "nature" },
    });

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    // No error should be shown
    expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();

    // onCreated should NOT have been called (no data returned)
    expect(mockOnCreated).not.toHaveBeenCalled();
    // onOpenChange should NOT have been called with false (no data branch)
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("submits all optional fields together", { timeout: 15000 }, async () => {
    vi.mocked(createStory).mockResolvedValue({
      data: {
        id: "story-5",
        slug: "full-story",
        title: "Full Story",
        category: "food" as const,
        displayOrder: 1,
        curationStatus: "needs_curation" as const,
        createdAt: "2026-01-01",
      },
    });

    render(<CreateStoryDialog {...defaultProps} />);

    // Fill required fields
    await userEvent.type(screen.getByLabelText(/Title/), "Full Story");
    fireEvent.change(screen.getByTestId("select-native-category"), {
      target: { value: "food" },
    });

    // Fill subtitle and description
    await userEvent.type(screen.getByLabelText(/Subtitle/), "Tasty subtitle");
    await userEvent.type(screen.getByLabelText(/Description/), "Delicious description");

    // Expand optional fields and fill them all
    await userEvent.click(screen.getByRole("button", { name: /Optional Fields/i }));
    fireEvent.change(screen.getByTestId("select-native-location"), {
      target: { value: "central" },
    });
    fireEvent.change(screen.getByTestId("select-native-duration"), {
      target: { value: "day-trip" },
    });
    await userEvent.type(screen.getByLabelText(/Source PDF/), "food-guide.pdf");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: /Create Story/i }));

    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Full Story",
        slug: "full-story",
        category: "food",
        subtitle: "Tasty subtitle",
        description: "Delicious description",
        location: "central",
        duration: "day-trip",
        sourcePdf: "food-guide.pdf",
      })
    );
  });
});
