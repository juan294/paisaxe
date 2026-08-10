// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertLocalDatastore, requireReleaseTarget } from "./probe-guards";

describe("requireReleaseTarget", () => {
  it("returns the target when one is named", () => {
    expect(requireReleaseTarget(" https://paisaxe.es ")).toBe("https://paisaxe.es");
  });

  it.each([undefined, "", "   "])(
    "fails rather than falling back to a default (%p)",
    (value) => {
      expect(() => requireReleaseTarget(value)).toThrow(/RELEASE_TARGET_URL is not set/);
    }
  );
});

describe("assertLocalDatastore", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
  ])("allows the local Docker stack (%s)", (url) => {
    expect(() => assertLocalDatastore(url)).not.toThrow();
  });

  it("refuses a hosted Supabase project — Preview and Production share one", () => {
    expect(() =>
      assertLocalDatastore("https://abcdefgh.supabase.co")
    ).toThrow(/Refusing to run a mutating probe/);
  });

  it("fails when the datastore is unspecified rather than guessing", () => {
    expect(() => assertLocalDatastore(undefined)).toThrow(/is not set/);
  });

  it("fails on a malformed URL", () => {
    expect(() => assertLocalDatastore("not-a-url")).toThrow(/not a valid URL/);
  });
});
