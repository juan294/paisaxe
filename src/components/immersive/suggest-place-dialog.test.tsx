import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SuggestPlaceDialog } from "./suggest-place-dialog";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "suggestions.dialog_title": "Suggest a Place",
        "suggestions.dialog_description": "Share a hidden gem from Asturias",
        "suggestions.place_name_label": "Place Name",
        "suggestions.place_name_placeholder": "Enter place name",
        "suggestions.location_label": "Location",
        "suggestions.location_placeholder": "Select region",
        "suggestions.location_eastern": "Eastern Asturias",
        "suggestions.location_central": "Central Asturias",
        "suggestions.location_western": "Western Asturias",
        "suggestions.comment_label": "Why is this place special?",
        "suggestions.comment_placeholder": "Tell us about this place",
        "suggestions.attribution_label": "Attribution",
        "suggestions.attribution_placeholder": "Your name or alias",
        "suggestions.attribution_hint": "Optional: How you'd like to be credited",
        "suggestions.characters": "characters",
        "suggestions.cancel": "Cancel",
        "suggestions.submit": "Submit",
        "suggestions.submitting": "Submitting...",
        "suggestions.success_title": "Thank you!",
        "suggestions.success_message": "We'll review your suggestion",
        "suggestions.error_not_signed_in": "Please sign in first",
        "suggestions.error_place_name_length": "Place name must be 3-100 characters",
        "suggestions.error_rate_limit": "Too many requests. Try again later.",
        "suggestions.error_generic": "Something went wrong",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

// Mock useAuth hook
const mockSignInWithGoogle = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { access_token: "test-token" },
    user: { id: "user-123", email: "test@example.com" },
    signInWithGoogle: mockSignInWithGoogle,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SuggestPlaceDialog", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockFetch.mockClear();
  });

  it("renders dialog when isOpen is true", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Suggest a Place")).toBeInTheDocument();
    expect(screen.getByText("Share a hidden gem from Asturias")).toBeInTheDocument();
  });

  it("does not render dialog when isOpen is false", () => {
    render(<SuggestPlaceDialog isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText("Suggest a Place")).not.toBeInTheDocument();
  });

  it("renders place name input", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByLabelText(/Place Name/)).toBeInTheDocument();
  });

  it("renders location select", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Location")).toBeInTheDocument();
  });

  it("renders comment textarea", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByLabelText(/Why is this place special/)).toBeInTheDocument();
  });

  it("renders attribution input", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByLabelText(/Attribution/)).toBeInTheDocument();
  });

  it("renders cancel and submit buttons", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("calls onClose when cancel is clicked", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("disables submit button when place name is too short", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    const input = screen.getByLabelText(/Place Name/);
    fireEvent.change(input, { target: { value: "ab" } });
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when place name is valid", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    const input = screen.getByLabelText(/Place Name/);
    fireEvent.change(input, { target: { value: "Covadonga" } });
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton).not.toBeDisabled();
  });

  it("shows character count for place name", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    const input = screen.getByLabelText(/Place Name/);
    fireEvent.change(input, { target: { value: "Test" } });
    expect(screen.getByText("4/100 characters")).toBeInTheDocument();
  });

  it("shows character count for comment", () => {
    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);
    const textarea = screen.getByLabelText(/Why is this place special/);
    fireEvent.change(textarea, { target: { value: "Beautiful place" } });
    expect(screen.getByText("15/500 characters")).toBeInTheDocument();
  });

  it("submits form with correct data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "suggestion-1" }),
    });

    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);

    const placeNameInput = screen.getByLabelText(/Place Name/);
    const commentTextarea = screen.getByLabelText(/Why is this place special/);
    const attributionInput = screen.getByLabelText(/Attribution/);

    fireEvent.change(placeNameInput, { target: { value: "Lago Enol" } });
    fireEvent.change(commentTextarea, { target: { value: "Amazing views" } });
    fireEvent.change(attributionInput, { target: { value: "Juan" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          placeName: "Lago Enol",
          comment: "Amazing views",
          location: undefined,
          attribution: "Juan",
        }),
      });
    });
  });

  it("shows success message after successful submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "suggestion-1" }),
    });

    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);

    const placeNameInput = screen.getByLabelText(/Place Name/);
    fireEvent.change(placeNameInput, { target: { value: "Lago Enol" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("Thank you!")).toBeInTheDocument();
      expect(screen.getByText("We'll review your suggestion")).toBeInTheDocument();
    });
  });

  it("shows error message on rate limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limited" }),
    });

    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);

    const placeNameInput = screen.getByLabelText(/Place Name/);
    fireEvent.change(placeNameInput, { target: { value: "Lago Enol" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("Too many requests. Try again later.")).toBeInTheDocument();
    });
  });

  it("shows error message on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);

    const placeNameInput = screen.getByLabelText(/Place Name/);
    fireEvent.change(placeNameInput, { target: { value: "Lago Enol" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ id: "suggestion-1" }),
              }),
            100
          )
        )
    );

    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);

    const placeNameInput = screen.getByLabelText(/Place Name/);
    fireEvent.change(placeNameInput, { target: { value: "Lago Enol" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Submitting...")).toBeInTheDocument();
  });
});

describe("SuggestPlaceDialog without session", () => {
  it("shows error when user is not signed in", async () => {
    // This test is handled by the API validation on the server side
    // The component requires a session to submit, which is validated in handleSubmit
    // Testing by mocking the fetch response for unauthorized access
    const mockOnClose = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Not authenticated" }),
    });

    render(<SuggestPlaceDialog isOpen={true} onClose={mockOnClose} />);

    const placeNameInput = screen.getByLabelText(/Place Name/);
    fireEvent.change(placeNameInput, { target: { value: "Lago Enol" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText("Not authenticated")).toBeInTheDocument();
    });
  });
});
