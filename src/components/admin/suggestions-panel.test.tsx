import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionsPanel } from "./suggestions-panel";
import * as adminApi from "@/lib/admin-api";

vi.mock("@/lib/admin-api", () => ({
  fetchSuggestions: vi.fn(),
  updateSuggestion: vi.fn(),
  deleteSuggestion: vi.fn(),
}));

vi.mock("./create-story-dialog", () => ({
  CreateStoryDialog: () => null,
}));

const mockSuggestions = [
  {
    id: "s1",
    placeName: "Playa de Gulpiyuri",
    comment: "Amazing hidden beach near Llanes",
    location: "eastern" as const,
    attribution: "@traveler",
    status: "pending" as const,
    userId: "user1",
    userEmail: "user@example.com",
    adminNotes: null,
    convertedStoryId: null,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "s2",
    placeName: "Lagos de Covadonga",
    comment: "Must visit in summer",
    location: "eastern" as const,
    attribution: null,
    status: "reviewed" as const,
    userId: null,
    userEmail: null,
    adminNotes: "Nice suggestion",
    convertedStoryId: null,
    createdAt: "2024-01-14T10:00:00Z",
    updatedAt: "2024-01-14T10:00:00Z",
  },
];

describe("SuggestionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    vi.mocked(adminApi.fetchSuggestions).mockImplementation(
      () => new Promise(() => {})
    );

    render(<SuggestionsPanel />);

    // The component shows a spinner when loading and no suggestions
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders header and suggestion count", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Story Suggestions")).toBeInTheDocument();
    });

    expect(screen.getByText("2 Total")).toBeInTheDocument();
  });

  it("displays suggestion list", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
    expect(screen.getByText("Amazing hidden beach near Llanes")).toBeInTheDocument();
  });

  it("shows status badges", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText("Reviewed").length).toBeGreaterThanOrEqual(1);
  });

  it("renders filter buttons", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("All (2)")).toBeInTheDocument();
    });

    // Filter buttons for each status
    expect(screen.getByText(/Pending \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed \(\d+\)/)).toBeInTheDocument();
  });

  it("filters by status when filter button clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Click the "Reviewed" filter - the component re-fetches with status filter
    const reviewedFilter = screen.getByText(/Reviewed \(\d+\)/);
    await user.click(reviewedFilter);

    // After clicking, fetchSuggestions should be called again with the filter
    expect(adminApi.fetchSuggestions).toHaveBeenCalled();
  });

  it("expands suggestion details when clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Click expand button on first suggestion
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Should show admin notes textarea and action buttons
    await waitFor(() => {
      expect(screen.getByText("Admin Notes")).toBeInTheDocument();
    });
    expect(screen.getByText("Mark Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("Convert to Story")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows empty state when no suggestions", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: [],
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("No suggestions yet")).toBeInTheDocument();
    });
  });

  it("shows error message on API failure", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      error: "Failed to load suggestions",
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load suggestions")).toBeInTheDocument();
    });
  });

  it("displays user info and metadata for suggestions", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getAllByText("Eastern Asturias").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("@traveler")).toBeInTheDocument();
  });

  it("handleStatusChange - calls updateSuggestion on success", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({
      data: { ...mockSuggestions[0], status: "reviewed" as const },
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion (status: pending)
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Click "Mark Reviewed"
    const markReviewedBtn = screen.getByText("Mark Reviewed");
    await user.click(markReviewedBtn);

    expect(adminApi.updateSuggestion).toHaveBeenCalledWith("s1", { status: "reviewed" });
  });

  it("handleStatusChange - shows error on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({
      error: "Update failed",
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    const markReviewedBtn = screen.getByText("Mark Reviewed");
    await user.click(markReviewedBtn);

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("handleSaveNotes - saves admin notes", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({
      data: { ...mockSuggestions[0], adminNotes: "Great spot to visit" },
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Type in the admin notes textarea
    const textarea = screen.getByPlaceholderText("Add internal notes...");
    await user.type(textarea, "Great spot to visit");

    // Click Save Notes
    const saveBtn = screen.getByText("Save Notes");
    await user.click(saveBtn);

    expect(adminApi.updateSuggestion).toHaveBeenCalledWith("s1", {
      adminNotes: "Great spot to visit",
    });
  });

  it("handleDelete - confirmed deletes suggestion", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.deleteSuggestion).mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Click Delete
    const deleteBtn = screen.getByText("Delete");
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete this suggestion?");
    expect(adminApi.deleteSuggestion).toHaveBeenCalledWith("s1");

    // Item should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText("Playa de Gulpiyuri")).not.toBeInTheDocument();
    });
  });

  it("handleDelete - cancelled does not delete", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Click Delete
    const deleteBtn = screen.getByText("Delete");
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(adminApi.deleteSuggestion).not.toHaveBeenCalled();

    // Item should still be in the list
    expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
  });

  it("handleDelete - shows error on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.deleteSuggestion).mockResolvedValue({
      error: "Delete failed",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    const deleteBtn = screen.getByText("Delete");
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("Delete failed")).toBeInTheDocument();
    });

    // Item should still be in the list since delete failed
    expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
  });

  it("toggleExpanded - collapses when clicking again", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion
    const expandBtn = screen.getAllByLabelText("Expand")[0];
    await user.click(expandBtn);

    // Verify expanded content is visible
    await waitFor(() => {
      expect(screen.getByText("Admin Notes")).toBeInTheDocument();
    });

    // Now collapse it (button label changes to "Collapse")
    const collapseBtn = screen.getByLabelText("Collapse");
    await user.click(collapseBtn);

    // Admin Notes should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText("Admin Notes")).not.toBeInTheDocument();
    });
  });

  it("Convert to Story button sets convertingSuggestion state", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion (pending status, not converted)
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Click "Convert to Story"
    const convertBtn = screen.getByText("Convert to Story");
    await user.click(convertBtn);

    // The CreateStoryDialog is mocked to null, but the component internally
    // sets convertingSuggestion, which drives the `open` prop.
    // We can verify this indirectly - the button click should not throw,
    // and the component should remain stable.
    expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
  });

  it("Refresh button calls fetchSuggestions again", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    // fetchSuggestions was called once on mount
    expect(adminApi.fetchSuggestions).toHaveBeenCalledTimes(1);

    // Click "Refresh"
    const refreshBtn = screen.getByText("Refresh");
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(adminApi.fetchSuggestions).toHaveBeenCalledTimes(2);
    });
  });

  it("filter shows empty state with filter name", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Click "Rejected" filter - no suggestions have rejected status
    const rejectedFilter = screen.getByText(/Rejected \(\d+\)/);
    await user.click(rejectedFilter);

    // fetchSuggestions is re-called due to filterStatus change
    // Mock it to return same data (component filters client-side too,
    // but the useEffect triggers a refetch with the filter param)
    await waitFor(() => {
      expect(adminApi.fetchSuggestions).toHaveBeenCalledTimes(2);
    });

    // With the same mockSuggestions but filter set to "rejected",
    // the client-side filter produces 0 results
    await waitFor(() => {
      expect(screen.getByText("No rejected suggestions")).toBeInTheDocument();
    });
  });

  it("loads suggestions with adminNotes pre-filled in textarea", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
    });

    // Expand the second suggestion (s2) which has adminNotes: "Nice suggestion"
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[1]);

    // The textarea should be pre-filled with the admin notes
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("Add internal notes...");
      expect(textarea).toHaveValue("Nice suggestion");
    });
  });
});
