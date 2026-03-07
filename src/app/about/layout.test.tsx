import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutLayout from "./layout";

describe("AboutLayout", () => {
  it("renders children", () => {
    render(<AboutLayout><div>child content</div></AboutLayout>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
