import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { imageProvenanceFixture } from "@/test/image-provenance-fixture";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "@/lib/image-provenance";
import { ImageAttribution, PermittedStoryImage } from "./permitted-story-image";
// Native img is the isolated Next Image test adapter.
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, blurDataURL: _blur, ...props }: Record<string, unknown>) => <img {...props} /> }));

describe("Reviewed story photos", () => {
  it("never requests unreviewed bytes and discloses the thematic fallback", () => {
    render(<PermittedStoryImage image="https://example.com/old-guide.webp" imageSource="old credit" width={200} height={100} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    expect(screen.getByRole("img")).toHaveAttribute("alt", NEUTRAL_CREDIT);
    expect(screen.getByText(NEUTRAL_CREDIT)).toBeVisible();
  });
  it("renders reviewed alt and linked credit; a failed photo cannot restore a guide fallback", () => {
    const path = "https://example.com/reviewed.avif";
    render(<PermittedStoryImage image={path} imageSource={imageProvenanceFixture(path)} width={200} height={100} />);
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Synthetic geometric fixture");
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com/synthetic-photo-review");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    expect(screen.getByRole("img")).toHaveAttribute("alt", NEUTRAL_CREDIT);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(NEUTRAL_CREDIT)).toBeVisible();
  });
  it("accepts a newly reviewed image after an earlier failure", () => {
    const first="https://example.com/one.avif", second="https://example.com/two.avif";
    const { rerender }=render(<PermittedStoryImage image={first} imageSource={imageProvenanceFixture(first)} width={200} height={100} />);
    fireEvent.error(screen.getByRole("img"));
    rerender(<PermittedStoryImage image={second} imageSource={imageProvenanceFixture(second)} width={200} height={100} />);
    expect(screen.getByRole("img")).toHaveAttribute("src",second);
  });
  it("retries the same URL only when a new review replaces the failed image evidence", () => {
    const path = "https://example.com/reviewed-same-url.avif";
    const original = imageProvenanceFixture(path);
    const corrected = imageProvenanceFixture(path, "corrected original bytes", "corrected replacement bytes", {
      credit: "Corrected synthetic photo credit", reviewReceipt: "d".repeat(64),
    });
    const { rerender } = render(<PermittedStoryImage image={path} imageSource={original} width={200} height={100} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    rerender(<PermittedStoryImage image={path} imageSource={original} width={200} height={100} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    rerender(<PermittedStoryImage image={path} imageSource={corrected} width={200} height={100} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", path);
    expect(screen.getByText("Corrected synthetic photo credit")).toBeVisible();
    expect(screen.queryByText(NEUTRAL_CREDIT)).not.toBeInTheDocument();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", NEUTRAL_IMAGE);
    expect(screen.queryByText("Corrected synthetic photo credit")).not.toBeInTheDocument();
  });
  it("omits free-text permission claims and discloses generic context", () => {
    const {rerender}=render(<ImageAttribution source="unknown" />);
    expect(screen.queryByText("unknown")).not.toBeInTheDocument();
    rerender(<ImageAttribution source={imageProvenanceFixture("/images/reviewed.avif")} />);
    expect(screen.getByText(/Imagen temática/)).toBeVisible();
  });
});
