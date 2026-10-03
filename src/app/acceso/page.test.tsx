import { describe, expect, it, vi } from "vitest";

vi.mock("./voucher-form", () => ({ VoucherForm: () => null }));

const { default: AccesoPage, metadata } = await import("./page");

describe("/acceso page", () => {
  it("renders the voucher form (existence is gated in proxy.ts)", () => {
    expect(AccesoPage()).toBeTruthy();
  });

  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
