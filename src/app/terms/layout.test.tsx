import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsLayout from "./layout";

describe("TermsLayout", () => {
  it("renders children", () => {
    render(<TermsLayout><div>child content</div></TermsLayout>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
