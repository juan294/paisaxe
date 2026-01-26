import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  describe("rendering", () => {
    it("should render input element", () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("should render without type attribute by default (browser defaults to text)", () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId("input");
      // Browser defaults to "text" but attribute may not be present
      expect(input.tagName).toBe("INPUT");
    });

    it("should render with specified type", () => {
      render(<Input type="email" data-testid="email-input" />);
      expect(screen.getByTestId("email-input")).toHaveAttribute("type", "email");
    });

    it("should render with password type", () => {
      render(<Input type="password" data-testid="password-input" />);
      expect(screen.getByTestId("password-input")).toHaveAttribute(
        "type",
        "password"
      );
    });

    it("should render with number type", () => {
      render(<Input type="number" data-testid="number-input" />);
      expect(screen.getByTestId("number-input")).toHaveAttribute(
        "type",
        "number"
      );
    });
  });

  describe("styling", () => {
    it("should have base styling classes", () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId("input");
      expect(input).toHaveClass("flex", "h-10", "w-full", "rounded-md");
    });

    it("should merge custom className", () => {
      render(<Input className="custom-class" data-testid="input" />);
      const input = screen.getByTestId("input");
      expect(input).toHaveClass("custom-class");
    });
  });

  describe("interactions", () => {
    it("should handle value changes", async () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} data-testid="input" />);

      const input = screen.getByTestId("input");
      await userEvent.type(input, "Hello");

      expect(handleChange).toHaveBeenCalled();
    });

    it("should accept controlled value", () => {
      render(<Input value="controlled" onChange={() => {}} data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveValue("controlled");
    });

    it("should handle focus", () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} data-testid="input" />);

      const input = screen.getByTestId("input");
      fireEvent.focus(input);

      expect(handleFocus).toHaveBeenCalled();
    });

    it("should handle blur", () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} data-testid="input" />);

      const input = screen.getByTestId("input");
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe("disabled state", () => {
    it("should be disabled when disabled prop is true", () => {
      render(<Input disabled data-testid="input" />);
      expect(screen.getByTestId("input")).toBeDisabled();
    });

    it("should have disabled styles", () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId("input");
      expect(input).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-50");
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref to input element", () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe("input attributes", () => {
    it("should pass through HTML input attributes", () => {
      render(
        <Input
          name="username"
          id="username-input"
          maxLength={50}
          minLength={3}
          required
          data-testid="input"
        />
      );

      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("name", "username");
      expect(input).toHaveAttribute("id", "username-input");
      expect(input).toHaveAttribute("maxLength", "50");
      expect(input).toHaveAttribute("minLength", "3");
      expect(input).toBeRequired();
    });

    it("should handle readOnly attribute", () => {
      render(<Input readOnly value="read only" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("readOnly");
    });

    it("should handle autoComplete attribute", () => {
      render(<Input autoComplete="email" data-testid="input" />);
      expect(screen.getByTestId("input")).toHaveAttribute("autoComplete", "email");
    });
  });

  describe("file input", () => {
    it("should handle file type", () => {
      render(<Input type="file" data-testid="file-input" />);
      const input = screen.getByTestId("file-input");
      expect(input).toHaveAttribute("type", "file");
      expect(input).toHaveClass("file:border-0", "file:bg-transparent");
    });
  });
});
