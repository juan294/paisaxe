import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock } from "../../src/test/paypal-mock-server";
import {
  ENV_KEYS,
  assertLocalTargets,
  assertOutsideRepo,
  buildEnvironment,
  isLoopbackUrl,
  localLinkSecret,
  parseRunnerArgs,
  removeRunnerOperatorAccess,
  slotDateAfter,
  startControlServer,
  type ControlDeps,
} from "./postman-local";

const POSTMAN_DIR = resolve(__dirname, "../../docs/hackathon/postman");

describe("removeRunnerOperatorAccess", () => {
  it("deletes only the runner's operator links, by label prefix", async () => {
    const like = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ delete: () => ({ like }) }));

    await removeRunnerOperatorAccess({ from } as unknown as SupabaseClient);

    expect(from).toHaveBeenCalledWith("operator_access");
    expect(like).toHaveBeenCalledWith("label", "postman-local-%");
  });

  it("reports a failed delete", async () => {
    const from = () => ({ delete: () => ({ like: async () => ({ error: { message: "denied" } }) }) });
    await expect(removeRunnerOperatorAccess({ from } as unknown as SupabaseClient)).rejects.toThrow(/denied/);
  });
});

describe("localLinkSecret", () => {
  it("creates one owner-only secret beside the environment and returns it on every later call", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "postman-secret-"));
    try {
      const first = localLinkSecret(resolve(dir, "nested"));
      expect(first).toMatch(/^[0-9a-f]{64}$/);
      expect(localLinkSecret(resolve(dir, "nested"))).toBe(first);
      expect(statSync(resolve(dir, "nested", "booking-link-secret")).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("loopback guard", () => {
  it("accepts only this machine", () => {
    expect(isLoopbackUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLoopbackUrl("http://localhost:3006")).toBe(true);
    expect(isLoopbackUrl("http://[::1]:4010")).toBe(true);
    expect(isLoopbackUrl("https://abcd.supabase.co")).toBe(false);
    expect(isLoopbackUrl("https://api-m.sandbox.paypal.com")).toBe(false);
    expect(isLoopbackUrl("https://paisaxe.es")).toBe(false);
    expect(isLoopbackUrl("http://localhost.evil.example")).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });

  it("refuses a run when any target is remote, ignoring unset ones", () => {
    expect(() => assertLocalTargets({ supabase: "http://127.0.0.1:54321", unset: undefined, empty: "" })).not.toThrow();
    expect(() => assertLocalTargets({ supabase: "https://abcd.supabase.co" })).toThrow(/supabase is not a loopback URL/);
  });
});

describe("assertOutsideRepo", () => {
  const repo = resolve("/work/paisaxe");

  it("refuses the repository and anything under it", () => {
    expect(() => assertOutsideRepo("/work/paisaxe", repo)).toThrow(/inside the repository/);
    expect(() => assertOutsideRepo("/work/paisaxe/docs/hackathon/postman/env.json", repo)).toThrow(/inside the repository/);
  });

  it("accepts the temp directory and siblings", () => {
    expect(() => assertOutsideRepo(resolve(tmpdir(), "paisaxe-postman/env.json"), repo)).not.toThrow();
    expect(() => assertOutsideRepo("/work/paisaxe-other/env.json", repo)).not.toThrow();
  });
});

describe("parseRunnerArgs", () => {
  it("defaults to next dev on 3006, the mock on 4010 and the temp directory", () => {
    const options = parseRunnerArgs([]);
    expect(options).toMatchObject({ baseUrl: "http://localhost:3006", paypalPort: 4010, controlPort: 4011 });
    expect(options.out.startsWith(resolve(tmpdir()))).toBe(true);
  });

  it("rejects a bad port", () => {
    expect(() => parseRunnerArgs(["--paypal-port", "0"])).toThrow(/--paypal-port/);
  });
});

describe("environment files", () => {
  it("the template lists every collection variable with an empty value", () => {
    const template = JSON.parse(readFileSync(resolve(POSTMAN_DIR, "paisaxe-booking.postman_environment.template.json"), "utf8")) as {
      values: Array<{ key: string; value: string }>;
    };
    expect(template.values.map((entry) => entry.key)).toEqual([...ENV_KEYS]);
    expect(template.values.every((entry) => entry.value === "")).toBe(true);
  });

  it("every {{variable}} the collection uses is in the environment", () => {
    const collection = readFileSync(resolve(POSTMAN_DIR, "paisaxe-booking.postman_collection.json"), "utf8");
    const used = new Set([...collection.matchAll(/\{\{([A-Za-z]+)\}\}/g)].map((match) => match[1]));
    expect([...used].filter((key) => !(ENV_KEYS as readonly string[]).includes(key))).toEqual([]);
  });

  it("the filled environment keeps the template's shape", () => {
    const env = buildEnvironment("local", { baseUrl: "http://localhost:3006" });
    expect(env.values.map((entry) => entry.key)).toEqual([...ENV_KEYS]);
    expect(env.values.find((entry) => entry.key === "baseUrl")?.value).toBe("http://localhost:3006");
    expect(env.values.find((entry) => entry.key === "voucherCode")?.value).toBe("");
  });
});

describe("slotDateAfter", () => {
  it("counts calendar days from today in Madrid (01:30 on Oct 4 there)", () => {
    expect(slotDateAfter(new Date("2026-10-03T23:30:00Z"), 21)).toBe("2026-10-25");
  });
});

describe("PayPal mock options the runner uses", () => {
  async function createOrder(baseUrl: string): Promise<string> {
    const token = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from("id:secret").toString("base64")}` },
      body: "grant_type=client_credentials",
    }).then((response) => response.json() as Promise<{ access_token: string }>);
    const order = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "EUR", value: "30.00" } }] }),
    }).then((response) => response.json() as Promise<{ id: string }>);
    return order.id;
  }

  it("listens on a fixed port and salts its ids so a restart never repeats one", async () => {
    const probe = createNetServer();
    await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((done) => probe.close(() => done()));

    const mock = await startPaypalMock({ port, idSalt: "AB12" });
    try {
      expect(mock.baseUrl).toBe(`http://127.0.0.1:${port}`);
      expect(await createOrder(mock.baseUrl)).toMatch(/^ORDERAB12\d{13}$/);
    } finally {
      await mock.close();
    }
  });

  it("rejects a salt that is not letters and digits", async () => {
    await expect(startPaypalMock({ idSalt: "a/b" })).rejects.toThrow(/idSalt/);
  });
});

describe("control server", () => {
  let close: (() => void) | null = null;
  afterEach(() => {
    close?.();
    close = null;
  });

  async function start(deps: ControlDeps): Promise<string> {
    const server = await startControlServer(deps, 0);
    close = () => server.close();
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("seeds quotes only for a known session", async () => {
    const seed = vi.fn().mockResolvedValue({ quoteId: "q-fresh", staleQuoteId: "q-stale" });
    const base = await start({ userFor: async (token) => (token === "good" ? "user-1" : null), seed, approve: vi.fn() });

    const ok = await fetch(`${base}/quotes`, { method: "POST", body: JSON.stringify({ accessToken: "good" }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ quoteId: "q-fresh", staleQuoteId: "q-stale" });
    expect(seed).toHaveBeenCalledWith("user-1");

    const refused = await fetch(`${base}/quotes`, { method: "POST", body: JSON.stringify({ accessToken: "bad" }) });
    expect(refused.status).toBe(401);
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it("approves an order at the mock, 409 when the mock refuses", async () => {
    const approve = vi.fn((orderId: string) => {
      if (orderId !== "ORDER1") throw new Error(`paypal mock: no order ${orderId}`);
    });
    const base = await start({ userFor: async () => null, seed: vi.fn(), approve });

    const ok = await fetch(`${base}/paypal/orders/ORDER1/approve`, { method: "POST" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ orderId: "ORDER1", status: "APPROVED" });

    const unknown = await fetch(`${base}/paypal/orders/ORDER2/approve`, { method: "POST" });
    expect(unknown.status).toBe(409);
    expect((await fetch(`${base}/anything`, { method: "POST" })).status).toBe(404);
  });
});
