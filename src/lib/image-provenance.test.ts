import { describe, expect, it } from "vitest";
import { NEUTRAL_IMAGE, NEUTRAL_CREDIT, resolvePermittedImage, parseImageProvenance } from "./image-provenance";

describe("image permission boundary", () => {
  it("uses a disclosed neutral image for missing, guide and free-text attribution", () => {
    for (const source of [undefined, null, "Turismo de Asturias", "Photo by a photographer on Unsplash", "{}", "invalid JSON"]) {
      expect(resolvePermittedImage("/images/stories/guide.webp", source)).toEqual({ image: NEUTRAL_IMAGE, imageSource: NEUTRAL_CREDIT });
      expect(parseImageProvenance(source)).toBeNull();
    }
  });
  it("does not reuse provenance for another photo or accept a rejected review", () => {
    const provenance = { assetUrl: "https://example.org/photo.jpg", originalSha256: "a".repeat(64), replacementSha256: "b".repeat(64), sourcePage: "https://example.org/photo", photographer: "Owner", license: "owner-permission", permission: "Written owner permission receipt", date: "2026-10-11", credit: "Owner", context: "thematic", alt: "Generic landscape, not a named place", crop: { mobile: "center", desktop: "center" }, reviewer: "owner", reviewReceipt: "c".repeat(64), status: "approved", flow: "manual" };
    expect(resolvePermittedImage(provenance.assetUrl, JSON.stringify(provenance)).image).toBe(provenance.assetUrl);
    expect(resolvePermittedImage("https://example.org/other.jpg", JSON.stringify(provenance)).image).toBe(NEUTRAL_IMAGE);
    expect(parseImageProvenance(JSON.stringify({ ...provenance, status: "rejected" }))).toBeNull();
    expect(parseImageProvenance(JSON.stringify({ ...provenance, sourcePage: "javascript:alert(1)" }))).toBeNull();
    expect(parseImageProvenance(JSON.stringify({ ...provenance, flow: "api" }))).toBeNull();
  });
});
