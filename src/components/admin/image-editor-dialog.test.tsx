import { requiredValue } from "@/test/required-value";
import { imageProvenanceFixture } from "@/test/image-provenance-fixture";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { ImageEditorDialog } from "./image-editor-dialog";
import type { AdminStory } from "@/types/admin";
import { PLACEHOLDER_PREFIX } from "@/lib/unsplash-placeholders";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <div data-testid="next-image" data-src={props.src} data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

// Mock admin-api
const mockUpdateStoryImageUrl = vi.fn();
const mockUploadStoryImage = vi.fn();
const mockUpdateStoryStatus = vi.fn();
const mockSearchContentImages = vi.fn();
const mockUpdateStoryImageSource = vi.fn();

vi.mock("@/lib/admin-api", () => ({
  updateStoryImageUrl: (...args: unknown[]) => mockUpdateStoryImageUrl(...args),
  uploadStoryImage: (...args: unknown[]) => mockUploadStoryImage(...args),
  updateStoryStatus: (...args: unknown[]) => mockUpdateStoryStatus(...args),
  searchContentImages: (...args: unknown[]) => mockSearchContentImages(...args),
  updateStoryImageSource: (...args: unknown[]) => mockUpdateStoryImageSource(...args),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Link: (props: Record<string, unknown>) => <span data-testid="icon-link" {...props} />,
  Upload: (props: Record<string, unknown>) => <span data-testid="icon-upload" {...props} />,
  ImagePlus: (props: Record<string, unknown>) => <span data-testid="icon-image-plus" {...props} />,
  Maximize2: (props: Record<string, unknown>) => <span data-testid="icon-maximize" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  FolderSearch: (props: Record<string, unknown>) => <span data-testid="icon-folder-search" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <span data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <span data-testid="icon-chevron-right" {...props} />,
}));

// Mock the Dialog components to render children directly (avoid Radix portal issues)
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => {
    if (open === false) return null;
    return <div data-testid="dialog">{children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

// Mock CurationBadge
vi.mock("./curation-badge", () => ({
  CurationBadge: ({ status }: { status: string }) => (
    <span data-testid="curation-badge">{status}</span>
  ),
}));

const mockStory: AdminStory = {
  id: "story-1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "A subtitle",
  description: "A description",
  image: "https://example.com/current.jpg",
  category: "nature" as AdminStory["category"],
  displayOrder: 1,
  curationStatus: "needs_curation",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

const defaultProps = {
  story: mockStory,
  onClose: vi.fn(),
  onUpdate: vi.fn(),
};


afterEach(() => vi.unstubAllGlobals());
async function completeReview() {
  const urlInput = screen.queryByPlaceholderText("https://example.com/image.jpg") as HTMLInputElement | null;
  const url = urlInput?.value || (document.querySelector('input[type="file"]') ? "https://example.com/uploaded.avif" : screen.getAllByTestId("next-image")[0]?.getAttribute("data-src") || mockStory.image);
  const proof = JSON.parse(imageProvenanceFixture(url));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ...proof, preview: "data:image/jpeg;base64,AA==", width: 1200, height: 800 } }) }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" })); });
  for (const [label, value] of Object.entries({ "Página de origen (HTTPS)": "https://example.com/source", "Fotógrafo/a": "Actual Fotógrafo/a", "Prueba de permiso / registro conservado": "Permission retained by owner", "Fecha de revisión": "2026-10-13", "Crédito mostrado": "Reviewed photographer credit", "Descripción precisa de la imagen": "Reviewed named location", "Nombre de quien revisa": "Actual reviewer", "Notas del encuadre en móvil": "Center crop verified", "Notas del encuadre en escritorio": "Center crop verified", "Registro o pruebas de permiso y revisión visual": "Retained permission and visual review record" })) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText("Licencia"), { target: { value: "owner-permission" } });
  fireEvent.change(screen.getByLabelText("Contexto de la imagen"), { target: { value: "named-place" } });
  fireEvent.click(screen.getByRole("checkbox"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión de la foto" })); });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Revisión de la foto completada"));
}
async function save() { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); }); }
function selectUrl(url = "https://example.com/new.jpg") {
  fireEvent.click(screen.getByText("URL"));
  fireEvent.change(screen.getByPlaceholderText("https://example.com/image.jpg"), { target: { value: url } });
}

describe("ImageEditorDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-blob");
  });

  describe("Rendering", () => {
    it("returns null when story is null", () => {
      const { container } = render(
        <ImageEditorDialog
          story={null}
          onClose={vi.fn()}
          onUpdate={vi.fn()}
        />
      );
      expect(container.innerHTML).toBe("");
    });

    it("renders dialog with story title", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Test Story")).toBeInTheDocument();
    });

    it("renders update hero image description", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Update hero image")).toBeInTheDocument();
    });

    it("renders curation badge with current status", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByTestId("curation-badge")).toHaveTextContent("needs_curation");
    });

    it("renders current story image preview", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      const images = screen.getAllByTestId("next-image");
      const previewImage = images.find(
        (img) => img.getAttribute("data-src") === "https://example.com/current.jpg"
      );
      expect(previewImage).toBeTruthy();
    });
  });

  describe("Tabs", () => {
    it("shows Content tab by default", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByText("Actual")).toBeInTheDocument();
      expect(screen.getByText("URL")).toBeInTheDocument();
      expect(screen.getByText("Upload")).toBeInTheDocument();
      // Content tab should be visible with Search PDF button
      expect(screen.getByText(/Las fotos extraídas de guías/)).toBeInTheDocument();
    });

    it("can switch to URL tab", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("URL"));

      // URL input should be visible
      expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toBeInTheDocument();
    });

    it("can switch to Upload tab", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      // Upload area should appear (with "Click or drag" text)
      expect(screen.getByText("Click or drag")).toBeInTheDocument();
      expect(screen.getByText("JPEG, PNG, WebP, GIF, AVIF · Max 10MB")).toBeInTheDocument();
    });

    it("can switch back to URL tab from Upload tab", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Go to upload
      fireEvent.click(screen.getByText("Upload"));
      expect(screen.getByText("Click or drag")).toBeInTheDocument();

      // Go back to URL
      fireEvent.click(screen.getByText("URL"));
      expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toBeInTheDocument();
    });
  });

  describe("URL input", () => {
    it("URL input updates preview", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      const images = screen.getAllByTestId("next-image");
      const previewImage = images.find(
        (img) => img.getAttribute("data-src") === "https://example.com/new.jpg"
      );
      expect(previewImage).toBeTruthy();
    });
  });

  describe("Explicit photo review", () => {
    it("shows structured permission fields instead of a raw JSON input", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.getByLabelText("Prueba de permiso / registro conservado")).toBeInTheDocument();
      expect(screen.getByLabelText("Crédito mostrado")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Reviewed photo record")).not.toBeInTheDocument();
    });
    it("keeps legacy credit for review without approving it", () => {
      render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, imageSource: "Original credit" }} />);
      expect(screen.getByLabelText("Crédito mostrado")).toHaveValue("Original credit");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("restores the current review when a selected upload is discarded through Actual", async () => {
    const source = imageProvenanceFixture(mockStory.image);
    render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, imageSource: source }} />);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["draft"], "draft.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Actual" }));
    expect(screen.getByLabelText("Crédito mostrado")).toHaveValue(JSON.parse(source).credit);
    await save();
    expect(mockUpdateStoryImageUrl).not.toHaveBeenCalled();
    expect(mockUploadStoryImage).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  describe("Save with URL", () => {
    it("requires an explicit review before calling the image endpoint", async () => {
      render(<ImageEditorDialog {...defaultProps} />); selectUrl(); await save();
      expect(mockUpdateStoryImageUrl).not.toHaveBeenCalled();
      expect(screen.getByText(/Completa y confirma/)).toBeInTheDocument();
    });
    it("saves exact reviewed URL and proof, then updates and closes", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({ data: { image: "https://example.com/new.jpg", imageSource: "saved proof" } });
      render(<ImageEditorDialog {...defaultProps} />); selectUrl(); await completeReview(); await save();
      expect(mockUpdateStoryImageUrl).toHaveBeenCalledWith("story-1", "https://example.com/new.jpg", expect.any(String));
      const proof = JSON.parse(mockUpdateStoryImageUrl.mock.calls[0]![2]);
      expect(proof.assetUrl).toBe("https://example.com/new.jpg"); expect(proof.credit).toBe("Reviewed photographer credit"); expect(proof.status).toBe("approved");
      expect(defaultProps.onUpdate).toHaveBeenCalledWith("story-1", { image: "https://example.com/new.jpg", imageSource: "saved proof" });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
    it("invalidates review after URL changes", async () => {
      render(<ImageEditorDialog {...defaultProps} />); selectUrl(); await completeReview();
      fireEvent.change(screen.getByPlaceholderText("https://example.com/image.jpg"), { target: { value: "https://example.com/other.jpg" } }); await save();
      expect(mockUpdateStoryImageUrl).not.toHaveBeenCalled(); expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("Save with file upload", () => {
    it("saves the selected original with explicitly reviewed optimized proof", async () => {
      mockUploadStoryImage.mockResolvedValue({ data: { image: "https://example.com/uploaded.avif" } });
      render(<ImageEditorDialog {...defaultProps} />); fireEvent.click(screen.getByText("Upload"));
      const file = new File(["image data"], "photo.avif", { type: "image/avif" });
      fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
      await completeReview(); await save();
      expect(mockUploadStoryImage).toHaveBeenCalledWith("story-1", file, expect.any(String));
      expect(JSON.parse(mockUploadStoryImage.mock.calls[0]![2]).replacementSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it.each(["Image URL is not accessible", "Retry image"])("retains reviewed URL and draft after %s", async message => {
      mockUpdateStoryImageUrl.mockResolvedValue({ error: message });
      render(<ImageEditorDialog {...defaultProps} />); selectUrl(); await completeReview(); await save();
      expect(screen.getByText(message)).toBeInTheDocument(); expect(defaultProps.onClose).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toHaveValue("https://example.com/new.jpg");
      expect(screen.getByLabelText("Crédito mostrado")).toHaveValue("Reviewed photographer credit");
    });
    it("shows generic errors on image save exceptions", async () => {
      mockUpdateStoryImageUrl.mockRejectedValue(new Error("Network error"));
      render(<ImageEditorDialog {...defaultProps} />); selectUrl(); await completeReview(); await save();
      expect(screen.getByText("Failed to update image")).toBeInTheDocument();
    });
    it("does not close or update when the endpoint returns no data", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({});
      render(<ImageEditorDialog {...defaultProps} />); selectUrl(); await completeReview(); await save();
      expect(defaultProps.onUpdate).not.toHaveBeenCalled(); expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
    it("reports upload errors without losing the file", async () => {
      mockUploadStoryImage.mockResolvedValue({ error: "Upload failed" }); render(<ImageEditorDialog {...defaultProps} />); fireEvent.click(screen.getByText("Upload"));
      fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["bytes"], "photo.jpg", { type: "image/jpeg" })] } });
      await completeReview(); await save(); expect(screen.getByText("Upload failed")).toBeInTheDocument(); expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    });
  });

  describe("Status actions", () => {
    it("approve button calls updateStoryStatus with 'approved'", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        data: { id: "story-1", curationStatus: "approved" },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(mockUpdateStoryStatus).toHaveBeenCalledWith("story-1", "approved");
    });

    it("calls onUpdate but keeps modal open after successful approve", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        data: { id: "story-1", curationStatus: "approved" },
      });

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(defaultProps.onUpdate).toHaveBeenCalledWith("story-1", {
        curationStatus: "approved",
      });
      // Modal stays open so user can continue editing
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("shows 'Mark as pending' button when status is approved", () => {
      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      expect(screen.getByText("Mark as pending")).toBeInTheDocument();
      expect(screen.queryByText("Mark as approved")).not.toBeInTheDocument();
    });

    it("mark as pending calls updateStoryStatus with 'needs_curation'", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        data: { id: "story-1", curationStatus: "needs_curation" },
      });

      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as pending"));
      });

      expect(mockUpdateStoryStatus).toHaveBeenCalledWith(
        "story-1",
        "needs_curation"
      );
    });

    it("shows error when approve fails via API", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        error: "Failed to update status",
      });

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(screen.getByText("Failed to update status")).toBeInTheDocument();
    });

    it("shows error when approve throws an exception", async () => {
      mockUpdateStoryStatus.mockRejectedValue(new Error("Network error"));

      render(<ImageEditorDialog {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as approved"));
      });

      expect(screen.getByText("Failed to approve story")).toBeInTheDocument();
    });

    it("shows error when mark as pending fails via API", async () => {
      mockUpdateStoryStatus.mockResolvedValue({
        error: "Cannot change status",
      });

      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as pending"));
      });

      expect(screen.getByText("Cannot change status")).toBeInTheDocument();
    });

    it("shows error when mark as pending throws an exception", async () => {
      mockUpdateStoryStatus.mockRejectedValue(new Error("Network error"));

      const approvedStory = { ...mockStory, curationStatus: "approved" as const };
      render(<ImageEditorDialog {...defaultProps} story={approvedStory} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Mark as pending"));
      });

      expect(screen.getByText("Failed to update status")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("shows loading state during save", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockUpdateStoryImageUrl.mockReturnValue(promise);

      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to URL tab first (Content is default)
      fireEvent.click(screen.getByText("URL"));

      const urlInput = screen.getByPlaceholderText("https://example.com/image.jpg");
      fireEvent.change(urlInput, { target: { value: "https://example.com/new.jpg" } });

      await completeReview();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });

      // Should show "Saving" text during loading
      expect(screen.getByText("Saving")).toBeInTheDocument();

      // Resolve and finish
      await act(async () => {
        resolvePromise!({ data: { id: "story-1", image: "https://example.com/new.jpg" } });
      });
    });
  });

  describe("Cancel button", () => {
    it("cancel button calls onClose", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("File validation", () => {
    it("rejects invalid file types", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.pdf", { type: "application/pdf" });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(
        screen.getByText("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF")
      ).toBeInTheDocument();
    });

    it("rejects oversized files (>10MB)", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 }); // 6MB

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("File too large. Maximum size is 10MB")).toBeInTheDocument();
    });

    it("accepts valid file types (JPEG)", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("test.jpg")).toBeInTheDocument();
      expect(
        screen.queryByText("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF")
      ).not.toBeInTheDocument();
    });

    it("accepts valid file types (PNG)", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.png", { type: "image/png" });
      Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("test.png")).toBeInTheDocument();
    });
  });

  describe("Upload zone click", () => {
    it("clicking the upload zone triggers the hidden file input", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Switch to upload tab
      fireEvent.click(screen.getByText("Upload"));

      // Get the hidden file input and spy on its click method
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      // Click the drop zone div (the one with "Click or drag" text)
      const dropZone = screen.getByText("Click or drag").closest("div[class*='cursor-pointer']")!;
      fireEvent.click(dropZone);

      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });
  });

  describe("Drag and drop", () => {
    it("handles drag enter and drag leave", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const dropZone = screen.getByText("Click or drag").closest("div[class*='cursor-pointer']")!;

      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(screen.getByText("Drop here")).toBeInTheDocument();

      fireEvent.dragLeave(dropZone, { dataTransfer: { files: [] } });
      expect(screen.getByText("Click or drag")).toBeInTheDocument();
    });

    it("handles file drop", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const dropZone = screen.getByText("Click or drag").closest("div[class*='cursor-pointer']")!;

      const file = new File(["image data"], "dropped.png", { type: "image/png" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      expect(screen.getByText("dropped.png")).toBeInTheDocument();
    });
  });

  describe("Fullscreen preview", () => {
    it("shows fullscreen overlay when maximize is clicked", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Find the maximize button (the one containing the maximize icon)
      const maximizeIcons = screen.getAllByTestId("icon-maximize");
      const maximizeButton = requiredValue(maximizeIcons[0], "src/components/admin/image-editor-dialog.test.tsx: maximizeIcons[0]").closest("button")!;
      fireEvent.click(maximizeButton);

      // Should show the story title in the fullscreen overlay at the bottom
      const titleTexts = screen.getAllByText("Test Story");
      // Should have at least two: one in dialog header, one in fullscreen overlay
      expect(titleTexts.length).toBeGreaterThanOrEqual(2);
    });

    it("renders fullscreen image and close button in overlay", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Open fullscreen
      const maximizeIcons = screen.getAllByTestId("icon-maximize");
      const maximizeButton = requiredValue(maximizeIcons[0], "src/components/admin/image-editor-dialog.test.tsx: maximizeIcons[0]").closest("button")!;
      fireEvent.click(maximizeButton);

      // Fullscreen overlay should contain a next-image with the story image
      const images = screen.getAllByTestId("next-image");
      const fullscreenImage = images.find(
        (img) =>
          img.getAttribute("data-src") === "https://example.com/current.jpg" &&
          img.getAttribute("data-fill") === "true" &&
          img.className.includes("object-contain")
      );
      expect(fullscreenImage).toBeTruthy();

      // The overlay should have a close button with the X icon
      const xIcons = screen.getAllByTestId("icon-x");
      const fullscreenCloseButton = xIcons
        .map((icon) => icon.closest("button"))
        .find((btn) => btn && btn.className.includes("rounded-full"));
      expect(fullscreenCloseButton).toBeTruthy();
    });

    it("closes fullscreen overlay when close button is clicked", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Open fullscreen
      const maximizeIcons = screen.getAllByTestId("icon-maximize");
      const maximizeButton = requiredValue(maximizeIcons[0], "src/components/admin/image-editor-dialog.test.tsx: maximizeIcons[0]").closest("button")!;
      fireEvent.click(maximizeButton);

      // Verify overlay is visible (title appears twice)
      expect(screen.getAllByText("Test Story").length).toBeGreaterThanOrEqual(2);

      // Click the close button (the X icon inside a rounded-full button)
      const xIcons = screen.getAllByTestId("icon-x");
      const fullscreenCloseButton = xIcons
        .map((icon) => icon.closest("button"))
        .find((btn) => btn && btn.className.includes("rounded-full"));
      fireEvent.click(fullscreenCloseButton!);

      // Overlay should be gone — title should appear only once (in dialog header)
      expect(screen.getAllByText("Test Story").length).toBe(1);
    });

    it("closes fullscreen overlay when backdrop is clicked", () => {
      render(<ImageEditorDialog {...defaultProps} />);

      // Open fullscreen
      const maximizeIcons = screen.getAllByTestId("icon-maximize");
      const maximizeButton = requiredValue(maximizeIcons[0], "src/components/admin/image-editor-dialog.test.tsx: maximizeIcons[0]").closest("button")!;
      fireEvent.click(maximizeButton);

      // Verify overlay is visible
      expect(screen.getAllByText("Test Story").length).toBeGreaterThanOrEqual(2);

      // Click the backdrop overlay div (the fixed inset-0 div)
      const backdropDiv = screen.getAllByText("Test Story")
        .map((el) => el.closest("div[class*='fixed inset-0']"))
        .find(Boolean);
      expect(backdropDiv).toBeTruthy();
      fireEvent.click(backdropDiv!);

      // Overlay should be dismissed
      expect(screen.getAllByText("Test Story").length).toBe(1);
    });
  });

  describe("Clear upload", () => {
    it("clears selected file when X is clicked", async () => {
      render(<ImageEditorDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Upload"));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByText("test.jpg")).toBeInTheDocument();

      // Find the X button to clear (it's the button containing the X icon near the file name)
      const xIcons = screen.getAllByTestId("icon-x");
      // The clear button is the one within the upload area, near the file name
      const clearButton = xIcons
        .map((icon) => icon.closest("button"))
        .find((btn) => btn && btn.closest("div[class*='flex items-center justify-between']"));
      expect(clearButton).toBeTruthy();
      fireEvent.click(clearButton!);

      // Should show the drop zone again
      expect(screen.getByText("Click or drag")).toBeInTheDocument();
    });
  });

  describe("Placeholder image info", () => {
    const placeholderStory: AdminStory = {
      ...mockStory,
      image: "https://images.unsplash.com/photo-123?w=1920",
      imageSource: `${PLACEHOLDER_PREFIX}Photo by Test Author on Unsplash`,
    };

    it("shows placeholder info note when editing a placeholder image", () => {
      render(<ImageEditorDialog {...defaultProps} story={placeholderStory} />);
      expect(screen.getByText(/placeholder image/i)).toBeInTheDocument();
    });

    it("suggests replacing with a real photo", () => {
      render(<ImageEditorDialog {...defaultProps} story={placeholderStory} />);
      expect(screen.getByText(/replace.*real/i)).toBeInTheDocument();
    });

    it("does not show placeholder info for regular images", () => {
      render(<ImageEditorDialog {...defaultProps} />);
      expect(screen.queryByText(/placeholder image/i)).not.toBeInTheDocument();
    });

    it("does not show placeholder info when story has normal imageSource", () => {
      const normalStory = { ...mockStory, imageSource: "Turismo de Asturias" };
      render(<ImageEditorDialog {...defaultProps} story={normalStory} />);
      expect(screen.queryByText(/placeholder image/i)).not.toBeInTheDocument();
    });

    it("does not show placeholder info when image URL is not from Unsplash even if imageSource has old prefix", () => {
      // Edge case: image was replaced but imageSource in DB still has placeholder prefix
      const storyWithMismatchedSource: AdminStory = {
        ...mockStory,
        image: "https://supabase.co/storage/story-images/real-photo.avif",
        imageSource: `${PLACEHOLDER_PREFIX}Photo by Old Author on Unsplash`,
      };
      render(<ImageEditorDialog {...defaultProps} story={storyWithMismatchedSource} />);
      expect(screen.queryByText(/placeholder image/i)).not.toBeInTheDocument();
    });
  });

  describe("Review existing photos", () => {
    it("reviews a legacy uploaded photo through byte-verifying image PUT", async () => {
      mockUpdateStoryImageUrl.mockResolvedValue({ data: { image: mockStory.image, imageSource: "reviewed" } });
      render(<ImageEditorDialog {...defaultProps} />); await completeReview(); await save();
      expect(mockUpdateStoryImageUrl).toHaveBeenCalledWith("story-1", mockStory.image, expect.any(String));
      expect(mockUpdateStoryImageSource).not.toHaveBeenCalled(); expect(defaultProps.onClose).toHaveBeenCalled();
    });
    it("requires and accepts an explicit first review of a current placeholder-tagged photo", async () => {
      const image = "https://images.unsplash.com/reviewed-manual-photo.jpg";
      mockUpdateStoryImageUrl.mockResolvedValue({ data: { image, imageSource: "reviewed" } });
      render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, image, imageSource: `${PLACEHOLDER_PREFIX}Legacy credit` }} />);
      await completeReview(); await save();
      expect(mockUpdateStoryImageUrl).toHaveBeenCalledWith("story-1", image, expect.any(String));
      expect(mockUpdateStoryImageSource).not.toHaveBeenCalled();
    });
    it("updates a previously reviewed photo through its source-only endpoint", async () => {
      mockUpdateStoryImageSource.mockResolvedValue({ data: { imageSource: "reviewed" } });
      render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, imageSource: imageProvenanceFixture(mockStory.image) }} />);
      await completeReview(); await save(); expect(mockUpdateStoryImageSource).toHaveBeenCalledWith("story-1", expect.any(String));
      expect(mockUpdateStoryImageUrl).not.toHaveBeenCalled();
    });
    it("retains review after source-only failure", async () => {
      mockUpdateStoryImageSource.mockResolvedValue({ error: "Source update failed" });
      render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, imageSource: imageProvenanceFixture(mockStory.image) }} />);
      await completeReview(); await save(); expect(screen.getByText("Source update failed")).toBeInTheDocument(); expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe("Review save recovery", () => {
    it.each([
      ["current", "error"], ["current", "empty"], ["current", "throw"],
      ["reviewed", "empty"], ["reviewed", "throw"], ["upload", "empty"], ["upload", "throw"],
    ])("retains %s photo draft when save returns %s", async (mode, outcome) => {
      const endpoint = mode === "reviewed" ? mockUpdateStoryImageSource : mode === "upload" ? mockUploadStoryImage : mockUpdateStoryImageUrl;
      if (outcome === "throw") endpoint.mockRejectedValue(new Error("Network error"));
      else endpoint.mockResolvedValue(outcome === "error" ? { error: "Imagen rechazada" } : {});
      render(<ImageEditorDialog {...defaultProps} story={mode === "reviewed" ? { ...mockStory, imageSource: imageProvenanceFixture(mockStory.image) } : mockStory} />);
      if (mode === "upload") {
        fireEvent.click(screen.getByText("Upload"));
        fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["bytes"], "photo.jpg", { type: "image/jpeg" })] } });
      }
      await completeReview(); await save();
      expect(endpoint).toHaveBeenCalled(); expect(defaultProps.onClose).not.toHaveBeenCalled(); expect(defaultProps.onUpdate).not.toHaveBeenCalled();
      if (outcome === "error") expect(screen.getByText("Imagen rechazada")).toBeInTheDocument();
      if (outcome === "throw") expect(screen.getByText("Failed to update image")).toBeInTheDocument();
      expect(screen.getByLabelText("Crédito mostrado")).toHaveValue("Reviewed photographer credit");
      expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    });
    it("requires an image when no image or replacement is available", async () => {
      render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, image: "" }} />); await save();
      expect(screen.getByText(/Please provide an image URL/)).toBeInTheDocument();
      expect(mockUpdateStoryImageUrl).not.toHaveBeenCalled(); expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
    it("closes an unchanged existing photo without a write", async () => {
      render(<ImageEditorDialog {...defaultProps} />); await save();
      expect(mockUpdateStoryImageUrl).not.toHaveBeenCalled(); expect(mockUpdateStoryImageSource).not.toHaveBeenCalled(); expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe("Retired guide images", () => {
    it("offers review of current upload instead of PDF-image search", () => {
      render(<ImageEditorDialog {...defaultProps} story={{ ...mockStory, sourcePdf: "guide.pdf" }} />);
      expect(screen.getByText("Actual")).toBeInTheDocument(); expect(screen.queryByText(/Search PDF/)).not.toBeInTheDocument();
      expect(mockSearchContentImages).not.toHaveBeenCalled();
    });
  });

  describe("Unreachable guards (lines 56, 109, 129)", () => {
    // Lines 56, 109, 129: `if (!story) return;` in handleSave, handleApprove, handleMarkNeedsCuration
    // are architecturally unreachable. When story is null, the component returns null on line 154
    // (before rendering any UI), so no buttons exist that could trigger these handlers.
    // These guards are defensive programming — they cannot be exercised via the component's public API.

    it("renders nothing when story is null — handleSave guard (line 56) is unreachable", () => {
      const { container } = render(
        <ImageEditorDialog story={null} onClose={vi.fn()} onUpdate={vi.fn()} />
      );
      expect(container.innerHTML).toBe("");
      // No Save button exists to trigger handleSave
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });

    it("renders nothing when story is null — handleApprove guard (line 109) is unreachable", () => {
      const { container } = render(
        <ImageEditorDialog story={null} onClose={vi.fn()} onUpdate={vi.fn()} />
      );
      expect(container.innerHTML).toBe("");
      // No Approve button exists to trigger handleApprove
      expect(screen.queryByText("Mark as approved")).not.toBeInTheDocument();
    });

    it("renders nothing when story is null — handleMarkNeedsCuration guard (line 129) is unreachable", () => {
      const { container } = render(
        <ImageEditorDialog story={null} onClose={vi.fn()} onUpdate={vi.fn()} />
      );
      expect(container.innerHTML).toBe("");
      // No Pending button exists to trigger handleMarkNeedsCuration
      expect(screen.queryByText("Mark as pending")).not.toBeInTheDocument();
    });
  });
});

it("retains the focused image draft and exact proof after failure, then retries", async () => {
  mockUpdateStoryImageUrl.mockReset().mockResolvedValueOnce({ error: "Retry image" }).mockResolvedValueOnce({ data: { image: "https://example.com/retry.jpg", imageSource: "Retained proof" } });
  const onClose = vi.fn(); const onUpdate = vi.fn();
  render(<ImageEditorDialog story={mockStory} onClose={onClose} onUpdate={onUpdate} />);
  selectUrl("https://example.com/retry.jpg"); await completeReview();
  const url = screen.getByPlaceholderText("https://example.com/image.jpg"); url.focus(); expect(url).toHaveFocus();
  await save(); expect(screen.getByText("Retry image")).toBeInTheDocument(); expect(url).toHaveValue("https://example.com/retry.jpg"); expect(screen.getByPlaceholderText("https://example.com/image.jpg")).toBe(url);
  expect(onClose).not.toHaveBeenCalled(); const proof = mockUpdateStoryImageUrl.mock.calls[0]![2]; await save();
  expect(mockUpdateStoryImageUrl).toHaveBeenNthCalledWith(2, "story-1", "https://example.com/retry.jpg", proof);
  expect(onUpdate).toHaveBeenCalledWith("story-1", { image: "https://example.com/retry.jpg", imageSource: "Retained proof" }); expect(onClose).toHaveBeenCalledTimes(1);
});
