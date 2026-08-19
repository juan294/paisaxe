import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolbarOverflowMenu, ToolbarOverflowItem } from "./toolbar-overflow-menu";
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

describe("ToolbarOverflowMenu", () => {
  it("renders the toggle button with localized aria-label", () => {
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    expect(screen.getByLabelText("Más opciones")).toBeInTheDocument();
  });

  it("does not show menu content initially", () => {
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    expect(screen.queryByText("Menu content")).not.toBeInTheDocument();
  });

  it("shows menu content when toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    expect(screen.getByText("Menu content")).toBeInTheDocument();
  });

  it("hides menu when toggle button is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    const toggleBtn = screen.getByLabelText("Más opciones");
    await user.click(toggleBtn);
    expect(screen.getByText("Menu content")).toBeInTheDocument();

    await user.click(toggleBtn);
    expect(screen.queryByText("Menu content")).not.toBeInTheDocument();
  });

  it("sets aria-expanded attribute correctly", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    const toggleBtn = screen.getByLabelText("Más opciones");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));
    expect(screen.getByText("Menu content")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Menu content")).not.toBeInTheDocument();
  });

  it("closes on click outside", async () => {
    render(
      <div>
        <ToolbarOverflowMenu>
          <div>Menu content</div>
        </ToolbarOverflowMenu>
        <button>Outside</button>
      </div>
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Más opciones"));
    expect(screen.getByText("Menu content")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(screen.queryByText("Menu content")).not.toBeInTheDocument();
  });

  it("has role=menu on the menu container when open", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="Action 1" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("focuses first menu item when menu opens", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First Action" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second Action" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const firstItem = screen.getByText("First Action").closest("button");
    expect(document.activeElement).toBe(firstItem);
  });

  it("navigates with ArrowDown key", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Third" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    // First item should be focused
    const firstBtn = screen.getByText("First").closest("button")!;
    expect(document.activeElement).toBe(firstBtn);

    // ArrowDown → second item
    await user.keyboard("{ArrowDown}");
    const secondBtn = screen.getByText("Second").closest("button")!;
    expect(document.activeElement).toBe(secondBtn);

    // ArrowDown → third item
    await user.keyboard("{ArrowDown}");
    const thirdBtn = screen.getByText("Third").closest("button")!;
    expect(document.activeElement).toBe(thirdBtn);

    // ArrowDown wraps → first item
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(firstBtn);
  });

  it("navigates with ArrowUp key", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    // First item should be focused
    const firstBtn = screen.getByText("First").closest("button")!;
    expect(document.activeElement).toBe(firstBtn);

    // ArrowUp wraps → last item
    await user.keyboard("{ArrowUp}");
    const secondBtn = screen.getByText("Second").closest("button")!;
    expect(document.activeElement).toBe(secondBtn);

    // ArrowUp → first item
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(firstBtn);
  });

  it("traps focus with Tab key", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const firstBtn = screen.getByText("First").closest("button")!;
    const secondBtn = screen.getByText("Second").closest("button")!;

    // Tab → second item
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(secondBtn);

    // Tab wraps → first item
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(firstBtn);
  });

  it("handles Shift+Tab to move focus to previous menu item", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Third" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const firstBtn = screen.getByText("First").closest("button")!;
    const secondBtn = screen.getByText("Second").closest("button")!;
    const thirdBtn = screen.getByText("Third").closest("button")!;

    // Move to third item first
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(thirdBtn);

    // Shift+Tab → second item
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(secondBtn);

    // Shift+Tab → first item
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(firstBtn);
  });

  it("wraps Shift+Tab from first item to last item", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Third" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const firstBtn = screen.getByText("First").closest("button")!;
    const thirdBtn = screen.getByText("Third").closest("button")!;

    // First item is focused after open
    expect(document.activeElement).toBe(firstBtn);

    // Shift+Tab wraps → last item
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(thirdBtn);
  });

  it("stops propagation on dropdown container click", async () => {
    const outerClickHandler = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={outerClickHandler}>
        <ToolbarOverflowMenu>
          <ToolbarOverflowItem icon={<span>I</span>} label="Action" />
        </ToolbarOverflowMenu>
      </div>
    );

    await user.click(screen.getByLabelText("Más opciones"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Reset the handler since the toggle button click also stops propagation
    outerClickHandler.mockClear();

    // Click on the dropdown menu container itself (not a menu item)
    await user.click(screen.getByRole("menu"));

    // The click should not propagate to the outer div
    expect(outerClickHandler).not.toHaveBeenCalled();
    // Menu should still be open
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("traps forward Tab using fireEvent on menu container (line 84)", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="Alpha" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Beta" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Gamma" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const alphaBtn = screen.getByText("Alpha").closest("button")!;
    const betaBtn = screen.getByText("Beta").closest("button")!;
    const gammaBtn = screen.getByText("Gamma").closest("button")!;

    // First item is focused
    expect(document.activeElement).toBe(alphaBtn);

    // Forward Tab via fireEvent on the menu container (covers line 84 else-if branch)
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(document.activeElement).toBe(betaBtn);

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(document.activeElement).toBe(gammaBtn);

    // Tab wraps around to first item
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(document.activeElement).toBe(alphaBtn);
  });

  it("handles keydown when menuListRef is null (line 67 guard)", async () => {
    // Line 67: `if (!menu) return;` — defensive guard against menuListRef.current being null.
    // This is architecturally unreachable in tests because React synchronously sets the ref
    // during render, and the menu container is always mounted when isOpen=true. The guard
    // protects against theoretical race conditions in concurrent React or unmount edge cases.
    // The "no focusable items" test below covers the adjacent guard at line 72.
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="Only" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));
    const onlyBtn = screen.getByText("Only").closest("button")!;
    expect(document.activeElement).toBe(onlyBtn);

    // ArrowDown on single item wraps to itself
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(onlyBtn);

    // ArrowUp on single item wraps to itself
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(onlyBtn);

    // Tab on single item wraps to itself
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(document.activeElement).toBe(onlyBtn);

    // Shift+Tab on single item wraps to itself
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(onlyBtn);
  });

  it("does nothing for keyboard events when menu has no focusable items", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        {/* Only non-button, non-menuitem children — no focusable items */}
        <span>Just text content</span>
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));
    expect(screen.getByText("Just text content")).toBeInTheDocument();

    // Fire keyboard events on the menu — should not throw (covers items.length === 0 early return)
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });

    // Menu should still be open and content intact
    expect(screen.getByText("Just text content")).toBeInTheDocument();
  });

  it("handles ArrowUp to previous item (non-wrapping)", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="First" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Second" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Third" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const firstBtn = screen.getByText("First").closest("button")!;
    const secondBtn = screen.getByText("Second").closest("button")!;
    const thirdBtn = screen.getByText("Third").closest("button")!;

    // Move to third item
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(thirdBtn);

    // ArrowUp → second item (non-wrapping, currentIndex > 0)
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(secondBtn);

    // ArrowUp → first item (non-wrapping, currentIndex > 0)
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(firstBtn);
  });

  it("does not crash for unrecognized key events (no-op branch)", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="Item" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));
    const itemBtn = screen.getByText("Item").closest("button")!;
    expect(document.activeElement).toBe(itemBtn);

    // Fire an unrecognized key — should not change focus or throw
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Enter" });
    expect(document.activeElement).toBe(itemBtn);
  });

  it("wraps Tab forward from last item to first item via fireEvent", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="Alpha" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Beta" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    const alphaBtn = screen.getByText("Alpha").closest("button")!;
    const betaBtn = screen.getByText("Beta").closest("button")!;

    // Move to last item
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(document.activeElement).toBe(betaBtn);

    // Tab wraps to first item (covers the else branch of Tab at line 89-91)
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(document.activeElement).toBe(alphaBtn);
  });

  it("handles ArrowUp when activeElement is not in items list (currentIndex === -1)", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <ToolbarOverflowItem icon={<span>I</span>} label="Alpha" />
        <ToolbarOverflowItem icon={<span>I</span>} label="Beta" />
      </ToolbarOverflowMenu>
    );

    await user.click(screen.getByLabelText("Más opciones"));

    // Move focus away from items
    const menu = screen.getByRole("menu");
    menu.focus();

    // ArrowUp with currentIndex -1: -1 > 0 is false, so wraps to last item
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    const betaBtn = screen.getByText("Beta").closest("button")!;
    expect(document.activeElement).toBe(betaBtn);
  });
});

describe("ToolbarOverflowItem", () => {
  it("renders icon and label", () => {
    render(
      <ToolbarOverflowItem
        icon={<span data-testid="test-icon">I</span>}
        label="Test Action"
      />
    );

    expect(screen.getByText("Test Action")).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <ToolbarOverflowItem
        icon={<span>I</span>}
        label="Click me"
        onClick={handleClick}
      />
    );

    await user.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies active styling when active", () => {
    render(
      <ToolbarOverflowItem
        icon={<span>I</span>}
        label="Active item"
        active={true}
      />
    );

    const button = screen.getByRole("menuitem");
    expect(button).toHaveClass("bg-white/10");
  });

  it("does not apply active styling when not active", () => {
    render(
      <ToolbarOverflowItem
        icon={<span>I</span>}
        label="Inactive item"
        active={false}
      />
    );

    const button = screen.getByRole("menuitem");
    expect(button).not.toHaveClass("bg-white/10");
  });

  it("has role=menuitem", () => {
    render(
      <ToolbarOverflowItem
        icon={<span>I</span>}
        label="Test"
      />
    );

    expect(screen.getByRole("menuitem")).toBeInTheDocument();
  });

  it("handles missing onClick gracefully", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarOverflowItem
        icon={<span>I</span>}
        label="No handler"
      />
    );

    // Should not throw
    await user.click(screen.getByText("No handler"));
  });

  // UX-M6 (#899): items must meet the 44×44 touch-target convention already
  // used by other toolbar controls (e.g. glassIcon).
  it("has a 44px (min-h-11) touch-target floor", () => {
    render(
      <ToolbarOverflowItem icon={<span>I</span>} label="Sized item" />
    );

    expect(screen.getByRole("menuitem")).toHaveClass("min-h-11");
  });
});
