import { describe, expect, it, vi } from "vitest";

vi.mock("./operator-dashboard", () => ({ OperatorDashboard: () => null }));

const { default: Page, metadata, instant } = await import("./page");

describe("/operator/[capability] page", () => {
  it("renders its client view (the capability is verified by the API it calls, which answers a real 404)", () => {
    expect(Page()).toBeTruthy();
  });

  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders per request (the root layout's usePathname() blocks prerendering a dynamic segment)", () => {
    expect(instant).toBe(false);
  });
});
