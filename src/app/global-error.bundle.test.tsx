import { describe, expect, it, vi } from "vitest";

describe("GlobalError bundle boundary", () => {
  it("does not import full locale dictionaries for the global shell error UI", async () => {
    vi.resetModules();

    for (const locale of ["es", "en", "fr", "de", "pt", "ast"]) {
      vi.doMock(`@/lib/i18n/${locale}`, () => {
        throw new Error(`global-error imported ${locale} translations`);
      });
    }

    await expect(import("./global-error")).resolves.toHaveProperty("default");
  });
});
