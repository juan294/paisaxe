/** Original geometric illustration; no photograph or named-place claim. */
export const NEUTRAL_IMAGE = "/images/neutral-landscape.svg";
export const NEUTRAL_CREDIT = "Paisaxe · Ilustración temática, no representa un lugar concreto";

export interface ImageProvenance {
  assetUrl: string;
  originalSha256: string;
  replacementSha256: string;
  sourcePage: string;
  photographer: string;
  license: "owner-permission" | "CC0-1.0" | "CC-BY-4.0" | "Unsplash-manual";
  permission: string;
  date: string;
  credit: string;
  context: "named-place" | "thematic";
  alt: string;
  crop: { mobile: string; desktop: string };
  reviewer: string;
  reviewReceipt: string;
  status: "approved";
  flow: "manual";
}

const hash = /^[a-f0-9]{64}$/;
const licenses = new Set(["owner-permission", "CC0-1.0", "CC-BY-4.0", "Unsplash-manual"]);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const https = (v: unknown): v is string => {
  if (!text(v)) return false;
  try { const url = new URL(v); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
};
const assetUrl = (v: unknown): v is string => https(v) || (text(v) && /^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(v) && !v.split("/").includes(".."));
const date = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

/** Admin review is explicit evidence, never inferred from a URL or free-text credit. */
export function parseImageProvenance(raw: unknown): ImageProvenance | null {
  if (typeof raw !== "string") return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const crop = p.crop as Record<string, unknown> | null;
  if (p.status !== "approved" || p.flow !== "manual" || !assetUrl(p.assetUrl) || !https(p.sourcePage)
    || !text(p.license) || !licenses.has(p.license) || !text(p.originalSha256) || !hash.test(p.originalSha256)
    || !text(p.replacementSha256) || !hash.test(p.replacementSha256) || !text(p.reviewReceipt) || !hash.test(p.reviewReceipt)
    || !date(p.date)
    || ![p.photographer, p.permission, p.credit, p.alt, p.reviewer].every(text)
    || (p.context !== "named-place" && p.context !== "thematic") || !crop || !text(crop.mobile) || !text(crop.desktop)) return null;
  return value as ImageProvenance;
}

export function resolvePermittedImage(image: string | null | undefined, source: unknown, blurDataUrl?: string | null): { image: string; imageSource: string; blurDataUrl?: string } {
  const provenance = parseImageProvenance(source);
  if (provenance && provenance.assetUrl === image) return { image, imageSource: source as string, ...(blurDataUrl ? { blurDataUrl } : {}) };
  return { image: NEUTRAL_IMAGE, imageSource: NEUTRAL_CREDIT };
}

export function imageCredit(source: string | undefined): string | undefined {
  return parseImageProvenance(source)?.credit ?? (source === NEUTRAL_CREDIT ? source : undefined);
}
