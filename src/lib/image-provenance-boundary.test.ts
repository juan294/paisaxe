import { describe, expect, it } from "vitest";
import {
  imageCredit,
  NEUTRAL_CREDIT,
  NEUTRAL_IMAGE,
  parseImageProvenance,
  resolvePermittedImage,
  type ImageProvenance,
} from "./image-provenance";

// Synthetic metadata only. Approval/permission strings stand for a human review;
// these tests establish the parser boundary, not the truth of a rights grant.
function reviewed(overrides: Partial<ImageProvenance> = {}): ImageProvenance {
  return {
    assetUrl: "/images/reviewed/owner-landscape.webp",
    originalSha256: "1".repeat(64),
    replacementSha256: "2".repeat(64),
    sourcePage: "https://photographer.example.test/photos/landscape",
    photographer: "Example owner",
    license: "owner-permission",
    permission: "Owner-approved publication receipt, synthetic fixture",
    date: "2026-10-11",
    credit: "Example owner · Thematic illustration, not a named place",
    context: "thematic",
    alt: "Thematic mountain landscape, not a named place",
    crop: { mobile: "center crop reviewed", desktop: "wide crop reviewed" },
    reviewer: "Example reviewer",
    reviewReceipt: "3".repeat(64),
    status: "approved",
    flow: "manual",
    ...overrides,
  };
}

function serialized(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...reviewed(), ...overrides });
}

const neutral = { image: NEUTRAL_IMAGE, imageSource: NEUTRAL_CREDIT };

describe("image provenance trust boundaries", () => {
  it("rejects absent, malformed and non-record evidence without publishing its credit", () => {
    for (const raw of [undefined, null, false, 42, {}, [], "", "{broken", "null", "[]", '"credit"']) {
      expect(parseImageProvenance(raw)).toBeNull();
      expect(resolvePermittedImage(reviewed().assetUrl, raw)).toEqual(neutral);
    }
  });

  it.each(["photographer", "permission", "credit", "alt", "reviewer"])(
    "requires nonempty textual %s evidence",
    (field) => {
      for (const missing of [undefined, null, "", " \n\t ", 7]) {
        const source = serialized({ [field]: missing });
        expect(parseImageProvenance(source)).toBeNull();
        expect(resolvePermittedImage(reviewed().assetUrl, source)).toEqual(neutral);
        expect(imageCredit(source)).toBeUndefined();
      }
    },
  );

  it.each(["originalSha256", "replacementSha256", "reviewReceipt"])(
    "requires a complete SHA256 identity for %s",
    (field) => {
      for (const invalid of [undefined, "a".repeat(63), "a".repeat(65), "g".repeat(64), "A".repeat(64), 123]) {
        expect(parseImageProvenance(serialized({ [field]: invalid }))).toBeNull();
      }
    },
  );

  it("rejects unapproved reviews, unsupported licenses and API metadata in the manual flow", () => {
    for (const status of [undefined, "pending", "rejected", "revoked"]) {
      expect(resolvePermittedImage(reviewed().assetUrl, serialized({ status }))).toEqual(neutral);
    }
    for (const license of [undefined, "", "all-rights-reserved", "Unsplash-API", "CC-BY-NC-4.0"]) {
      expect(parseImageProvenance(serialized({ license }))).toBeNull();
    }
    for (const flow of [undefined, "api", "Unsplash-API"]) {
      expect(parseImageProvenance(serialized({ license: "Unsplash-manual", flow }))).toBeNull();
    }
  });

  it.each(["owner-permission", "CC0-1.0", "CC-BY-4.0", "Unsplash-manual"] as const)(
    "retains explicit approved %s manual evidence",
    (license) => {
      const source = JSON.stringify(reviewed({ license }));
      expect(parseImageProvenance(source)?.license).toBe(license);
      expect(resolvePermittedImage(reviewed().assetUrl, source).image).toBe(reviewed().assetUrl);
    },
  );

  it("requires an HTTPS source page without embedded credentials", () => {
    for (const sourcePage of [
      undefined, "", "not a URL", "/photos/landscape", "//example.test/photo",
      "http://example.test/photo", "javascript:alert(1)", "data:text/plain,credit",
      "https://username:password@example.test/photo",
    ]) {
      expect(parseImageProvenance(serialized({ sourcePage }))).toBeNull();
    }
  });

  it("requires an actual calendar date rather than a normalized impossible date", () => {
    for (const date of [undefined, "2026-2-03", "2026-13-01", "2026-02-29", "2026-02-30", "2026-04-31", "2026-10-11T00:00:00Z"]) {
      expect(parseImageProvenance(serialized({ date }))).toBeNull();
    }
    expect(parseImageProvenance(serialized({ date: "2024-02-29" }))?.date).toBe("2024-02-29");
  });

  it("requires both mobile and desktop crop reviews and a recognized context", () => {
    for (const crop of [undefined, null, [], "center", {}, { mobile: "center" }, { desktop: "center" }, { mobile: " ", desktop: "center" }, { mobile: "center", desktop: 1 }]) {
      expect(parseImageProvenance(serialized({ crop }))).toBeNull();
    }
    for (const context of [undefined, "", "unknown", "named-place-unverified"]) {
      expect(parseImageProvenance(serialized({ context }))).toBeNull();
    }
  });

  it("does not turn a matching unsafe image URL into a permitted photo", () => {
    for (const assetUrl of [
      "javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///tmp/photo.webp",
      "//example.test/photo.webp", "http://example.test/photo.webp",
      "https://username:password@example.test/photo.webp", "not a URL", "",
    ]) {
      const source = serialized({ assetUrl });
      expect(parseImageProvenance(source)).toBeNull();
      expect(resolvePermittedImage(assetUrl, source)).toEqual(neutral);
    }
  });

  it("binds approval to the exact asset, including query identity, and never restores an absent photo", () => {
    const assetUrl = "https://images.example.test/photo.webp?revision=2";
    const source = JSON.stringify(reviewed({ assetUrl }));
    expect(resolvePermittedImage(assetUrl, source).imageSource).toBe(source);
    for (const other of [undefined, null, "", "/images/reviewed/other.webp", "https://images.example.test/photo.webp?revision=1"]) {
      expect(resolvePermittedImage(other, source)).toEqual(neutral);
    }
  });

  it.each(["named-place", "thematic"] as const)(
    "retains the explicitly reviewed %s credit and alt without inventing another attribution",
    (context) => {
      const credit = context === "named-place"
        ? "Example owner · Owner photo of Example Place"
        : "Example owner · Thematic landscape, not Example Place";
      const alt = context === "named-place" ? "Example Place photographed by its owner" : "Illustrative landscape, not Example Place";
      const source = JSON.stringify(reviewed({ context, credit, alt }));
      const parsed = parseImageProvenance(source);
      expect(parsed?.context).toBe(context);
      expect(parsed?.alt).toBe(alt);
      expect(imageCredit(source)).toBe(credit);
      expect(resolvePermittedImage(reviewed().assetUrl, source).imageSource).toBe(source);
    },
  );

  it("renders only the disclosed neutral credit or a valid reviewed credit", () => {
    expect(imageCredit(NEUTRAL_CREDIT)).toBe(NEUTRAL_CREDIT);
    for (const source of [undefined, "Photo by an unknown author", "Turismo de Asturias", "{broken", serialized({ status: "rejected" })]) {
      expect(imageCredit(source)).toBeUndefined();
    }
  });
});
