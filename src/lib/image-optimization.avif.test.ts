// @vitest-environment node
import { expect, it } from "vitest";
import sharp from "sharp";
import { validateImageBuffer } from "./image-optimization";

it("accepts an actual AVIF upload using Sharp's HEIF/AV1 metadata", async () => {
  const bytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: "green" } }).avif().toBuffer();
  expect((await sharp(bytes).metadata()).format).toBe("heif");
  expect(await validateImageBuffer(bytes)).toEqual({ valid: true, format: "avif" });
});
