import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurationBadge } from "./curation-badge";

describe("CurationBadge", () => {
  describe("default variant", () => {
    it("should render approved status", () => {
      render(<CurationBadge status="approved" />);
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });

    it("should render needs_curation status as Pending", () => {
      render(<CurationBadge status="needs_curation" />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should have emerald indicator for approved", () => {
      const { container } = render(<CurationBadge status="approved" />);
      const indicator = container.querySelector(".bg-emerald-500");
      expect(indicator).toBeInTheDocument();
    });

    it("should have amber indicator for needs_curation", () => {
      const { container } = render(<CurationBadge status="needs_curation" />);
      const indicator = container.querySelector(".bg-amber-500");
      expect(indicator).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      const { container } = render(
        <CurationBadge status="approved" className="custom-class" />
      );
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("minimal variant", () => {
    it("should render approved status in minimal variant", () => {
      render(<CurationBadge status="approved" variant="minimal" />);
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });

    it("should render needs_curation as Pending in minimal variant", () => {
      render(<CurationBadge status="needs_curation" variant="minimal" />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should have smaller text in minimal variant", () => {
      const { container } = render(
        <CurationBadge status="approved" variant="minimal" />
      );
      const text = container.querySelector(".text-xs");
      expect(text).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should have rounded-md class in default variant", () => {
      const { container } = render(<CurationBadge status="approved" />);
      expect(container.firstChild).toHaveClass("rounded-md");
    });

    it("should have appropriate background for approved in default variant", () => {
      const { container } = render(<CurationBadge status="approved" />);
      expect(container.firstChild).toHaveClass("bg-neutral-100");
    });

    it("should have amber background for needs_curation in default variant", () => {
      const { container } = render(<CurationBadge status="needs_curation" />);
      expect(container.firstChild).toHaveClass("bg-amber-200");
    });
  });
});
