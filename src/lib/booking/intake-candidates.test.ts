// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  enumerateIntakeCandidates,
  deterministicIntake,
} from "./intake-candidates";
const now = new Date("2026-10-28T10:00:00Z");
describe("INTAKE exact-span parser", () => {
  it("INTAKE-01 extracts singleton number/date/inclusive-cap values with original spans", () => {
    const message =
      "¿Qué experiencias hay para dos personas el 2026-10-30 hasta 40 euros?";
    const result = enumerateIntakeCandidates(message, now);
    expect(result.status).toBe("candidates");
    if (result.status !== "candidates") throw new Error("expected candidates");
    expect(result.party[0]?.value).toBe(2);
    expect(result.date[0]?.value).toBe("2026-10-30");
    expect(result.budget[0]?.value).toBe(4000);
    for (const span of [...result.party, ...result.date, ...result.budget])
      expect(message.slice(span.start, span.end)).toBe(span.text);
    expect(deterministicIntake(message, now)).toMatchObject({
      status: "accepted",
      criteria: { partySize: 2, date: "2026-10-30", budgetCents: 4000 },
    });
  });
  it.each([
    "Somos 2,5 personas; ¿qué hay mañana?",
    "Somos 2.5 personas; ¿qué hay mañana?",
    "Somos 2,5; ¿qué hay mañana?",
    "Somos 2.5; ¿qué hay mañana?",
    "¿Qué hay para -2 personas mañana?",
    "¿Qué hay para 2,5 personas mañana?",
    "¿Qué hay para +2 personas mañana?",
    "¿Qué hay para 0 personas mañana?",
    "¿Qué hay para 13 personas mañana?",
    "¿Qué hay para 2 personas el 2026-02-30?",
    "¿Qué hay para 2 personas el 2027-01-27?",
    "¿Qué hay para 2 personas mañana menos de 40 euros?",
    "¿Qué hay para 2 personas el viernes?",
    "¿Qué hay para 2 personas mañana por la tarde?",
    "¿Qué hay para 2 personas mañana en inglés?",
    "¿Qué hay para 2 personas mañana con niños de 8 años?",
    "¿Qué hay para 2 personas el 2026-10-30 o el 2026-10-31?",
    "¿Qué hay para 2 o 3 personas mañana?",
    "Cancelar una reserva para 2 personas mañana",
    "¿Qué hay para 2 personas mañana hasta 40 y hasta 60 euros?",
    "¿Qué hay mañana?",
    "¿Qué hay para dos personas?",
  ])(
    "INTAKE-03/04/05 falls back on unsupported or ambiguous criteria: %s",
    (message) => {
      expect(enumerateIntakeCandidates(message, now).status).toBe("fallback");
    },
  );
  it("INTAKE-05 resolves Madrid day boundaries and inclusive day90", () => {
    expect(
      deterministicIntake(
        "Qué hay para 2 personas mañana",
        new Date("2026-10-28T23:30:00Z"),
      ),
    ).toMatchObject({ criteria: { date: "2026-10-30" } });
    expect(
      deterministicIntake("Qué hay para 2 personas el 2027-01-26", now).status,
    ).toBe("accepted");
    expect(
      deterministicIntake(
        "Qué hay para 2 personas mañana",
        new Date("2026-10-24T23:30:00Z"),
      ),
    ).toMatchObject({ criteria: { date: "2026-10-26" } });
  });
  it("INTAKE-08 enumerates supported exact hard constraints", () => {
    const result = enumerateIntakeCandidates(
      "Qué hay para 2 personas mañana sin escaleras, con transporte público y con perro",
      now,
    );
    expect(result).toMatchObject({
      status: "candidates",
      constraints: {
        step_free: [expect.any(Object)],
        public_transport: [expect.any(Object)],
        pets: [expect.any(Object)],
      },
    });
  });
});

it("INTAKE bounded parser rejects empty, oversized and unsupported budget states", () => {
  for (const text of [
    "",
    "x".repeat(501),
    "Qué hay para 2 personas mañana hasta 100001 euros",
  ])
    expect(enumerateIntakeCandidates(text, now).status).toBe("fallback");
  expect(deterministicIntake("Dos personas mañana", now)).toMatchObject({
    status: "fallback",
    reason: "literal_discovery_absent",
  });
});

it("INTAKE-04 spoken party alternatives cannot collapse to the trailing candidate", () => {
  for (const message of [
    "¿Qué hay para dos o tres personas mañana?",
    "¿Qué hay para dos y tres personas mañana?",
    "¿Qué hay para 2 o tres personas mañana?",
    "¿Qué hay para dos o 3 personas mañana?",
  ])
    expect(enumerateIntakeCandidates(message, now)).toMatchObject({
      status: "fallback",
      reason: "ambiguous_party",
    });
});
