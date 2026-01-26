import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";

describe("Card", () => {
  describe("Card component", () => {
    it("should render card with children", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("should have base styling classes", () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("rounded-xl", "border", "bg-card", "shadow");
    });

    it("should merge custom className", () => {
      render(
        <Card className="custom-card" data-testid="card">
          Content
        </Card>
      );
      expect(screen.getByTestId("card")).toHaveClass("custom-card");
    });

    it("should forward ref", () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Content</Card>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });

    it("should pass through HTML attributes", () => {
      render(
        <Card id="my-card" data-testid="card" role="region">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toHaveAttribute("id", "my-card");
      expect(card).toHaveAttribute("role", "region");
    });
  });

  describe("CardHeader component", () => {
    it("should render header with children", () => {
      render(<CardHeader>Header content</CardHeader>);
      expect(screen.getByText("Header content")).toBeInTheDocument();
    });

    it("should have base styling classes", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      const header = screen.getByTestId("header");
      expect(header).toHaveClass("flex", "flex-col", "space-y-1.5", "p-6");
    });

    it("should merge custom className", () => {
      render(
        <CardHeader className="custom-header" data-testid="header">
          Header
        </CardHeader>
      );
      expect(screen.getByTestId("header")).toHaveClass("custom-header");
    });

    it("should forward ref", () => {
      const ref = vi.fn();
      render(<CardHeader ref={ref}>Header</CardHeader>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("CardTitle component", () => {
    it("should render title with children", () => {
      render(<CardTitle>Card Title</CardTitle>);
      expect(screen.getByText("Card Title")).toBeInTheDocument();
    });

    it("should have base styling classes", () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId("title");
      expect(title).toHaveClass("font-semibold", "leading-none", "tracking-tight");
    });

    it("should merge custom className", () => {
      render(
        <CardTitle className="custom-title" data-testid="title">
          Title
        </CardTitle>
      );
      expect(screen.getByTestId("title")).toHaveClass("custom-title");
    });

    it("should forward ref", () => {
      const ref = vi.fn();
      render(<CardTitle ref={ref}>Title</CardTitle>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("CardDescription component", () => {
    it("should render description with children", () => {
      render(<CardDescription>Card description text</CardDescription>);
      expect(screen.getByText("Card description text")).toBeInTheDocument();
    });

    it("should have base styling classes", () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>);
      const desc = screen.getByTestId("desc");
      expect(desc).toHaveClass("text-sm", "text-muted-foreground");
    });

    it("should merge custom className", () => {
      render(
        <CardDescription className="custom-desc" data-testid="desc">
          Description
        </CardDescription>
      );
      expect(screen.getByTestId("desc")).toHaveClass("custom-desc");
    });

    it("should forward ref", () => {
      const ref = vi.fn();
      render(<CardDescription ref={ref}>Description</CardDescription>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("CardContent component", () => {
    it("should render content with children", () => {
      render(<CardContent>Content here</CardContent>);
      expect(screen.getByText("Content here")).toBeInTheDocument();
    });

    it("should have base styling classes", () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId("content");
      expect(content).toHaveClass("p-6", "pt-0");
    });

    it("should merge custom className", () => {
      render(
        <CardContent className="custom-content" data-testid="content">
          Content
        </CardContent>
      );
      expect(screen.getByTestId("content")).toHaveClass("custom-content");
    });

    it("should forward ref", () => {
      const ref = vi.fn();
      render(<CardContent ref={ref}>Content</CardContent>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("CardFooter component", () => {
    it("should render footer with children", () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("should have base styling classes", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId("footer");
      expect(footer).toHaveClass("flex", "items-center", "p-6", "pt-0");
    });

    it("should merge custom className", () => {
      render(
        <CardFooter className="custom-footer" data-testid="footer">
          Footer
        </CardFooter>
      );
      expect(screen.getByTestId("footer")).toHaveClass("custom-footer");
    });

    it("should forward ref", () => {
      const ref = vi.fn();
      render(<CardFooter ref={ref}>Footer</CardFooter>);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Card composition", () => {
    it("should render complete card with all subcomponents", () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>A test description</CardDescription>
          </CardHeader>
          <CardContent>Main content goes here</CardContent>
          <CardFooter>Footer actions</CardFooter>
        </Card>
      );

      expect(screen.getByTestId("card")).toBeInTheDocument();
      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("A test description")).toBeInTheDocument();
      expect(screen.getByText("Main content goes here")).toBeInTheDocument();
      expect(screen.getByText("Footer actions")).toBeInTheDocument();
    });
  });
});
