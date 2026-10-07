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
      expect(button).toHaveClass("focus-visible:ring-offset-neutral-950");
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

  describe("dark-surface variants (booking UI polish, U01/U07/U16)", () => {
    const DARK_FOCUS = [
      "focus-visible:ring-2",
      "focus-visible:ring-white/70",
      "focus-visible:ring-offset-2",
      "focus-visible:ring-offset-neutral-950",
    ];

    it("brand is the paisaxe-green gradient with black text", () => {
      render(<Button variant="brand">Entrar</Button>);
      expect(screen.getByRole("button")).toHaveClass(
        "bg-gradient-to-r",
        "from-paisaxe-green-500",
        "to-paisaxe-green-400",
        "text-black",
        "hover:from-paisaxe-green-400",
        "hover:to-paisaxe-green-300",
        ...DARK_FOCUS
      );
    });

    it("paypal is PayPal gold with dark text", () => {
      render(<Button variant="paypal">Pagar</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-[#FFC439]", "text-[#111111]", "hover:bg-[#F2BA36]", ...DARK_FOCUS);
    });

    it("glassDestructive is a red tint, never solid red", () => {
      render(<Button variant="glassDestructive">Cancelar</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-red-500/10", "text-red-200", "border-red-400/40", ...DARK_FOCUS);
      expect(button).not.toHaveClass("bg-destructive");
    });

    it("glass keeps its exact class string", () => {
      expect(buttonVariants({ variant: "glass" })).toBe(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 h-9 px-4 py-2"
      );
    });

    it("buttonVariants styles an anchor as a PayPal button", () => {
      render(
        <a href="https://example.test" className={buttonVariants({ variant: "paypal" })}>
          Pagar con PayPal
        </a>
      );
      expect(screen.getByRole("link", { name: "Pagar con PayPal" })).toHaveClass("bg-[#FFC439]");
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
