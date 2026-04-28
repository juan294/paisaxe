import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  describe("rendering", () => {
    it("should render button with children", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("should render with default variant", () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-primary");
    });

    it("should render with destructive variant", () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive");
    });

    it("should render with outline variant", () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-input");
    });

    it("should render with secondary variant", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-secondary");
    });

    it("should render with ghost variant", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-accent");
    });

    it("should render with link variant", () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("underline-offset-4");
    });
  });

  describe("sizes", () => {
    it("should render with default size", () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9");
    });

    it("should render with sm size", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-8");
    });

    it("should render with lg size", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10");
    });

    it("should render with icon size", () => {
      render(<Button size="icon">I</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("w-9");
    });
  });

  describe("interactions", () => {
    it("should call onClick handler when clicked", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("should have disabled styles when disabled", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("disabled:opacity-50");
    });
  });

  describe("asChild", () => {
    it("should render as child element when asChild is true", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      const link = screen.getByRole("link", { name: "Link Button" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });
  });

  describe("custom className", () => {
    it("should merge custom className", () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("buttonVariants", () => {
    it("should return correct class string for default variant", () => {
      const classes = buttonVariants({ variant: "default" });
      expect(classes).toContain("bg-primary");
    });

    it("should return correct class string for custom variant and size", () => {
      const classes = buttonVariants({ variant: "outline", size: "lg" });
      expect(classes).toContain("border-input");
      expect(classes).toContain("h-10");
    });
  });

  describe("glass variant", () => {
    it("should render with glass variant classes", () => {
      render(<Button variant="glass">Glass</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-white/10");
      expect(button).toHaveClass("rounded-full");
      expect(button).toHaveClass("backdrop-blur-sm");
    });

    it("should have hover glass style", () => {
      render(<Button variant="glass">Glass</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-white/20");
    });

    it("should have focus-visible ring for accessibility", () => {
      render(<Button variant="glass">Glass</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus-visible:ring-white/70");
    });

    it("buttonVariants should return glass classes", () => {
      const classes = buttonVariants({ variant: "glass" });
      expect(classes).toContain("bg-white/10");
      expect(classes).toContain("rounded-full");
      expect(classes).toContain("backdrop-blur-sm");
    });
  });

  describe("glassIcon variant", () => {
    it("should render with glassIcon variant classes", () => {
      render(<Button variant="glassIcon" aria-label="icon">X</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-white/10");
      expect(button).toHaveClass("rounded-full");
      expect(button).toHaveClass("backdrop-blur-sm");
    });

    it("should have icon-appropriate padding", () => {
      render(<Button variant="glassIcon" aria-label="icon">X</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("p-3");
    });

    it("should have hover glass style", () => {
      render(<Button variant="glassIcon" aria-label="icon">X</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-white/20");
    });

    it("should have focus-visible ring with offset for accessibility", () => {
      render(<Button variant="glassIcon" aria-label="icon">X</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus-visible:ring-white/70");
      expect(button).toHaveClass("focus-visible:ring-offset-black");
    });

    it("should respect motion-reduce preference", () => {
      render(<Button variant="glassIcon" aria-label="icon">X</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("motion-reduce:transition-none");
    });

    it("buttonVariants should return glassIcon classes", () => {
      const classes = buttonVariants({ variant: "glassIcon" });
      expect(classes).toContain("p-3");
      expect(classes).toContain("rounded-full");
      expect(classes).toContain("bg-white/10");
      expect(classes).toContain("backdrop-blur-sm");
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref to button element", () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Ref Button</Button>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe("button attributes", () => {
    it("should pass through HTML button attributes", () => {
      render(
        <Button type="submit" name="submit-btn" data-testid="test-button">
          Submit
        </Button>
      );
      const button = screen.getByTestId("test-button");
      expect(button).toHaveAttribute("type", "submit");
      expect(button).toHaveAttribute("name", "submit-btn");
    });
  });
});
