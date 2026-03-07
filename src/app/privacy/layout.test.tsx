import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyLayout, { revalidate } from "./layout";

describe("PrivacyLayout", () => {
  it("should export revalidate set to 3600 (1 hour ISR)", () => {
    expect(revalidate).toBe(3600);
  });

  it("renders children", () => {
    render(<PrivacyLayout><div>child content</div></PrivacyLayout>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
