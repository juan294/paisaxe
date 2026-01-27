import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ImmersiveLayout, { metadata } from "./layout";

describe("ImmersiveLayout", () => {
  it("renders children", () => {
    const { getByText } = render(
      <ImmersiveLayout>
        <div>Test content</div>
      </ImmersiveLayout>
    );
    expect(getByText("Test content")).toBeInTheDocument();
  });

  it("renders JsonLd component", () => {
    const { container } = render(
      <ImmersiveLayout>
        <div>Content</div>
      </ImmersiveLayout>
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(script).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata.title).toBe("Explora Asturias | Paisaxe");
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.twitter).toBeDefined();
    expect(metadata.alternates?.canonical).toBe(
      "https://paisaxe.com/immersive"
    );
  });
});
