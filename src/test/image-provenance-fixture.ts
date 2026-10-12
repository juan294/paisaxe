import { createHash } from "node:crypto";
import type { ImageProvenance } from "@/lib/image-provenance";

/** Synthetic review evidence for tests only; grants no permission to any real image. */
export function imageProvenanceFixture(
  assetUrl: string,
  original: string | Uint8Array = "image fixture",
  replacement: string | Uint8Array = original,
  overrides: Partial<ImageProvenance> = {},
): string {
  const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
  const provenance: ImageProvenance = {
    assetUrl,
    originalSha256: sha256(original),
    replacementSha256: sha256(replacement),
    sourcePage: "https://example.com/synthetic-photo-review",
    photographer: "Synthetic fixture author",
    license: "owner-permission",
    permission: "Synthetic test bytes only; no real photo permission",
    date: "2026-10-11",
    credit: "Synthetic fixture credit",
    context: "thematic",
    alt: "Synthetic geometric fixture",
    crop: { mobile: "Synthetic mobile crop reviewed", desktop: "Synthetic desktop crop reviewed" },
    reviewer: "Synthetic test reviewer",
    reviewReceipt: sha256("synthetic test review receipt"),
    status: "approved",
    flow: "manual",
    ...overrides,
  };
  return JSON.stringify(provenance);
}
