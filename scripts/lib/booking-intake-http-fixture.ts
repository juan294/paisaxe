/** Pure synthetic HTTP response builder. Importing performs no setup or provider work. */
import { JEV_MODEL, type JevJsonValue } from "../../src/lib/jev/contracts";
import type { buildIntakeRequest } from "../../src/lib/booking/intake-questions";
/** Synthetic protocol fixture only; no expected label is read or sent. */
export function bookingIntakeHttpFixture(
  request: ReturnType<typeof buildIntakeRequest>,
  judgments: Record<string, "true" | "false" | "uncertain"> = {},
): { status: number; body: JevJsonValue } {
  const state = request.state as {
    message: string;
    candidates: {
      party: unknown[];
      date: unknown[];
      budget: unknown[];
      constraints: Record<"step_free" | "public_transport" | "pets", unknown[]>;
    };
  };
  const text = state.message;
  const positive: Record<string, boolean> = {
    discovery: /experiencias|qu[eé] hay|opciones|actividades|hacer algo|experiences|options|activities|what(?:'s| is| are)? available|what can we do|looking for/i.test(
      text,
    ),
    party_present: state.candidates.party.length > 0,
    date_present: state.candidates.date.length > 0,
    budget_present: state.candidates.budget.length > 0,
    specific_experience:
      /Paseo por la senda costera|Descenso en canoa|Ruta de miradores en 4x4|Coastal path walk|Canoe descent|4x4 viewpoint tour/i.test(
        text,
      ),
    mixed_intent: /cancel|paga|reserva|cotiza|\b(?:book|booking|reserve|pay|paid|quote)\b/i.test(text),
    style_preference: /tranquil|prefer|rom[aá]nt|\b(?:quiet|calm|adventure)\b/i.test(text),
    time_requirement: /a las|por la tarde|por la ma[ñn]ana|por la noche|\bat\s+\d|\b(?:morning|afternoon|evening|tonight)\b/i.test(
      text,
    ),
    unsupported_requirement: false,
    contradiction: false,
    required_step_free: state.candidates.constraints.step_free.length > 0,
    required_public_transport:
      state.candidates.constraints.public_transport.length > 0,
    required_pets: state.candidates.constraints.pets.length > 0,
  };
  const answers = Object.fromEntries(
    Object.entries(request.questionSet.questions).map(([id, question]) => {
      if (question.type === "noul")
        return [
          id,
          {
            type: "noul",
            noul:
              judgments[id] === "uncertain"
                ? 0.5
                : judgments[id] === "true"
                  ? 0.99
                  : judgments[id] === "false"
                    ? 0.01
                    : positive[id]
                      ? 0.99
                      : 0.01,
          },
        ];
      const ids = Object.keys(question.criteria),
        choice = ids[0] ?? "";
      return [
        id,
        {
          type: "choice",
          choice,
          confidence: 0.99,
          probabilities: Object.fromEntries(
            ids.map((key, index) => [
              key,
              index === 0 ? 0.99 : 0.01 / (ids.length - 1),
            ]),
          ),
        },
      ];
    }),
  );
  return {
    status: 200,
    body: {
      model: JEV_MODEL,
      answers,
      usage: { input_tokens: 100, output_tokens: 0 },
    },
  };
}
