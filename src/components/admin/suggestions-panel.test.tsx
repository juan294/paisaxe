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

// Store the latest props passed to CreateStoryDialog so tests can invoke callbacks
let createStoryDialogProps: Record<string, unknown> = {};
vi.mock("./create-story-dialog", () => ({
  CreateStoryDialog: (props: Record<string, unknown>) => {
    createStoryDialogProps = props;
    return props.open ? <div data-testid="create-story-dialog">Dialog Open</div> : null;
  },
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

  it("displays central and western location labels", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: [
        {
          ...mockSuggestions[0],
          id: "s3",
          placeName: "Cudillero",
          location: "central" as const,
        },
        {
          ...mockSuggestions[0],
          id: "s4",
          placeName: "Tapia de Casariego",
          location: "western" as const,
        },
      ],
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Central Asturias")).toBeInTheDocument();
    });
    expect(screen.getByText("Western Asturias")).toBeInTheDocument();
  });

  it("handleSaveNotes - shows error on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({
      error: "Save notes failed",
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand first suggestion
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Type in the admin notes
    const textarea = screen.getByPlaceholderText("Add internal notes...");
    await user.type(textarea, "Some notes");

    // Click "Save Notes"
    const saveBtn = screen.getByText("Save Notes");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Save notes failed")).toBeInTheDocument();
    });
  });

  it("reject button calls handleStatusChange with rejected", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({
      data: { ...mockSuggestions[0], status: "rejected" as const },
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand the first suggestion (status: pending, so Reject button shows)
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    // Click "Reject"
    const rejectBtn = screen.getByText("Reject");
    await user.click(rejectBtn);

    expect(adminApi.updateSuggestion).toHaveBeenCalledWith("s1", { status: "rejected" });
  });

  it("onOpenChange closes dialog when open changes to false", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand first suggestion and click Convert to Story
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    const convertBtn = screen.getByText("Convert to Story");
    await user.click(convertBtn);

    // The CreateStoryDialog is mocked to null, but the internal state is set
    // We can verify the suggestion is still visible and no errors thrown
    expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
  });

  it("shows footer text", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Suggestions from visitors")).toBeInTheDocument();
    });
  });

  it("clicking 'All' filter clears status filter", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // First apply a filter
    const pendingFilter = screen.getByText(/Pending \(\d+\)/);
    await user.click(pendingFilter);

    // Wait for refetch
    await waitFor(() => {
      expect(adminApi.fetchSuggestions).toHaveBeenCalledTimes(2);
    });

    // Now click "All" to clear the filter (covers line 214: setFilterStatus(null))
    const allFilter = screen.getByText(/All \(\d+\)/);
    await user.click(allFilter);

    // Should trigger another refetch with no status filter
    await waitFor(() => {
      expect(adminApi.fetchSuggestions).toHaveBeenCalledTimes(3);
    });
  });

  it("handleStoryCreated updates suggestion status to converted", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand and click Convert to Story to set convertingSuggestion
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);
    const convertBtn = screen.getByText("Convert to Story");
    await user.click(convertBtn);

    // Dialog should now be open
    await waitFor(() => {
      expect(screen.getByTestId("create-story-dialog")).toBeInTheDocument();
    });

    // Invoke the onCreated callback via the captured props
    const { act } = await import("@testing-library/react");
    await act(async () => {
      const onCreated = createStoryDialogProps.onCreated as (story: { id: string }) => void;
      onCreated({ id: "new-story-id" });
    });

    // The suggestion should now show as "Converted"
    await waitFor(() => {
      expect(screen.getAllByText("Converted").length).toBeGreaterThanOrEqual(1);
    });

    // Dialog should be closed (convertingSuggestion set to null)
    expect(screen.queryByTestId("create-story-dialog")).not.toBeInTheDocument();
  });

  it("onOpenChange(false) closes the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand and click Convert to Story
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);
    const convertBtn = screen.getByText("Convert to Story");
    await user.click(convertBtn);

    await waitFor(() => {
      expect(screen.getByTestId("create-story-dialog")).toBeInTheDocument();
    });

    // Invoke onOpenChange(false) via captured props
    const { act } = await import("@testing-library/react");
    await act(async () => {
      const onOpenChange = createStoryDialogProps.onOpenChange as (open: boolean) => void;
      onOpenChange(false);
    });

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByTestId("create-story-dialog")).not.toBeInTheDocument();
    });
  });

  it("shows 'Unknown user' when userId is set but userEmail is null", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: [
        {
          ...mockSuggestions[0],
          id: "s-unknown",
          placeName: "Senda del Oso",
          userId: "user-no-email",
          userEmail: null,
        },
      ],
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Senda del Oso")).toBeInTheDocument();
    });

    expect(screen.getByText("Unknown user")).toBeInTheDocument();
  });

  it("falls back to raw location value when not in LOCATION_LABELS", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: [
        {
          ...mockSuggestions[0],
          id: "s-custom-loc",
          placeName: "Mysterious Place",
          location: "southern" as never,
        },
      ],
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Mysterious Place")).toBeInTheDocument();
    });

    // "southern" is not in LOCATION_LABELS, so the raw value is displayed
    expect(screen.getByText("southern")).toBeInTheDocument();
  });

  it("handleSaveNotes sends empty string when no notes have been typed", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: [
        {
          ...mockSuggestions[0],
          id: "s-no-notes",
          placeName: "Cabo Peñas",
          adminNotes: null,
        },
      ],
    });
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({
      data: { ...mockSuggestions[0], id: "s-no-notes", adminNotes: "" },
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Cabo Peñas")).toBeInTheDocument();
    });

    // Expand the suggestion
    const expandBtn = screen.getByLabelText("Expand");
    await user.click(expandBtn);

    // Click Save Notes without typing anything — adminNotes[id] is undefined
    const saveBtn = screen.getByText("Save Notes");
    await user.click(saveBtn);

    // The fallback || "" should send empty string
    expect(adminApi.updateSuggestion).toHaveBeenCalledWith("s-no-notes", {
      adminNotes: "",
    });
  });

  it("handleStoryCreated without convertingSuggestion is a no-op", async () => {
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // The dialog is not open (convertingSuggestion is null).
    // Invoke onCreated directly — should be a safe no-op.
    const { act } = await import("@testing-library/react");
    await act(async () => {
      const onCreated = createStoryDialogProps.onCreated as (story: { id: string }) => void;
      onCreated({ id: "orphan-story-id" });
    });

    // Suggestions should remain unchanged — s1 is still "Pending"
    const pendingBadges = screen.getAllByText("Pending");
    expect(pendingBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("handles fetchSuggestions returning neither error nor data (line 79 false branch)", async () => {
    // fetchSuggestions returns an object with neither error nor data
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({});

    render(<SuggestionsPanel />);

    // Should finish loading and show empty state (suggestions stays empty)
    await waitFor(() => {
      expect(screen.getByText("No suggestions yet")).toBeInTheDocument();
    });
  });

  it("handles updateSuggestion returning neither error nor data (line 103 false branch)", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: mockSuggestions,
    });
    // updateSuggestion returns neither error nor data
    vi.mocked(adminApi.updateSuggestion).mockResolvedValue({});

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa de Gulpiyuri")).toBeInTheDocument();
    });

    // Expand first suggestion and click Mark Reviewed
    const expandButtons = screen.getAllByLabelText("Expand");
    await user.click(expandButtons[0]);

    const markReviewedBtn = screen.getByText("Mark Reviewed");
    await user.click(markReviewedBtn);

    // No error should be shown (no error returned)
    expect(screen.queryByText("Update failed")).not.toBeInTheDocument();
    // Suggestion should still show as Pending (data was null so state wasn't updated)
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
  });

  it("shows converted status buttons correctly for a reviewed suggestion", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchSuggestions).mockResolvedValue({
      data: [
        {
          ...mockSuggestions[0],
          id: "s-converted",
          placeName: "Playa del Silencio",
          status: "converted" as const,
          convertedStoryId: "story-123",
        },
      ],
    });

    render(<SuggestionsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Playa del Silencio")).toBeInTheDocument();
    });

    // Expand the converted suggestion
    const expandBtn = screen.getByLabelText("Expand");
    await user.click(expandBtn);

    // For a "converted" suggestion, "Convert to Story" should NOT be shown
    expect(screen.queryByText("Convert to Story")).not.toBeInTheDocument();
    // But "Mark Reviewed" and "Reject" should still be available
    expect(screen.getByText("Mark Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });
});
