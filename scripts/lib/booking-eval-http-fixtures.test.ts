import { describe, expect, it } from "vitest";
import { createBookingHttpFixtureTransport } from "./booking-eval-http-fixtures";
import { bookingIntakeHttpFixture } from "./booking-intake-http-fixture";
import { buildIntakeRequest } from "../../src/lib/booking/intake-questions";
import { enumerateIntakeCandidates } from "../../src/lib/booking/intake-candidates";

const CLAUDE = "https://api.anthropic.com/v1/messages";
const NOW = new Date("2026-10-28T10:00:00Z");
const system = [{ type: "text", text: "Idioma de la interfaz del visitante: en" }];
async function readBlock(response: Response) {
  const events = (await response.text()).split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
  const start = events.find((event) => event.type === "content_block_start").content_block;
  const delta = events.find((event) => event.type === "content_block_delta").delta;
  return start.type === "tool_use" ? { name: start.name, input: JSON.parse(delta.partial_json) } : { text: delta.text };
}
const request = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

describe("English synthetic booking provider transport", () => {
  it("uses code-parsed English party and ISO date for availability tools", async () => {
    const fixture = createBookingHttpFixtureTransport(NOW);
    const response = await fixture.providerFetch(CLAUDE, request({ system, messages: [{ role: "user", content: "What experiences are available for two people on 2026-11-02 up to 120 euros?" }] }));
    expect(await readBlock(response)).toEqual({ name: "search_experiences", input: { partySize: 2, date: "2026-11-02", budgetCents: 12000, constraints: {} } });
    expect(fixture.counts).toEqual({ jev: 0, claude: 1, voyage: 0 });
    const followUp = await fixture.providerFetch(CLAUDE, request({ system, messages: [{ role: "user", content: "I would like Coastal path walk for two people on 2026-11-02 at 10:00." }] }));
    expect(await readBlock(followUp)).toEqual({ name: "search_experiences", input: { date: "2026-11-02", partySize: 2 } });
  });

  it("matches an English display title while preserving the canonical experience ID", async () => {
    const fixture = createBookingHttpFixtureTransport(NOW);
    const messages = [
      { role: "user", content: "I would like Coastal path walk for two people on 2026-11-02 at 10:00." },
      { role: "assistant", content: [{ type: "tool_use", id: "search-1", name: "search_experiences", input: { date: "2026-11-02", partySize: 2 } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "search-1", content: JSON.stringify({ options: [{ title: "Paseo por la senda costera", displayTitle: "Coastal path walk", experienceId: "canonical-experience" }] }) }] },
    ];
    expect(await readBlock(await fixture.providerFetch(CLAUDE, request({ system, messages })))).toEqual({ name: "get_quote", input: { experienceId: "canonical-experience", date: "2026-11-02", time: "10:00", partySize: 2 } });
  });

  it("speaks English after a quote and when clarification is needed", async () => {
    const fixture = createBookingHttpFixtureTransport(NOW);
    const quoted = await readBlock(await fixture.providerFetch(CLAUDE, request({ system, messages: [
      { role: "user", content: "I would like that option." },
      { role: "assistant", content: [{ type: "tool_use", id: "quote-1", name: "get_quote", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "quote-1", content: "{}" }] },
    ] })));
    expect(quoted).toEqual({ text: "Here is the catalog offer. No booking has been confirmed yet." });
    expect(await readBlock(await fixture.providerFetch(CLAUDE, request({ system, messages: [{ role: "user", content: "Could you help?" }] })))).toEqual({ text: "Please provide an exact date and party size to search for options." });
  });

  it("returns English option text without changing the Spanish fixture response", async () => {
    const fixture = createBookingHttpFixtureTransport(NOW);
    const messages = [
      { role: "user", content: "What is available?" },
      { role: "assistant", content: [{ type: "tool_use", id: "search-1", name: "search_experiences", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "search-1", content: JSON.stringify({ options: [{ title: "Paseo por la senda costera", displayTitle: "Coastal path walk", experienceId: "canonical-experience" }] }) }] },
    ];
    const english = await readBlock(await fixture.providerFetch(CLAUDE, request({ system, messages })));
    expect(english.text).toBe("Catalog options: Coastal path walk. Tell me the exact name, date, party size and time to request an offer.");
    const spanish = await readBlock(await fixture.providerFetch(CLAUDE, request({ messages })));
    expect(spanish.text).toBe("Opciones del catálogo: Paseo por la senda costera. Dime el nombre exacto, fecha, personas y hora para pedir una oferta.");
  });

  it("recognizes independent English discovery, named-experience and hour fixture signals", () => {
    const parsed = enumerateIntakeCandidates("What experiences are available for two people tomorrow?", NOW);
    if (parsed.status !== "candidates") throw Error("English fixture candidate setup must be valid");
    const request = buildIntakeRequest(parsed);
    const plain = bookingIntakeHttpFixture(request).body as { answers: Record<string, { noul: number }> };
    expect(plain.answers.discovery?.noul).toBe(0.99);
    const state = request.state;
    if (!state || typeof state !== "object" || Array.isArray(state)) throw Error("Expected structured fixture state");
    const qualified = bookingIntakeHttpFixture({ ...request, state: { ...state, message: "What experiences are available? I would like Coastal path walk at 10:00." } }).body as { answers: Record<string, { noul: number }> };
    expect(qualified.answers.specific_experience?.noul).toBe(0.99);
    expect(qualified.answers.time_requirement?.noul).toBe(0.99);
  });

  it("still rejects every unregistered external endpoint", async () => {
    const fixture = createBookingHttpFixtureTransport(NOW);
    await expect(fixture.providerFetch("https://unregistered.invalid/messages", request({}))).rejects.toThrow("refuses an unregistered external provider endpoint");
  });
});
