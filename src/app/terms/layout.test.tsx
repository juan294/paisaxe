import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsLayout, { revalidate } from "./layout";

describe("TermsLayout", () => {
  it("should export revalidate set to 3600 (1 hour ISR)", () => {
    expect(revalidate).toBe(3600);
  });

  it("renders children", () => {
    render(<TermsLayout><div>child content</div></TermsLayout>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
