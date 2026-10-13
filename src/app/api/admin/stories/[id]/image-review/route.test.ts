import { createHash } from "node:crypto";
import sharp from "sharp";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { optimizeSingleImage } from "@/lib/image-optimization";
const sdk = vi.hoisted(() => ({ user: { id: "admin" } as { id: string } | null, role: "admin", exists: true, remoteBytes: Buffer.alloc(0), readError: null as { message: string } | null, readFailure: undefined as unknown, upload: vi.fn(), update: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: sdk.user }, error: null }) },
  from: (table: string) => {
    const query = { select: () => query, eq: () => query,
      single: async () => ({ data: { role: sdk.role }, error: null }),
      maybeSingle: async () => { if (sdk.readFailure !== undefined) throw sdk.readFailure; return { data: table === "stories" && sdk.exists ? { id: "story-1" } : null, error: sdk.readError }; }, update: sdk.update };
    return query;
  },
  storage: { from: () => ({ getPublicUrl: (name: string) => ({ data: { publicUrl: `https://storage.example.com/${name}` } }), upload: sdk.upload }) },
}) }));
vi.mock("node:dns/promises", () => { const lookup = async () => [{ address: "93.184.216.34", family: 4 }]; return { lookup, default: { lookup } }; });
vi.mock("node:https", async importOriginal => {
  const actual = await importOriginal<typeof import("node:https")>();
  const { EventEmitter } = await import("node:events");
  const { Readable } = await import("node:stream");
  const request = (_url: URL, options: import("node:https").RequestOptions, respond: (response: import("node:http").IncomingMessage) => void) => {
    const req = Object.assign(new EventEmitter(), {
      end() { options.lookup!("example.com", {}, error => {
        if (error) req.destroy(error);
        else {
          const response = Object.assign(Readable.from([sdk.remoteBytes]), { statusCode: 200, headers: { "content-type": "image/jpeg" } });
          respond(response as import("node:http").IncomingMessage); response.on("end", () => req.emit("close"));
        }
      }); },
      destroy(error: Error) { req.emit("error", error); req.emit("close"); return req; },
    });
    return req;
  };
  return { ...actual, request, default: { ...actual, request } };
});
const params = { params: Promise.resolve({ id: "story-1" }) };
beforeEach(() => { vi.clearAllMocks(); sdk.user = { id: "admin" }; sdk.role = "admin"; sdk.exists = true; sdk.readError = null; sdk.readFailure = undefined; });
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function uploadRequest(bytes: Buffer, type = "image/jpeg", size = bytes.length) {
  const request = new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", headers: { "content-type": "multipart/form-data" } });
  vi.spyOn(request, "formData").mockResolvedValue({ get: () => ({ type, size, arrayBuffer: async () => bytes }) } as unknown as FormData);
  return request;
}
it("prepares the exact optimized bytes and asset URL without any writes", async () => {
  const original = await sharp({ create: { width: 24, height: 16, channels: 3, background: "green" } }).jpeg().toBuffer();
  const response = await POST(await uploadRequest(original), params);
  expect(response.status).toBe(200);
  const { data } = await response.json();
  const optimized = (await optimizeSingleImage(original, 2048)).buffer;
  expect(data.originalSha256).toBe(digest(original));
  expect(data.replacementSha256).toBe(digest(optimized));
  expect(data.assetUrl).toBe(`https://storage.example.com/story-1-${digest(optimized)}.avif`);
  expect(Buffer.from(data.preview.split(",")[1], "base64")).toEqual(optimized);
  expect(data.width).toBe(24);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
it.each(["unauthenticated", "nonadmin"])("rejects %s before reading any image body", async mode => {
  if (mode === "unauthenticated") sdk.user = null; else sdk.role = "user";
  const request = await uploadRequest(Buffer.from("invalid"));
  const response = await POST(request, params);
  expect(response.status).toBe(mode === "unauthenticated" ? 401 : 403);
  expect(request.formData).not.toHaveBeenCalled();
});
it("rejects missing stories before processing bytes", async () => {
  sdk.exists = false;
  const request = await uploadRequest(Buffer.from("invalid"));
  expect((await POST(request, params)).status).toBe(404);
  expect(request.formData).not.toHaveBeenCalled();
});
it.each(["https://127.0.0.1/private.jpg", "http://example.com/a.jpg", "https://user:secret@example.com/a.jpg"])("retains remote image security guards for %s", async imageUrl => {
  const request = new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", body: JSON.stringify({ imageUrl }), headers: { "content-type": "application/json" } });
  expect((await POST(request, params)).status).toBe(400);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
it("rejects invalid image bytes without writes", async () => {
  expect((await POST(await uploadRequest(Buffer.from("not an image")), params)).status).toBe(400);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});

it.each([{}, { imageUrl: "not a URL" }])("rejects malformed URL preparation %s", async body => {
  const request = new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  expect((await POST(request, params)).status).toBe(400);
});
it("rejects malformed JSON", async () => {
  const request = new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", body: "{", headers: { "content-type": "application/json" } });
  expect((await POST(request, params)).status).toBe(400);
});
it.each([["text/plain", 100], ["image/jpeg", 11 * 1024 * 1024]])("rejects unsupported or oversized files", async (type, size) => {
  expect((await POST(await uploadRequest(Buffer.from("bytes"), type as string, size as number), params)).status).toBe(400);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
it("rejects a missing file", async () => {
  const request = await uploadRequest(Buffer.from("bytes"));
  vi.mocked(request.formData).mockResolvedValue({ get: () => null } as unknown as FormData);
  expect((await POST(request, params)).status).toBe(400);
});
it("rejects a missing story ID before body processing", async () => {
  const request = await uploadRequest(Buffer.from("bytes"));
  expect((await POST(request, { params: Promise.resolve({ id: "" }) })).status).toBe(400);
  expect(request.formData).not.toHaveBeenCalled();
});

it("prepares unchanged remote bytes and retains their original asset URL", async () => {
  sdk.remoteBytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: "blue" } }).jpeg().toBuffer();
  const request = new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", body: JSON.stringify({ imageUrl: "https://example.com/a.jpg" }), headers: { "content-type": "application/json" } });
  const response = await POST(request, params);
  expect(response.status).toBe(200);
  const { data } = await response.json();
  expect(data.assetUrl).toBe("https://example.com/a.jpg");
  expect(data.originalSha256).toBe(digest(sdk.remoteBytes)); expect(data.replacementSha256).toBe(digest(sdk.remoteBytes));
  expect(Buffer.from(data.preview.split(",")[1], "base64")).toEqual(sdk.remoteBytes);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});

it("stops on a database read error and recovers on the next preparation", async () => {
  sdk.readError = { message: "Temporary catalog read failure" };
  const request = await uploadRequest(Buffer.from("invalid"));
  expect((await POST(request, params)).status).toBe(500);
  expect(request.formData).not.toHaveBeenCalled();
  sdk.readError = null;
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "green" } }).jpeg().toBuffer();
  expect((await POST(await uploadRequest(bytes), params)).status).toBe(200);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
it.each([new Error("Synthetic transport exception"), "Synthetic non-Error transport rejection"])("contains unexpected SDK failure without writes: %s", async failure => {
  sdk.readFailure = failure;
  const response = await POST(await uploadRequest(Buffer.from("bytes")), params);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "No se pudo preparar la foto" });
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
it("rejects corrupt remote bytes and recovers when the remote image is corrected", async () => {
  const request = () => new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", body: JSON.stringify({ imageUrl: "https://example.com/recovered.jpg" }), headers: { "content-type": "application/json" } });
  sdk.remoteBytes = Buffer.from("not actually an image");
  expect((await POST(request(), params)).status).toBe(400);
  sdk.remoteBytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).jpeg().toBuffer();
  expect((await POST(request(), params)).status).toBe(200);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
it("rejects a text part masquerading as an uploaded file", async () => {
  const request = await uploadRequest(Buffer.from("bytes"));
  vi.mocked(request.formData).mockResolvedValue({ get: () => "not a file" } as unknown as FormData);
  expect((await POST(request, params)).status).toBe(400);
});

it.each([null, "https://example.com/image.jpg"])("rejects non-object JSON preparation payload %s", async body => {
  const request = new NextRequest("http://localhost/api/admin/stories/story-1/image-review", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  expect((await POST(request, params)).status).toBe(400);
  expect(sdk.upload).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
});
