// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const surface = vi.hoisted(() => ({ open: true }));

vi.mock("@/lib/booking/surface", () => ({
  isBookingSurfaceOpen: vi.fn(async () => surface.open),
}));

const { handleBookingSurface } = await import("./booking-surface");
const { isBookingSurfaceOpen } = await import("@/lib/booking/surface");

const request = (path: string) => new NextRequest(`https://paisaxe.es${path}`);

beforeEach(() => {
  surface.open = true;
  vi.mocked(isBookingSurfaceOpen).mockClear();
});

describe("handleBookingSurface", () => {
  it("lets /acceso through while the surface is open", async () => {
    expect(await handleBookingSurface(request("/acceso"))).toBeNull();
  });

  it("answers /acceso with a real 404 (a rewrite to an unmatched path) while closed", async () => {
    surface.open = false;
    const response = await handleBookingSurface(request("/acceso"));
    expect(response?.headers.get("x-middleware-rewrite")).toBe("https://paisaxe.es/_booking-surface-closed");
  });

  it("redirects /access to /acceso with a 307 while open", async () => {
    const response = await handleBookingSurface(request("/access"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://paisaxe.es/acceso");
  });

  it("answers /access with a 404 while closed", async () => {
    surface.open = false;
    const response = await handleBookingSurface(request("/access"));
    expect(response?.headers.get("x-middleware-rewrite")).toBe("https://paisaxe.es/_booking-surface-closed");
  });

  it.each(["/immersive", "/acceso-not", "/api/booking/access", "/accesos"])(
    "ignores %s without reading the flag",
    async (path) => {
      expect(await handleBookingSurface(request(path))).toBeNull();
      expect(isBookingSurfaceOpen).not.toHaveBeenCalled();
    }
  );
});
