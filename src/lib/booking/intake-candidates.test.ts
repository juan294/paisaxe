// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { interpretBookingIntake } from "./intake";
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

it.each([
  "Seremos aproximadamente tres personas; ¿qué hay mañana?",
  "¿Qué hay mañana para unas cuatro personas?",
  "Somos alrededor de 3 personas; buscamos experiencias mañana.",
  "Quizá somos tres personas; ¿qué experiencias hay mañana?",
  "Puede que seamos dos personas; ¿qué hay mañana?",
  "¿Qué hay mañana para tres personas aproximadamente?",
  "Somos tres personas, más o menos; ¿qué hay mañana?",
  "¿Qué hay para tres personas aproximadamente mañana?",
])(
  "uncertain party count is never converted to an exact candidate: %s",
  (message) => {
    expect(enumerateIntakeCandidates(message, now)).toEqual({
      status: "fallback",
      reason: "uncertain_party",
    });
  },
);
it.each([
  "Seremos tres personas; ¿qué hay mañana?",
  "Somos una persona; ¿qué hay mañana?",
  "¿Qué hay mañana para tres personas, aproximadamente una hora de actividad?",
  "La actividad puede durar aproximadamente dos horas; ¿qué hay mañana para tres personas?",
  "¿Qué hay para tres personas mañana hasta 40 euros? El trayecto dura aproximadamente una hora.",
])(
  "exact party remains a candidate when approximation concerns something else: %s",
  (message) => {
    const result = enumerateIntakeCandidates(message, now);
    expect(result.status).toBe("candidates");
    if (result.status !== "candidates")
      throw new Error("Expected exact party candidates");
    expect(result.party[0]?.value).toBe(
      message.includes("una persona;") ? 1 : 3,
    );
  },
);
it("approximate budget does not become a party-uncertainty error", () => {
  expect(
    enumerateIntakeCandidates(
      "¿Qué hay mañana para tres personas hasta aproximadamente 40 euros?",
      now,
    ),
  ).toEqual({ status: "fallback", reason: "unsupported_budget" });
});

it.each([
  "Seremos aproximadamente tres personas; ¿qué hay mañana?",
  "Somos tres personas aproximadamente y buscamos experiencias mañana.",
  "¿Qué hay mañana para tres personas aproximadamente con perro?",
])(
  "approximate party guard returns before semantic HTTP: %s",
  async (message) => {
    vi.stubEnv("TYPESAFE_API_KEY", "synthetic-only");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new Error("Party uncertainty must not dispatch semantic inference");
    });
    try {
      expect(
        await interpretBookingIntake(message, {
          now,
          fetch,
          context: {
            mode: "evaluation",
            task: "booking_intake",
            authorized: true,
          },
        }),
      ).toEqual({ status: "fallback", reason: "uncertain_party" });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  },
);
it.each([
  "Somos al menos tres personas; ¿qué hay mañana?",
  "Como mínimo somos tres personas; ¿qué hay mañana?",
  "¿Qué hay mañana para hasta cuatro personas?",
  "Somos tres personas o así; ¿qué hay mañana?",
])("a bound or loose amount is not an exact party size: %s", (message) => {
  expect(enumerateIntakeCandidates(message, now)).toEqual({
    status: "fallback",
    reason: "uncertain_party",
  });
});
it.each([
  "Somos tres personas aproximadamente y buscamos experiencias mañana.",
  "¿Qué hay mañana para tres personas aproximadamente con perro?",
  "Somos tres personas aproximadamente sin escaleras; ¿qué hay mañana?",
  "Somos tres personas probablemente y buscamos experiencias mañana.",
  "Somos tres personas como mínimo; ¿qué hay mañana?",
  "Somos tres personas o más; ¿qué hay mañana?",
  "Somos tres personas al menos; ¿qué hay mañana?",
  "Somos tres personas como máximo; ¿qué hay mañana?",
])(
  "attached non-exact party qualifier remains unsafe across ordinary continuations: %s",
  (message) => {
    expect(enumerateIntakeCandidates(message, now)).toEqual({
      status: "fallback",
      reason: "uncertain_party",
    });
  },
);
it.each([
  "¿Qué hay mañana para tres personas, aproximadamente una hora de actividad?",
  "¿Qué hay mañana para tres personas, más o menos 45 minutos de actividad?",
  "¿Qué hay mañana para tres personas aproximadamente 40 euros?",
  "¿Qué hay mañana? Somos tres personas como máximo 40 euros.",
])(
  "an explicit following duration or budget quantity does not qualify the party: %s",
  (message) => {
    const parsed = enumerateIntakeCandidates(message, now);
    if (message.includes("aproximadamente 40 euros"))
      expect(parsed).toEqual({
        status: "fallback",
        reason: "unsupported_budget",
      });
    else expect(parsed.status).toBe("candidates");
  },
);
it.each([
  "Somos tres personas y pico hasta 40 euros; ¿qué hay mañana?",
  "Somos tres personas o más hasta 40 euros; ¿qué hay mañana?",
])(
  "count-only postfix cannot be excused by a following budget: %s",
  (message) => {
    expect(enumerateIntakeCandidates(message, now)).toEqual({
      status: "fallback",
      reason: "uncertain_party",
    });
  },
);
