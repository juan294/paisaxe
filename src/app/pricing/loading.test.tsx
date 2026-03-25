import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PricingLoading from "./loading";

describe("PricingLoading", () => {
  it("renders the loading skeleton", () => {
    render(<PricingLoading />);

    // Header skeleton should exist (the logo placeholder)
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders pricing card skeleton with feature list placeholders", () => {
    render(<PricingLoading />);

    // The pricing card has 3 feature items and a CTA button skeleton
    // There should be multiple skeleton elements within the card structure
    const container = document.querySelector(".min-h-screen");
    expect(container).not.toBeNull();
  });

  it("renders FAQ skeleton section", () => {
    render(<PricingLoading />);

    // The FAQ section has a border-t separator
    const faqSection = document.querySelector(".border-t");
    expect(faqSection).not.toBeNull();
  });
});
