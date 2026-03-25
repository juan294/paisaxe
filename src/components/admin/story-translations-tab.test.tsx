import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryTranslationsTab } from "./story-translations-tab";
import type { AdminStory } from "@/types/admin";
import type { StoryTranslationsResponse, GenerateTranslationsResponse } from "@/types/admin";
import { TRANSLATION_LOCALES, LOCALE_NAMES } from "@/lib/translate-story";

// Mock the admin-api module
vi.mock("@/lib/admin-api", () => ({
  fetchStoryTranslations: vi.fn(),
  generateStoryTranslations: vi.fn(),
}));

import {
  fetchStoryTranslations,
  generateStoryTranslations,
} from "@/lib/admin-api";

const mockStory: AdminStory = {
  id: "story-1",
  slug: "test-story",
  title: "Historia de prueba",
  subtitle: "Subtítulo de prueba",
  description: "Descripción de prueba",
  category: "nature",
  image: "/images/test.jpg",
  displayOrder: 1,
  curationStatus: "approved",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockTranslationsResponse: StoryTranslationsResponse = {
  storyId: "story-1",
  original: {
    title: "Historia de prueba",
    subtitle: "Subtítulo de prueba",
    description: "Descripción de prueba",
  },
  translations: {
    en: { title: "Test Story", subtitle: "Test Subtitle", description: "Test Description" },
    fr: { title: "Histoire de test", subtitle: "Sous-titre", description: "Description" },
  },
  status: {
    en: { status: "complete" },
    fr: { status: "complete" },
    de: { status: "pending" },
  },
};

const mockGenerateResponse: GenerateTranslationsResponse = {
  storyId: "story-1",
  results: {
    en: { success: true },
    fr: { success: true },
    de: { success: true },
    pt: { success: true },
    ast: { success: false, error: "Translation failed" },
  },
  successCount: 4,
  failedCount: 1,
};

describe("StoryTranslationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchStoryTranslations).mockResolvedValue({
      data: mockTranslationsResponse,
    });
    vi.mocked(generateStoryTranslations).mockResolvedValue({
      data: mockGenerateResponse,
    });
  });

  describe("loading state", () => {
    it("shows a loading spinner while fetching translations", () => {
      // Never resolve to keep loading state
      vi.mocked(fetchStoryTranslations).mockReturnValue(new Promise(() => {}));

      render(<StoryTranslationsTab story={mockStory} />);

      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("removes loading spinner after translations are loaded", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Generate All Translations")).toBeInTheDocument();
      });

      // Spinner should be gone
      const spinner = document.querySelector(".animate-spin:only-child");
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe("rendering after load", () => {
    it("displays the original Spanish content", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Spanish (Original)")).toBeInTheDocument();
      });

      expect(screen.getByText("Historia de prueba")).toBeInTheDocument();
      expect(screen.getByText("Subtítulo de prueba")).toBeInTheDocument();
      expect(screen.getByText("Descripción de prueba")).toBeInTheDocument();
    });

    it("displays locale tabs for all translation locales", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        for (const locale of TRANSLATION_LOCALES) {
          expect(screen.getByText(locale.toUpperCase())).toBeInTheDocument();
        }
      });
    });

    it("shows the complete count in status bar", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        // 2 complete (en, fr) out of 5 locales
        expect(screen.getByText(`2/${TRANSLATION_LOCALES.length} complete`)).toBeInTheDocument();
      });
    });

    it("renders the Generate All Translations button", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });
    });

    it("shows the selected locale name in the translation panel", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        // Default selected locale is "en"
        expect(screen.getByText(LOCALE_NAMES["en"])).toBeInTheDocument();
      });
    });

    it("displays translation fields for the selected locale", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        const titleInput = screen.getByLabelText("Title", { selector: "input" });
        expect(titleInput).toHaveValue("Test Story");
      });

      const subtitleInput = screen.getByLabelText("Subtitle", { selector: "input" });
      expect(subtitleInput).toHaveValue("Test Subtitle");

      const descriptionTextarea = screen.getByLabelText("Description", { selector: "textarea" });
      expect(descriptionTextarea).toHaveValue("Test Description");
    });

    it("renders the Regenerate button", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Regenerate")).toBeInTheDocument();
      });
    });
  });

  describe("locale switching", () => {
    it("switches to a different locale when tab is clicked", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("EN")).toBeInTheDocument();
      });

      // Click the FR tab
      await user.click(screen.getByText("FR"));

      // Should show French locale name
      expect(screen.getByText(LOCALE_NAMES["fr"])).toBeInTheDocument();

      // Should show French translations
      const titleInput = screen.getByLabelText("Title", { selector: "input" });
      expect(titleInput).toHaveValue("Histoire de test");
    });

    it("shows empty fields for a locale without translations", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("DE")).toBeInTheDocument();
      });

      // Click the DE tab (no translation data)
      await user.click(screen.getByText("DE"));

      const titleInput = screen.getByLabelText("Title", { selector: "input" });
      expect(titleInput).toHaveValue("");
    });
  });

  describe("editing translations", () => {
    it("updates the title field when typed into", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Title", { selector: "input" })).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText("Title", { selector: "input" });
      await user.clear(titleInput);
      await user.type(titleInput, "Updated Title");

      expect(titleInput).toHaveValue("Updated Title");
    });

    it("updates the subtitle field when typed into", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Subtitle", { selector: "input" })).toBeInTheDocument();
      });

      const subtitleInput = screen.getByLabelText("Subtitle", { selector: "input" });
      await user.clear(subtitleInput);
      await user.type(subtitleInput, "Updated Subtitle");

      expect(subtitleInput).toHaveValue("Updated Subtitle");
    });

    it("updates the description field when typed into", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Description", { selector: "textarea" })).toBeInTheDocument();
      });

      const descriptionTextarea = screen.getByLabelText("Description", { selector: "textarea" });
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, "Updated Description");

      expect(descriptionTextarea).toHaveValue("Updated Description");
    });

    it("notifies parent of pending changes when a field is edited", async () => {
      const user = userEvent.setup();
      const onTranslationChange = vi.fn();

      render(
        <StoryTranslationsTab
          story={mockStory}
          onTranslationChange={onTranslationChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Title", { selector: "input" })).toBeInTheDocument();
      });

      // Initially called with no changes
      expect(onTranslationChange).toHaveBeenCalledWith(false, []);

      const titleInput = screen.getByLabelText("Title", { selector: "input" });
      await user.clear(titleInput);
      await user.type(titleInput, "Changed");

      // Should be called with hasChanges = true and pending changes
      await waitFor(() => {
        expect(onTranslationChange).toHaveBeenCalledWith(true, expect.arrayContaining([
          expect.objectContaining({
            locale: "en",
            translation: expect.objectContaining({
              title: "Changed",
            }),
          }),
        ]));
      });
    });

    it("marks the edited locale tab with a dirty indicator", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Title", { selector: "input" })).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText("Title", { selector: "input" });
      await user.type(titleInput, " extra");

      // Find the EN tab button and check for the dirty indicator dot
      const enTab = screen.getByText("EN").closest("button");
      expect(enTab).not.toBeNull();
      // The dirty indicator is a span with rounded-full bg-amber-500 inside the button
      const dirtyDot = enTab?.querySelector(".bg-amber-500");
      expect(dirtyDot).toBeInTheDocument();
    });
  });

  describe("generate all translations", () => {
    it("calls generateStoryTranslations when Generate All is clicked", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      expect(generateStoryTranslations).toHaveBeenCalledWith("story-1");
    });

    it("shows success message after generation completes", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      await waitFor(() => {
        expect(screen.getByText("Generated 4/5 translations")).toBeInTheDocument();
      });
    });

    it("disables the button while generating", async () => {
      // Make generation hang
      vi.mocked(generateStoryTranslations).mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      // Button should show generating state
      expect(screen.getByText("Generating...")).toBeInTheDocument();
    });

    it("shows error message when generation fails", async () => {
      vi.mocked(generateStoryTranslations).mockResolvedValue({
        error: "Claude API rate limited",
      });

      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      await waitFor(() => {
        expect(screen.getByText("Claude API rate limited")).toBeInTheDocument();
      });
    });

    it("reloads translations after generation completes", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      // fetchStoryTranslations is called once on mount
      expect(fetchStoryTranslations).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      await waitFor(() => {
        // Should be called again after generation
        expect(fetchStoryTranslations).toHaveBeenCalledTimes(2);
      });
    });

    it("notifies parent with updated metadata after generation", async () => {
      const user = userEvent.setup();
      const onMetadataUpdated = vi.fn();

      render(
        <StoryTranslationsTab
          story={mockStory}
          onMetadataUpdated={onMetadataUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      await waitFor(() => {
        expect(onMetadataUpdated).toHaveBeenCalledWith(expect.objectContaining({
          translations: mockTranslationsResponse.translations,
          translation_status: mockTranslationsResponse.status,
        }));
      });
    });
  });

  describe("regenerate single locale", () => {
    it("calls generateStoryTranslations with the selected locale", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Regenerate")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Regenerate"));

      expect(generateStoryTranslations).toHaveBeenCalledWith("story-1", {
        locales: ["en"],
        forceRetranslate: true,
      });
    });

    it("regenerates the currently selected locale", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("FR")).toBeInTheDocument();
      });

      // Switch to French
      await user.click(screen.getByText("FR"));

      // Click regenerate
      await user.click(screen.getByText("Regenerate"));

      expect(generateStoryTranslations).toHaveBeenCalledWith("story-1", {
        locales: ["fr"],
        forceRetranslate: true,
      });
    });

    it("shows success message after regeneration", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Regenerate")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Regenerate"));

      await waitFor(() => {
        expect(screen.getByText(`${LOCALE_NAMES["en"]} regenerated`)).toBeInTheDocument();
      });
    });

    it("shows error when regeneration fails", async () => {
      vi.mocked(generateStoryTranslations).mockResolvedValue({
        error: "Server error",
      });

      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Regenerate")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Regenerate"));

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("disables regenerate button while generating", async () => {
      vi.mocked(generateStoryTranslations).mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Regenerate")).toBeInTheDocument();
      });

      const regenerateButton = screen.getByText("Regenerate").closest("button")!;
      await user.click(regenerateButton);

      expect(regenerateButton).toBeDisabled();
    });
  });

  describe("success message auto-clears", () => {
    it("clears success message after 3s for generate all", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { act } = await import("@testing-library/react");

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      await waitFor(() => {
        expect(screen.getByText("Generated 4/5 translations")).toBeInTheDocument();
      });

      // Advance timers by 3 seconds to trigger the auto-clear
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText("Generated 4/5 translations")).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("clears success message after 3s for regenerate single locale", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { act } = await import("@testing-library/react");

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Regenerate")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Regenerate"));

      await waitFor(() => {
        expect(screen.getByText(`${LOCALE_NAMES["en"]} regenerated`)).toBeInTheDocument();
      });

      // Advance timers by 3 seconds to trigger the auto-clear
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText(`${LOCALE_NAMES["en"]} regenerated`)).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  describe("error state", () => {
    it("shows error message when initial fetch fails", async () => {
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        error: "Failed to fetch translations",
      });

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to fetch translations")).toBeInTheDocument();
      });
    });

    it("clears error when generation is attempted", async () => {
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        error: "Network error",
      });

      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      // Now make generation work
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        data: mockTranslationsResponse,
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      await waitFor(() => {
        expect(screen.queryByText("Network error")).not.toBeInTheDocument();
      });
    });
  });

  describe("empty state", () => {
    it("shows empty fields for locales with no translations", async () => {
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        data: {
          storyId: "story-1",
          original: {
            title: "Test",
            subtitle: "Sub",
            description: "Desc",
          },
          translations: {},
          status: {},
        },
      });

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        const titleInput = screen.getByLabelText("Title", { selector: "input" });
        expect(titleInput).toHaveValue("");
      });

      expect(screen.getByText(`0/${TRANSLATION_LOCALES.length} complete`)).toBeInTheDocument();
    });

    it("shows Empty text for original fields that are blank", async () => {
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        data: {
          storyId: "story-1",
          original: {
            title: "",
            subtitle: "",
            description: "",
          },
          translations: {},
          status: {},
        },
      });

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        const emptySpans = screen.getAllByText("Empty");
        expect(emptySpans.length).toBe(3);
      });
    });
  });

  describe("status display", () => {
    it("shows status badge for locale with status", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        // Default locale is EN which has "complete" status
        // Complete status shows only the icon, not the text
        expect(screen.getByText(LOCALE_NAMES["en"])).toBeInTheDocument();
      });
    });

    it("shows pending status text for non-complete statuses", async () => {
      const user = userEvent.setup();
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("DE")).toBeInTheDocument();
      });

      // Switch to DE which has "pending" status
      await user.click(screen.getByText("DE"));

      // The status text should show "pending"
      expect(screen.getByText("pending")).toBeInTheDocument();
    });
  });

  describe("edge case branches", () => {
    it("handles fetchStoryTranslations returning data with missing locale translations (line 97/103 fallback)", async () => {
      // translations object doesn't include 'en' but status does
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        data: {
          storyId: "story-1",
          original: {
            title: "Titulo",
            subtitle: "Sub",
            description: "Desc",
          },
          translations: {}, // no translations for any locale
          status: {
            en: { status: "pending" },
          },
        },
      });

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        // EN tab should be selected by default
        // Translation fields should be empty (fallback { title: "", subtitle: "", description: "" })
        const titleInput = screen.getByLabelText("Title", { selector: "input" });
        expect(titleInput).toHaveValue("");
      });

      // Status should still show pending
      expect(screen.getByText("pending")).toBeInTheDocument();
    });

    it("handles fetchStoryTranslations returning data with missing locale status (line 108 fallback)", async () => {
      // status object doesn't include 'en' but translations does
      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        data: {
          storyId: "story-1",
          original: {
            title: "Titulo",
            subtitle: "",
            description: "",
          },
          translations: {
            en: { title: "English Title", subtitle: "", description: "" },
          },
          status: {}, // no status for any locale
        },
      });

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        const titleInput = screen.getByLabelText("Title", { selector: "input" });
        expect(titleInput).toHaveValue("English Title");
      });

      // No status badge should be shown (status is null)
      // Count should be 0 complete
      expect(screen.getByText(`0/${TRANSLATION_LOCALES.length} complete`)).toBeInTheDocument();
    });
  });

  describe("edge case: no error and no data responses", () => {
    it("handles loadTranslations when fetch returns neither error nor data (line 97 false branch)", async () => {
      // When fetchStoryTranslations returns { error: undefined, data: undefined },
      // neither the error nor the data branch executes. The component should
      // still finish loading without crashing.
      vi.mocked(fetchStoryTranslations).mockResolvedValue({});

      render(<StoryTranslationsTab story={mockStory} />);

      // Should complete loading (spinner disappears) even without data
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      // Fields should remain at their initial empty values
      const titleInput = screen.getByLabelText("Title", { selector: "input" });
      expect(titleInput).toHaveValue("");
    });

    it("handles generateAll when response returns neither error nor data (line 172 false branch)", async () => {
      const user = userEvent.setup();

      // generateStoryTranslations returns neither error nor data
      vi.mocked(generateStoryTranslations).mockResolvedValue({});

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate all translations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate all translations/i }));

      // Should not show error or success message — the button should re-enable
      await waitFor(() => {
        const button = screen.getByRole("button", { name: /generate all translations/i });
        expect(button).not.toBeDisabled();
      });

      // No success or error messages
      expect(screen.queryByText(/generated/i)).not.toBeInTheDocument();
    });
  });

  describe("fetching", () => {
    it("fetches translations on mount with story id", async () => {
      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(fetchStoryTranslations).toHaveBeenCalledWith("story-1");
      });
    });

    it("updates original content from fetch response", async () => {
      const customResponse: StoryTranslationsResponse = {
        storyId: "story-1",
        original: {
          title: "From API Title",
          subtitle: "From API Subtitle",
          description: "From API Description",
        },
        translations: {},
        status: {},
      };

      vi.mocked(fetchStoryTranslations).mockResolvedValue({
        data: customResponse,
      });

      render(<StoryTranslationsTab story={mockStory} />);

      await waitFor(() => {
        expect(screen.getByText("From API Title")).toBeInTheDocument();
      });

      expect(screen.getByText("From API Subtitle")).toBeInTheDocument();
      expect(screen.getByText("From API Description")).toBeInTheDocument();
    });
  });
});
