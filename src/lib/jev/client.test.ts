// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { askJev } from "./client";
import { JEV_MODEL } from "./contracts";
import { getJevConfiguration } from "./config";

const questions = { version: "provider-contract-v1", questions: {
  confirmed: { type: "noul" as const, instructions: "Is confirmation explicit?" },
  selected: { type: "choice" as const, instructions: "Which day?", criteria: { friday: null, saturday: null } },
} };
const state = { text: "La visita está confirmada." };
const context = { mode: "runtime" as const, task: "booking_intake" as const };
function body() { return { model: JEV_MODEL, answers: {
  confirmed: { type: "noul", noul: 0.97 },
  selected: { type: "choice", choice: "friday", confidence: 0.96, probabilities: { friday: 0.96, saturday: 0.04 } },
}, usage: { input_tokens: 100, output_tokens: 0 } }; }
function transport(value: unknown = body(), status = 200) {
  return vi.fn<typeof fetch>(async () => Response.json(value, { status }));
}
function ask(fetch: typeof globalThis.fetch, signal?: AbortSignal, timeoutMs?: number) {
  return askJev(questions, state, context, signal, { fetch, timeoutMs });
}
beforeEach(() => {
  vi.stubEnv("TYPESAFE_API_KEY", " fixture-only-key ");
  vi.stubEnv("JEV_ENABLED_TASKS", "booking_intake");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("ADAPTER-01 configuration and recovery", () => {
  it("uses lazy trimmed reads, default off, and safe variable-specific reasons without HTTP", async () => {
    const fetch = transport();
    vi.stubEnv("JEV_ENABLED_TASKS", "");
    expect(await ask(fetch)).toMatchObject({ status: "unavailable", reason: "disabled" });
    vi.stubEnv("JEV_ENABLED_TASKS", "booking_intake,unknown-secret-input");
    expect(await ask(fetch)).toMatchObject({ status: "unavailable", reason: "invalid_config", message: expect.stringContaining("JEV_ENABLED_TASKS") });
    expect(JSON.stringify(getJevConfiguration())).not.toContain("unknown-secret-input");
    vi.stubEnv("JEV_ENABLED_TASKS", "booking_intake");
    vi.stubEnv("TYPESAFE_API_KEY", "  ");
    expect(await ask(fetch)).toMatchObject({ status: "unavailable", reason: "not_configured", message: expect.stringContaining("TYPESAFE_API_KEY") });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("TYPESAFE_API_KEY", "fixture-only-key");
    expect(await ask(fetch)).toMatchObject({ status: "answered" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("evaluation is explicit and cannot enable runtime tasks", async () => {
    vi.stubEnv("JEV_ENABLED_TASKS", "");
    const fetch = transport();
    expect(await askJev(questions, state, { mode: "evaluation", task: "provider_contract", authorized: true }, undefined, { fetch })).toMatchObject({ status: "answered" });
    expect(await ask(fetch)).toMatchObject({ reason: "disabled" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ADAPTER-02 no retry, bounded calls and cancellation", () => {
  it.each([429, 529])("returns a safe error for %s and recovers on the next request", async status => {
    const fetch = transport({ error: { message: "secret-response-body" } }, status);
    expect(await ask(fetch)).toMatchObject({ status: "unavailable", reason: status === 429 ? "rate_limited" : "provider_error" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await ask(transport())).toMatchObject({ status: "answered" });
  });
  it("does not dispatch when pre-aborted", async () => {
    const fetch = transport();
    expect(await ask(fetch, AbortSignal.abort())).toMatchObject({ status: "unavailable", reason: "aborted" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("enforces the total deadline even with an unresponsive custom fetch", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}));
    expect(await ask(fetch, undefined, 20)).toMatchObject({ status: "unavailable", reason: "deadline" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await ask(transport())).toMatchObject({ status: "answered" });
  });
  it("propagates in-flight cancellation and removes caller listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    let observed: AbortSignal | null | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>((_, init) => { observed = init?.signal; return new Promise(() => {}); });
    const pending = ask(fetch, controller.signal);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();
    expect(await pending).toMatchObject({ status: "unavailable", reason: "aborted" });
    expect(observed?.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

describe("ADAPTER-03 strict provider response validation", () => {
  it.each([
    (r: ReturnType<typeof body>) => { r.model = "jev-latest"; },
    (r: ReturnType<typeof body>) => { r.answers.confirmed.noul = -0.01; },
    (r: ReturnType<typeof body>) => { r.answers.confirmed.noul = 1.01; },
    (r: ReturnType<typeof body>) => { r.answers.confirmed.noul = NaN; },
    (r: ReturnType<typeof body>) => { r.answers.selected.choice = "unknown"; },
    (r: ReturnType<typeof body>) => { r.answers.selected.probabilities.friday = 0.8; },
    (r: ReturnType<typeof body>) => { Object.assign(r.answers, { extra: { type: "noul", noul: 0.9 } }); },
    (r: ReturnType<typeof body>) => { Reflect.deleteProperty(r.answers, "confirmed"); },
    (r: ReturnType<typeof body>) => { Object.assign(r.answers.selected.probabilities, { unknown: 0 }); },
    (r: ReturnType<typeof body>) => { r.usage.input_tokens = -1; },
  ])("rejects malformed data without poisoning later requests (%#)", async mutate => {
    const invalid = body(); mutate(invalid);
    expect(await ask(transport(invalid))).toMatchObject({ status: "unavailable", reason: "invalid_response" });
    expect(await ask(transport())).toMatchObject({ status: "answered" });
  });
});

describe("ADAPTER-04 fixed transport, nullable usage and metadata-only logs", () => {
  it("ignores hostile ambient origin/model/logging settings and sends the pinned model", async () => {
    vi.stubEnv("TYPESAFE_BASE_URL", "https://attacker.invalid");
    vi.stubEnv("TYPESAFE_LOG_LEVEL", "debug");
    vi.stubEnv("TYPESAFE_DEFAULT_MODEL", "unknown");
    const fetch = transport();
    const result = await ask(fetch);
    expect(result).toMatchObject({ status: "answered", model: JEV_MODEL, usage: { inputTokens: 100, outputTokens: 0 } });
    expect(result.estimatedCostUsd).toBeCloseTo(0.0000042, 12);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: JEV_MODEL });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-only-key");
    expect(new Headers(init?.headers).has("TypeSafe-Danger-Zone-Long-Context")).toBe(false);
  });
  it("unknown usage has unknown cost", async () => {
    const response = body(); Reflect.deleteProperty(response, "usage");
    expect(await ask(transport(response))).toMatchObject({ status: "answered", usage: null, estimatedCostUsd: null });
  });
  it("logs no state, key, header or SDK exception bodies", async () => {
    const sink = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = vi.fn<typeof fetch>(async () => new Response("secret-body", { status: 529, headers: { "x-error": "secret-header" } }));
    await askJev(questions, { text: "secret-state" }, context, undefined, { fetch: failure });
    const logs = JSON.stringify([sink.mock.calls, debug.mock.calls, warn.mock.calls, error.mock.calls]);
    for (const secret of ["fixture-only-key", "secret-state", "secret-body", "secret-header"]) expect(logs).not.toContain(secret);
    expect(logs).toContain("JEV_DECISION");
  });
});

describe("ADAPTER-05 input and server boundary", () => {
  it.each([{}, [], "", "   ", { text: "á".repeat(17000) }, { text: undefined }])("rejects empty/oversized/non-JSON state before transport (%#)", async invalid => {
    const fetch = transport();
    const result = await askJev(questions, invalid as never, context, undefined, { fetch });
    expect(result).toMatchObject({ status: "unavailable", reason: "invalid_config" });
    expect(fetch).not.toHaveBeenCalled();
    expect(await ask(fetch)).toMatchObject({ status: "answered" });
  });
  it("rejects ordinary imports without react-server but permits shared contracts", () => {
    const cli = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", 'await import("./src/lib/jev/client.ts")'], { encoding: "utf8" });
    expect(cli.status).not.toBe(0);
    expect(cli.stderr).toContain("server-only");
    const shared = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", 'await import("./src/lib/jev/contracts.ts")'], { encoding: "utf8" });
    expect(shared.status).toBe(0);
  });
});

// Unlike Vitest's server-only alias, Next exercises the actual client/server graph.
it("ADAPTER-05 Next rejects client bundling of the actual server adapter", () => {
  const root = process.cwd();
  const fixture = join(root, "test-results/jev/phase-1/client-boundary");
  mkdirSync(join(fixture, "app"), { recursive: true });
  for (const filename of ["layout.tsx", "page.tsx"]) rmSync(join(fixture, "app", filename), { force: true });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ private: true, type: "module" }));
  writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({ compilerOptions: { allowJs: true, paths: { "@/*": [join(root, "src/*")] } } }));
  writeFileSync(join(fixture, "next.config.mjs"), "export default { typescript: { ignoreBuildErrors: true } };\n");
  writeFileSync(join(fixture, "app/layout.jsx"), 'export default function Layout({children}) { return <html><body>{children}</body></html> }');
  writeFileSync(join(fixture, "app/page.jsx"), '"use client";\nimport {askJev} from '+JSON.stringify(join(root,"src/lib/jev/client.ts"))+';\nexport default function Page() { return <button onClick={() => void askJev()}>Boundary</button> }');
  const result = spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build", fixture, "--webpack"], { encoding: "utf8", timeout: 60_000, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  writeFileSync(join(fixture, "build.log"), result.stdout + result.stderr);
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain("server-only");
}, 65_000);
