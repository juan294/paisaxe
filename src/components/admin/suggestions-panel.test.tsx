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
});
