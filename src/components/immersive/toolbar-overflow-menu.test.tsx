import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolbarOverflowMenu, ToolbarOverflowItem } from "./toolbar-overflow-menu";

describe("ToolbarOverflowMenu", () => {
  it("renders the toggle button", () => {
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    expect(screen.getByLabelText("More options")).toBeInTheDocument();
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

    await user.click(screen.getByLabelText("More options"));

    expect(screen.getByText("Menu content")).toBeInTheDocument();
  });

  it("hides menu when toggle button is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarOverflowMenu>
        <div>Menu content</div>
      </ToolbarOverflowMenu>
    );

    const toggleBtn = screen.getByLabelText("More options");
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

    const toggleBtn = screen.getByLabelText("More options");
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

    await user.click(screen.getByLabelText("More options"));
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
    await user.click(screen.getByLabelText("More options"));
    expect(screen.getByText("Menu content")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(screen.queryByText("Menu content")).not.toBeInTheDocument();
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

    const button = screen.getByRole("button");
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

    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("bg-white/10");
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
