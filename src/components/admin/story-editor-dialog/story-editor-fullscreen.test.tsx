import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminStory } from "@/types/admin";

const mockSetIsFullscreen = vi.fn();
const mockResetAndClose = vi.fn();

// Mock useStoryEditorState to provide fullscreen state
vi.mock("./use-story-editor-state", () => ({
  useStoryEditorState: () => ({
    activeTab: "details" as const,
    setActiveTab: vi.fn(),
    title: "Covadonga Lakes",
    slug: "covadonga-lakes",
    subtitle: "",
    setSubtitle: vi.fn(),
    description: "",
    setDescription: vi.fn(),
    category: "nature",
    setCategory: vi.fn(),
    location: "eastern",
    setLocation: vi.fn(),
    duration: "day-trip",
    setDuration: vi.fn(),
    sourcePdf: "",
    setSourcePdf: vi.fn(),
    questionPrompts: [],
    setQuestionPrompts: vi.fn(),
    showOptionalFields: false,
    setShowOptionalFields: vi.fn(),
    imageEditor: {
      imageSourceTab: "url" as const,
      setImageSourceTab: vi.fn(),
      imageUrl: "",
      imageSource: "",
      setImageSource: vi.fn(),
      previewUrl: null,
      selectedFile: null,
      isDragging: false,
      fileInputRef: { current: null },
      contentImages: [],
      contentImageIndex: 0,
      isSearchingContent: false,
      contentSearched: false,
      currentContentImage: null,
      isFullscreen: true,
      setIsFullscreen: mockSetIsFullscreen,
      currentPreview: null,
      handleUrlChange: vi.fn(),
      handleFileChange: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnter: vi.fn(),
      handleDragLeave: vi.fn(),
      handleDrop: vi.fn(),
      clearUpload: vi.fn(),
      handleSearchContent: vi.fn(),
      handleContentImageNav: vi.fn(),
      resetImageState: vi.fn(),
    },
    isLoading: false,
    setIsLoading: vi.fn(),
    error: "",
    setError: vi.fn(),
    hasDetailsChanges: false,
    hasImageChanges: false,
    hasTranslationChanges: false,
    pendingTranslations: [],
    handleTitleChange: vi.fn(),
    handleSlugChange: vi.fn(),
    handleTranslationChange: vi.fn(),
    currentPreview: "https://example.com/covadonga.jpg",
    hasChanges: false,
    resetAndClose: mockResetAndClose,
  }),
}));

// Mock use-story-editor-save
vi.mock("./use-story-editor-save", () => ({
  handleSave: vi.fn(),
  handleApprove: vi.fn(),
  handleMarkNeedsCuration: vi.fn(),
}));

// Mock admin-api
vi.mock("@/lib/admin-api", () => ({
  updateStoryStatus: vi.fn(),
  updateStory: vi.fn(),
  updateStoryImageUrl: vi.fn(),
  uploadStoryImage: vi.fn(),
  updateStoryImageSource: vi.fn(),
  updateStoryTranslation: vi.fn(),
}));

// Mock Dialog to bypass portals
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../story-translations-tab", () => ({
  StoryTranslationsTab: () => <div>Translations</div>,
}));
vi.mock("./details-tab", () => ({
  DetailsTab: () => <div>Details</div>,
}));
vi.mock("./image-tab", () => ({
  ImageTab: () => <div>Image Tab</div>,
}));
vi.mock("./image-editor-context", () => ({
  ImageEditorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/image to avoid Next.js image optimization issues in tests
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} data-testid="fullscreen-image" />
  ),
}));

import { StoryEditorDialog } from "./index";

const mockStory: AdminStory = {
  id: "story1",
  title: "Covadonga Lakes",
  slug: "covadonga-lakes",
  subtitle: "High mountain glacial lakes",
  description: "The famous Lagos de Covadonga",
  category: "nature",
  location: "eastern",
  duration: "day-trip",
  image: "https://example.com/covadonga.jpg",
  imageSource: "url",
  displayOrder: 1,
  curationStatus: "needs_curation",
  metadata: {},
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

describe("StoryEditorDialog fullscreen preview", () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders fullscreen overlay with close button and story title", () => {
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    // The fullscreen overlay should be visible (imageEditor.isFullscreen=true, state.currentPreview set)
    expect(screen.getByLabelText("Close fullscreen preview")).toBeInTheDocument();
    // Story title shown in fullscreen overlay
    expect(screen.getAllByText("Covadonga Lakes").length).toBeGreaterThanOrEqual(1);
    // Image should be rendered
    expect(screen.getByTestId("fullscreen-image")).toBeInTheDocument();
  });

  it("closes fullscreen preview when close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    await user.click(screen.getByLabelText("Close fullscreen preview"));

    expect(mockSetIsFullscreen).toHaveBeenCalledWith(false);
  });

  it("closes fullscreen preview when overlay background is clicked", async () => {
    const user = userEvent.setup();
    render(
      <StoryEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />
    );

    // Click the overlay background div (the container with the onClick handler)
    const overlay = screen.getByLabelText("Close fullscreen preview").parentElement!;
    await user.click(overlay);

    expect(mockSetIsFullscreen).toHaveBeenCalledWith(false);
  });
});
