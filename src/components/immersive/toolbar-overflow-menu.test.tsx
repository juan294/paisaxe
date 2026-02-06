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
});
