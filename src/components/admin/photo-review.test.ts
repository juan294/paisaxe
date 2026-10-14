import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPhotoReview, photoReviewError, preparePhoto } from "./photo-review";
import { imageProvenanceFixture } from "@/test/image-provenance-fixture";

const prepared = { assetUrl: "https://example.com/photo.avif", originalSha256: "a".repeat(64), replacementSha256: "b".repeat(64), preview: "data:image/avif;base64,AA==", width: 800, height: 600 };
const fields = { sourcePage: "https://example.com/source", photographer: "Actual photographer", license: "owner-permission" as const, permission: "Written permission retained in owner records", date: "2026-10-13", credit: "Actual photographer", context: "named-place" as const, alt: "The actual reviewed location", reviewer: "Actual operator", mobile: "Center crop reviewed", desktop: "Center crop reviewed", receipt: "Actual retained permission and visual review evidence", confirmed: true };

describe("manual photo review", () => {
  it("requires permission evidence and explicit confirmation", async () => {
    await expect(buildPhotoReview(prepared, { ...fields, confirmed: false })).rejects.toThrow("confirm");
    await expect(buildPhotoReview(prepared, { ...fields, permission: "" })).rejects.toThrow();
    await expect(buildPhotoReview(prepared, { ...fields, receipt: "" })).rejects.toThrow();
  });
  it("binds complete review to the exact prepared bytes and asset", async () => {
    const proof = JSON.parse(await buildPhotoReview(prepared, fields));
    expect(proof.assetUrl).toBe(prepared.assetUrl);
    expect(proof.replacementSha256).toBe(prepared.replacementSha256);
    expect(proof.permission).toBe(fields.permission);
    expect(proof.reviewReceipt).toMatch(/^[a-f0-9]{64}$/);
    expect(photoReviewError(JSON.stringify(proof), prepared.assetUrl)).toBeNull();
    expect(photoReviewError(JSON.stringify(proof), "https://example.com/other.jpg")).toBeTruthy();
  });
  it("rejects free credit while preserving reviewed source-only updates", () => {
    expect(photoReviewError("Photo by Owner", "https://example.com/photo.jpg")).toBeTruthy();
    expect(photoReviewError(imageProvenanceFixture("https://example.com/photo.jpg"), "https://example.com/photo.jpg")).toBeNull();
  });
});

afterEach(() => vi.unstubAllGlobals());
it.each([{ ok: false, body: {} }, { ok: true, body: {} }])("[case %#] reports missing preparation data without invented success", async response => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: response.ok, json: async () => response.body }));
  await expect(preparePhoto("story-1", "https://example.com/image.jpg")).rejects.toThrow("No se pudo preparar la foto. Reinténtalo o elige otra.");
});
it("retains a structured preparation error for the operator", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Permiso de acceso caducado" }) }));
  await expect(preparePhoto("story-1", "https://example.com/image.jpg")).rejects.toThrow("Permiso de acceso caducado");
});
it("does not accept malformed JSON as a prepared image", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("Invalid JSON response"); } }));
  await expect(preparePhoto("story-1", "https://example.com/image.jpg")).rejects.toThrow(SyntaxError);
});
it("prepares file bytes through multipart transport while retaining the CSRF header", async () => {
  document.cookie = "__csrf=synthetic-csrf-token";
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: prepared }) });
  vi.stubGlobal("fetch", fetch);
  const file = new File(["image bytes"], "photo.jpg", { type: "image/jpeg" });
  expect(await preparePhoto("story/id", file)).toEqual(prepared);
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toBe("/api/admin/stories/story%2Fid/image-review");
  expect(init.headers).toEqual({ "x-csrf-token": "synthetic-csrf-token" });
  expect(init.body.get("file")).toBe(file);
  document.cookie = "__csrf=; max-age=0";
});
