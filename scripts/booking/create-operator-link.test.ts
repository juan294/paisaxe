// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isLocalSupabaseReachable, localServiceClient, psql, warnLocalSupabaseUnreachable } from "../../src/test/local-supabase";
import { verifyOperatorCapability } from "../../src/lib/booking/links";
import { createOperatorAccess, parseOperatorLinkArgs } from "./create-operator-link";
import { serviceClientFor } from "./target";

const SECRET = "script-test-secret-that-is-at-least-32-bytes-long";

describe("parseOperatorLinkArgs", () => {
  it("targets the local stack and the judging period unless told otherwise", () => {
    expect(parseOperatorLinkArgs(["--merchant", "demo-rutas-del-sella"])).toEqual({
      merchant: "demo-rutas-del-sella",
      label: "Operador demo-rutas-del-sella",
      expires: "2026-12-16",
      target: "local",
      confirmProduction: false,
    });
  });

  it("reads every option", () => {
    expect(
      parseOperatorLinkArgs([
        "--merchant", "demo-rutas-del-sella",
        "--label", "Jurado",
        "--expires", "2026-11-30",
        "--target", "production",
        "--yes-production",
      ])
    ).toEqual({
      merchant: "demo-rutas-del-sella",
      label: "Jurado",
      expires: "2026-11-30",
      target: "production",
      confirmProduction: true,
    });
  });

  it.each([
    [[]],
    [["--merchant", "x", "--expires", "16/12/2026"]],
    [["--merchant", "x", "--target", "staging"]],
    [["--merchant", "x", "--unknown"]],
  ])("rejects %j", (argv) => {
    expect(() => parseOperatorLinkArgs(argv)).toThrow();
  });
});

describe("serviceClientFor", () => {
  it("refuses production without --yes-production (owner-authorized action)", () => {
    expect(() => serviceClientFor("production", parseOperatorLinkArgs(["--merchant", "x", "--target", "production"]).confirmProduction)).toThrow(
      /--yes-production/
    );
  });

  it("uses the local stack by default", () => {
    expect(serviceClientFor("local", false)).toBeTruthy();
  });
});

describe("createOperatorAccess", () => {
  function fakeClient(merchant: { id: string } | null) {
    const insert = vi.fn(() => ({
      select: () => ({ single: async () => ({ data: { id: "a7e5c0de-0000-4000-8000-0000000000ff", link_version: 1 }, error: null }) }),
    }));
    const from = vi.fn((table: string) =>
      table === "merchants"
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: merchant, error: null }) }) }) }
        : { insert }
    );
    return { client: { from } as never, insert };
  }

  it("refuses an unknown merchant slug and inserts nothing", async () => {
    vi.stubEnv("BOOKING_LINK_SECRET", SECRET);
    const fake = fakeClient(null);

    await expect(createOperatorAccess(fake.client, parseOperatorLinkArgs(["--merchant", "nope"]))).rejects.toThrow(/nope/);
    expect(fake.insert).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("checks the link secret before inserting a row", async () => {
    vi.stubEnv("BOOKING_LINK_SECRET", "");
    const fake = fakeClient({ id: "m1" });

    await expect(createOperatorAccess(fake.client, parseOperatorLinkArgs(["--merchant", "demo"]))).rejects.toThrow(
      /BOOKING_LINK_SECRET/
    );
    expect(fake.insert).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("create-operator-link.test.ts");

const MERCHANT = "b0060000-0000-4000-8000-000000000003";

describe.skipIf(!dbReachable)("createOperatorAccess against live local Supabase", () => {
  beforeAll(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", SECRET);
    psql(`DELETE FROM public.merchants WHERE id = '${MERCHANT}';`);
    psql(
      `INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) ` +
        `VALUES ('${MERCHANT}', 'it-operator-script', 'IT script merchant', 'Europe/Madrid', 24, true);`
    );
  });

  afterAll(() => {
    psql(`DELETE FROM public.merchants WHERE id = '${MERCHANT}';`); // cascades to operator_access
    vi.unstubAllEnvs();
  });

  it("inserts operator_access for the slug and returns a link that verifies until the expiry day ends", async () => {
    const options = parseOperatorLinkArgs(["--merchant", "it-operator-script", "--label", "IT script", "--expires", "2026-12-16"]);

    const { link } = await createOperatorAccess(localServiceClient(), options);

    expect(link).toMatch(/^\/operator\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    const capability = link.slice("/operator/".length);
    const access = await verifyOperatorCapability(localServiceClient(), capability, new Date("2026-12-16T22:58:59Z"));
    expect(access).toMatchObject({ merchantId: MERCHANT, label: "IT script", linkVersion: 1 });
    expect(await verifyOperatorCapability(localServiceClient(), capability, new Date("2026-12-16T23:00:00Z"))).toBeNull();
  });
});
