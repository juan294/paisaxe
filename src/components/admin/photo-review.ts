import { parseImageProvenance, type ImageProvenance } from "@/lib/image-provenance";
import { csrfHeaders } from "@/lib/csrf-client";

export interface PreparedPhoto {
  assetUrl: string;
  originalSha256: string;
  replacementSha256: string;
  preview: string;
  width: number;
  height: number;
}
export interface PhotoReviewFields {
  sourcePage: string;
  photographer: string;
  license: ImageProvenance["license"] | "";
  permission: string;
  date: string;
  credit: string;
  context: ImageProvenance["context"] | "";
  alt: string;
  reviewer: string;
  mobile: string;
  desktop: string;
  receipt: string;
  confirmed: boolean;
}

export function photoReviewError(source: string, assetUrl?: string): string | null {
  const proof = parseImageProvenance(source);
  return !proof || (assetUrl !== undefined && proof.assetUrl !== assetUrl)
    ? "Completa y confirma la revisión de permisos y encuadres antes de guardar."
    : null;
}

export async function buildPhotoReview(prepared: PreparedPhoto, fields: PhotoReviewFields): Promise<string> {
  if (!fields.confirmed) throw new Error("Debes confirmar los permisos y la revisión de ambos encuadres.");
  if (!fields.receipt.trim()) throw new Error("Indica las pruebas de permiso y revisión visual.");
  const proof = {
    assetUrl: prepared.assetUrl, originalSha256: prepared.originalSha256, replacementSha256: prepared.replacementSha256,
    sourcePage: fields.sourcePage.trim(), photographer: fields.photographer.trim(), license: fields.license,
    permission: fields.permission.trim(), date: fields.date, credit: fields.credit.trim(), context: fields.context,
    alt: fields.alt.trim(), crop: { mobile: fields.mobile.trim(), desktop: fields.desktop.trim() }, reviewer: fields.reviewer.trim(),
    reviewEvidence: fields.receipt.trim(), status: "approved", flow: "manual",
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(proof)));
  const reviewReceipt = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const source = JSON.stringify({ ...proof, reviewReceipt });
  if (photoReviewError(source)) throw new Error("Completa todos los campos con la fuente, los permisos y la revisión de encuadres.");
  return source;
}

/** Preparation reads/optimizes image bytes; it never saves a story or uploads storage. */
export async function preparePhoto(storyId: string, asset: File | string): Promise<PreparedPhoto> {
  const body = typeof asset === "string" ? JSON.stringify({ imageUrl: asset }) : new FormData();
  if (body instanceof FormData) body.set("file", asset as File);
  const response = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}/image-review`, {
    method: "POST", headers: { ...csrfHeaders(), ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) }, body,
  });
  const result = await response.json();
  if (!response.ok || !result.data) throw new Error(result.error || "No se pudo preparar la foto. Reinténtalo o elige otra.");
  return result.data;
}
