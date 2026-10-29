// @vitest-environment node
import { expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  createCappedClaudeFetch,
  collectBookingSse,
  compareBookingRouteScenarios,
} from "./booking-eval-harness";
it("INTAKE harness/legacy CLI imports load no key,setup or network", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--input-type=module",
      "-e",
      'globalThis.fetch=()=>{throw new Error("unexpected network")};await import("./scripts/lib/booking-eval-harness.ts");await import("./scripts/eval/booking-eval.ts");console.log("imported")',
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: "",
        TYPESAFE_API_KEY: "",
        HOME: "/nonexistent-fixture-home",
      },
    },
  );
  expect(child.status).toBe(0);
  expect(child.stdout).toContain("imported");
});
it("counts/fsyncs every actual Claude HTTP attempt including retries and stops before cap", async () => {
  const ledger = join(
    mkdtempSync(join(tmpdir(), "claude-budget-")),
    "attempts.jsonl",
  );
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    expect(readFileSync(ledger, "utf8")).toContain('"event":"reserved"');
    return Response.json({
      model: "claude-sonnet-5-5",
      usage: {
        input_tokens: 100,
        output_tokens: 10,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    });
  });
  const guard = createCappedClaudeFetch({
    maxRequests: 1,
    maxSpendUsd: 10,
    ledgerPath: ledger,
    fetch,
  });
  const init = {
    method: "POST",
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 16000 }),
  };
  await guard.fetch("https://api.anthropic.com/v1/messages", init);
  await guard.settled();
  await expect(
    guard.fetch("https://api.anthropic.com/v1/messages", init),
  ).rejects.toThrow(/cap/i);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(guard.snapshot().requests).toBe(1);
});
it("retains full Claude reservation after an interrupted provider attempt", async () => {
  const guard = createCappedClaudeFetch({
    maxRequests: 2,
    maxSpendUsd: 10,
    ledgerPath: join(
      mkdtempSync(join(tmpdir(), "claude-unknown-")),
      "attempts.jsonl",
    ),
    fetch: async () => {
      throw new Error("provider lost");
    },
  });
  await expect(
    guard.fetch("https://api.anthropic.com/v1/messages", {
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 16000 }),
    }),
  ).rejects.toThrow();
  expect(guard.snapshot().reservedUsd).toBeGreaterThan(2);
  expect(guard.snapshot().complete).toBe(false);
});
it("collects first-card/quote timing through actual SSE chunks, retaining normal contract", async () => {
  const response = new Response(
    'data: {"type":"card","card":{"kind":"offer","options":[]}}\n\ndata: {"type":"card","card":{"kind":"quote","quoteId":"q"}}\n\ndata: {"type":"done","images":[],"sources":[]}\n\n',
  );
  const turn = await collectBookingSse(response, performance.now());
  expect(turn.firstCardMs).not.toBeNull();
  expect(turn.firstQuoteMs).not.toBeNull();
  expect(turn.complete).toBe(true);
});
it("paired comparison requires identical loopback route/catalog/retrieval identity and explicit arm selection", async () => {
  await expect(
    compareBookingRouteScenarios([], {
      baseline: {
        origin: "https://paisaxe.es",
        catalogHash: "a",
        retrievalHash: "b",
        headers: {},
      },
      deterministic: {
        origin: "http://127.0.0.1:3001",
        catalogHash: "a",
        retrievalHash: "b",
        headers: {},
      },
      jev: {
        origin: "http://127.0.0.1:3002",
        catalogHash: "a",
        retrievalHash: "b",
        headers: {},
      },
    }),
  ).rejects.toThrow(/loopback|scenario/i);
});

function pairedCases() {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `paired-${index}`,
    now: "2026-10-28T10:00:00Z",
    locale: "es" as const,
    opening: "Qué hay para2personas mañana",
    followUps: [],
    expected: {
      outcome: "quote" as const,
      quote: {
        experienceTitle: "Paseo por la senda costera",
        date: "2026-10-30",
        time: "10:00",
        partySize: 2,
        totalCents: 12000,
        depositCents: 3000,
      },
      maxClarifications: 0,
    },
    invariants: [
      "no_invented_price",
      "no_payment_without_accept",
      "provider_facts_preserved",
    ],
  }));
}
function quoteResponse(extraText = "") {
  return new Response(
    `data: ${JSON.stringify({ type: "card", card: { kind: "quote", experienceTitle: "Paseo por la senda costera", slotDate: "2026-10-30", slotTime: "10:00", partySize: 2, totalCents: 12000, depositCents: 3000, balanceCents: 9000 } })}\n\n${extraText ? `data: ${JSON.stringify({ type: "text", content: extraText })}\n\n` : ""}data: {"type":"done","images":[],"sources":[]}\n\n`,
  );
}
it("P3-03 route rows report per-scenario Claude deltas rather than cumulative spend", async () => {
  const arms = {} as Parameters<typeof compareBookingRouteScenarios>[1];
  for (const mode of ["baseline", "deterministic", "jev"] as const) {
    const guard = createCappedClaudeFetch({
      maxRequests: 30,
      maxSpendUsd: 100,
      ledgerPath: join(
        mkdtempSync(join(tmpdir(), "paired-cost-")),
        "attempts.jsonl",
      ),
      fetch: async () =>
        Response.json({
          model: "claude-sonnet-5-5",
          usage: { input_tokens: 100, output_tokens: 10 },
        }),
    });
    arms[mode] = {
      origin: "http://127.0.0.1:3006",
      catalogHash: "same",
      retrievalHash: "same",
      headers: {},
      claudeBudget: guard,
      fetch: async () => {
        await guard.fetch("https://api.anthropic.com/v1/messages", {
          body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 100 }),
        });
        return quoteResponse();
      },
    };
  }
  const comparison = await compareBookingRouteScenarios(pairedCases(), arms);
  expect(
    comparison.rows.every(
      (row) => Math.abs((row.claudeCostUsd ?? 0) - 0.0003) < 1e-9,
    ),
  ).toBe(true);
});
it("P3-04 a matching quote cannot hide an invented price or forbidden action", async () => {
  const arms = {} as Parameters<typeof compareBookingRouteScenarios>[1];
  for (const mode of ["baseline", "deterministic", "jev"] as const)
    arms[mode] = {
      origin: "http://127.0.0.1:3006",
      catalogHash: "same",
      retrievalHash: "same",
      headers: {},
      fetch: async () => quoteResponse("Tu experiencia cuesta 999 euros."),
    };
  const comparison = await compareBookingRouteScenarios(pairedCases(), arms);
  expect(comparison.complete).toBe(false);
});

it("P3-05 legacy conversation forwards explicit English locale to the actual model request", async () => {
  const [
    { createBookingEvalHarness },
    { streamBookingTurn },
    { getOrCreateOpenDraft },
    { listBookingsForUser },
    { createClient },
    { default: Anthropic },
    { createBookingHttpFixtureTransport },
  ] = await Promise.all([
    import("./booking-eval-harness"),
    import("../../src/lib/booking/agent"),
    import("../../src/lib/booking/drafts"),
    import("../../src/lib/booking/bookings"),
    import("@supabase/supabase-js"),
    import("@anthropic-ai/sdk"),
    import("./booking-eval-http-fixtures"),
  ]);
  let requestLanguage = "";
  const fixture = createBookingHttpFixtureTransport();
  const anthropic = new Anthropic({
    apiKey: "fixture-only",
    fetch: async (url, init) => {
      requestLanguage = String(init?.body);
      return fixture.providerFetch(url, init);
    },
  });
  const admin = createClient("http://127.0.0.1:59999", "fixture-only", {
    auth: { persistSession: false },
    global: {
      fetch: async (url) =>
        String(url).includes("booking_drafts")
          ? Response.json({
              id: "draft",
              user_id: "fixture",
              status: "open",
              party_size: null,
              slot_date: null,
              slot_time: null,
              budget_cents: null,
              constraints: {},
            })
          : Response.json([]),
    },
  });
  const harness = createBookingEvalHarness({
    admin,
    anthropic,
    psql: () => "",
    streamBookingTurn,
    getOrCreateOpenDraft,
    listBookingsForUser,
    mode: "baseline",
  });
  const conversation = new harness.Conversation("en");
  await conversation.say("Hello");
  expect(requestLanguage).toContain("Idioma de la interfaz del visitante: en");
});

it("P3-08 a successful scenario with unknown Claude usage cannot persist a passing report", async () => {
  const { finalizeLegacyBookingReport } = await import(
    "./booking-eval-harness"
  );
  const guard = createCappedClaudeFetch({
    maxRequests: 1,
    maxSpendUsd: 10,
    ledgerPath: join(
      mkdtempSync(join(tmpdir(), "legacy-partial-")),
      "attempts.jsonl",
    ),
    fetch: async () => Response.json({ model: "claude-sonnet-5-5" }),
  });
  await guard.fetch("https://api.anthropic.com/v1/messages", {
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 100 }),
  });
  const report = await finalizeLegacyBookingReport(
    [{ pass: true, outcome: "quote" }],
    guard,
  );
  expect(report.pass).toBe(false);
  expect(report.complete).toBe(false);
  expect(report.accounting.reservedUsd).toBeGreaterThan(0);
  expect(report.passed).toBe(1);
});
