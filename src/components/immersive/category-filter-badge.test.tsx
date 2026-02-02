import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryFilterBadge } from "./category-filter-badge";
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
  DURATION_LABELS,
} from "@/types/immersive";
import { createMockT } from "@/test/i18n-mock";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// --- Mock lucide-react ---
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
}));

// --- Default props ---
const defaultProps = {
  currentCategory: "nature" as const,
  selectedCategory: null,
  selectedLocation: null,
  selectedDuration: null,
  onCategoryChange: vi.fn(),
  onLocationChange: vi.fn(),
  onDurationChange: vi.fn(),
  onClearAll: vi.fn(),
  visible: true,
};

function renderBadge(overrides = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<CategoryFilterBadge {...props} />);
}

// Helper to get toggle button (first element with category label)
function getToggleButton(label: string) {
  return screen.getAllByText(label)[0];
}

describe("CategoryFilterBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders toggle button with current category label", () => {
    renderBadge();
    // Multiple elements may exist (toggle + dropdown chip)
    expect(screen.getAllByText(CATEGORY_LABELS.nature).length).toBeGreaterThanOrEqual(1);
  });

  it("renders toggle button with selected category label when selected", () => {
    renderBadge({ selectedCategory: "food" });
    expect(screen.getAllByText(CATEGORY_LABELS.food).length).toBeGreaterThanOrEqual(1);
  });

  it("shows filter count badge when filters are active", () => {
    renderBadge({
      selectedCategory: "cities",
      selectedLocation: "eastern",
    });
    // 2 active filters
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show filter count badge when no filters active", () => {
    renderBadge();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // The count badge should not render when activeFilterCount is 0
  });

  it("clicking toggle opens dropdown", () => {
    const { container } = renderBadge();

    // Dropdown should be hidden initially (via CSS)
    const dropdown = container.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
    expect(dropdown).not.toBeNull();

    // Click toggle button (first element with category label)
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Dropdown should now be visible
    const visibleDropdown = container.querySelector('[class*="opacity-100"][class*="pointer-events-auto"]');
    expect(visibleDropdown).not.toBeNull();
  });

  it("dropdown shows all category options", () => {
    renderBadge();
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // "Naturaleza" appears twice: in the toggle button and in the dropdown chip
    for (const label of Object.values(CATEGORY_LABELS)) {
      const matches = screen.getAllByText(label);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("dropdown shows all location options", () => {
    renderBadge();
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    for (const label of Object.values(LOCATION_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("dropdown shows all duration options", () => {
    renderBadge();
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    for (const label of Object.values(DURATION_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("clicking category chip calls onCategoryChange with category", () => {
    const onCategoryChange = vi.fn();
    renderBadge({ onCategoryChange });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Click a category chip (pick "Ciudades" = cities)
    fireEvent.click(screen.getByText(CATEGORY_LABELS.cities));

    expect(onCategoryChange).toHaveBeenCalledWith("cities");
  });

  it("clicking location chip calls onLocationChange with location", () => {
    const onLocationChange = vi.fn();
    renderBadge({ onLocationChange });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Click a location chip
    fireEvent.click(screen.getByText(LOCATION_LABELS.eastern));

    expect(onLocationChange).toHaveBeenCalledWith("eastern");
  });

  it("clicking duration chip calls onDurationChange with duration", () => {
    const onDurationChange = vi.fn();
    renderBadge({ onDurationChange });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Click a duration chip
    fireEvent.click(screen.getByText(DURATION_LABELS.weekend));

    expect(onDurationChange).toHaveBeenCalledWith("weekend");
  });

  it("clicking already-selected category deselects (passes null)", () => {
    const onCategoryChange = vi.fn();
    renderBadge({ selectedCategory: "cities", onCategoryChange });

    // Open dropdown - "Ciudades" appears in toggle button
    const allCiudades = screen.getAllByText(CATEGORY_LABELS.cities);
    fireEvent.click(allCiudades[0]); // click toggle to open

    // Now "Ciudades" appears both in the toggle and as a chip in the dropdown
    const allCiudadesAfterOpen = screen.getAllByText(CATEGORY_LABELS.cities);
    // Click the chip in the dropdown (last occurrence)
    fireEvent.click(allCiudadesAfterOpen[allCiudadesAfterOpen.length - 1]);

    expect(onCategoryChange).toHaveBeenCalledWith(null);
  });

  it("clicking already-selected location deselects (passes null)", () => {
    const onLocationChange = vi.fn();
    renderBadge({ selectedLocation: "central", onLocationChange });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Click the already-selected location
    fireEvent.click(screen.getByText(LOCATION_LABELS.central));

    expect(onLocationChange).toHaveBeenCalledWith(null);
  });

  it("clicking already-selected duration deselects (passes null)", () => {
    const onDurationChange = vi.fn();
    renderBadge({ selectedDuration: "weekend", onDurationChange });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Click the already-selected duration
    fireEvent.click(screen.getByText(DURATION_LABELS.weekend));

    expect(onDurationChange).toHaveBeenCalledWith(null);
  });

  it("clear all button appears when filters are active", () => {
    renderBadge({ selectedCategory: "food" });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.food));

    // Clear button should be visible (opacity-100)
    const clearButton = screen.getByText(mockT("stories.filters.clear"));
    expect(clearButton).toBeInTheDocument();
    expect(clearButton.className).toContain("opacity-100");
  });

  it("clear all button is hidden when no filters active", () => {
    renderBadge();

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Clear button should be hidden via CSS (opacity-0)
    const clearButton = screen.getByText(mockT("stories.filters.clear"));
    expect(clearButton.className).toContain("opacity-0");
    expect(clearButton.className).toContain("pointer-events-none");
  });

  it("clear all calls onClearAll and closes dropdown", () => {
    const onClearAll = vi.fn();
    const { container } = renderBadge({ selectedCategory: "food", onClearAll });

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.food));

    // Click clear all
    fireEvent.click(screen.getByText(mockT("stories.filters.clear")));

    expect(onClearAll).toHaveBeenCalled();

    // Dropdown should close (hidden via CSS)
    const hiddenDropdown = container.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
    expect(hiddenDropdown).not.toBeNull();
  });

  it("click outside closes dropdown", () => {
    const { container } = renderBadge();

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Click outside
    fireEvent.mouseDown(document);

    // Dropdown should close (hidden via CSS)
    const hiddenDropdown = container.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
    expect(hiddenDropdown).not.toBeNull();
  });

  it("escape key closes dropdown", () => {
    const { container } = renderBadge();

    // Open dropdown
    fireEvent.click(getToggleButton(CATEGORY_LABELS.nature));

    // Press escape
    fireEvent.keyDown(document, { key: "Escape" });

    // Dropdown should close (hidden via CSS)
    const hiddenDropdown = container.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
    expect(hiddenDropdown).not.toBeNull();
  });

  it("has opacity-0 and pointer-events-none classes when visible is false", () => {
    const { container } = renderBadge({ visible: false });

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("opacity-0");
    expect(outerDiv.className).toContain("pointer-events-none");
  });

  it("has opacity-100 class when visible is true", () => {
    const { container } = renderBadge({ visible: true });

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("opacity-100");
  });

  it("shows filter count of 3 when all filter types active", () => {
    renderBadge({
      selectedCategory: "nature",
      selectedLocation: "eastern",
      selectedDuration: "weekend",
    });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("clicking toggle again closes the dropdown", () => {
    const { container } = renderBadge();

    const toggleButton = getToggleButton(CATEGORY_LABELS.nature);

    // Open
    fireEvent.click(toggleButton);
    const visibleDropdown = container.querySelector('[class*="opacity-100"][class*="pointer-events-auto"]');
    expect(visibleDropdown).not.toBeNull();

    // Close by clicking toggle again
    fireEvent.click(toggleButton);
    const hiddenDropdown = container.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
    expect(hiddenDropdown).not.toBeNull();
  });
});
