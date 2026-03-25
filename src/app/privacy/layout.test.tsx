import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyLayout from "./layout";

describe("PrivacyLayout", () => {
  it("renders children", () => {
    render(<PrivacyLayout><div>child content</div></PrivacyLayout>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
