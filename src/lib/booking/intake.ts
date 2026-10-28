import "server-only";
import { getEnv } from "../env";
import { askJev, type JevOptions } from "../jev/client";
import { isJevTaskEnabled } from "../jev/config";
import {
  JEV_CHOICE_MARGIN,
  JEV_NEGATIVE_THRESHOLD,
  JEV_POSITIVE_THRESHOLD,
  type JevContext,
  type JevResult,
} from "../jev/contracts";
import type { BookingTurnInput } from "./agent";
import {
  enumerateIntakeCandidates,
  type IntakeCriteria,
  type IntakeSpan,
} from "./intake-candidates";
import { buildIntakeRequest } from "./intake-questions";
import { executeBookingTool } from "./tools";
import type { ChatStreamEvent } from "@/types/sse";
export type IntakeInterpretation =
  | {
      status: "accepted";
      criteria: IntakeCriteria;
      decisionMetadata: Exclude<JevResult, { status: "unavailable" }>;
    }
  | { status: "fallback"; reason: string }
  | { status: "aborted" };
export interface IntakeInterpretOptions extends JevOptions {
  now?: Date;
  signal?: AbortSignal;
  context?: JevContext;
}
/** Semantic gates select exact code-produced values; never generated arguments. */
export async function interpretBookingIntake(
  message: string,
  options: IntakeInterpretOptions = {},
): Promise<IntakeInterpretation> {
  if (options.signal?.aborted) return { status: "aborted" };
  const parsed = enumerateIntakeCandidates(message, options.now);
  if (parsed.status === "fallback") return parsed;
  const request = buildIntakeRequest(parsed);
  const response = await askJev(
    request.questionSet,
    request.state,
    options.context ?? { mode: "runtime", task: "booking_intake" },
    options.signal,
    options,
  );
  if (
    options.signal?.aborted ||
    (response.status === "unavailable" && response.reason === "aborted")
  )
    return { status: "aborted" };
  if (response.status === "unavailable")
    return { status: "fallback", reason: response.reason };
  const p = (key: string) => {
    const answer = response.answers[key];
    return answer?.type === "noul" ? answer.noul : NaN;
  };
  if (
    ["discovery", "party_present", "date_present"].some(
      (key) => !(p(key) >= JEV_POSITIVE_THRESHOLD),
    )
  )
    return { status: "fallback", reason: "required_semantics_uncertain" };
  if (
    [
      "unsupported_requirement",
      "contradiction",
      "specific_experience",
      "mixed_intent",
      "style_preference",
      "time_requirement",
    ].some((key) => !(p(key) <= JEV_NEGATIVE_THRESHOLD))
  )
    return { status: "fallback", reason: "excluded_semantics" };
  function select<T extends number | string>(
    field: string,
    candidates: IntakeSpan<T>[],
  ): IntakeSpan<T> | undefined {
    if (candidates.length === 1) return candidates[0];
    const answer =
      response.status === "answered"
        ? response.answers[`select_${field}`]
        : null;
    if (answer?.type !== "choice") return undefined;
    const sorted = Object.values(answer.probabilities).sort((a, b) => b - a);
    if (
      (answer.probabilities[answer.choice] ?? 0) < JEV_POSITIVE_THRESHOLD ||
      (sorted[0] ?? 0) - (sorted[1] ?? 0) < JEV_CHOICE_MARGIN
    )
      return undefined;
    return candidates.find(
      (c) =>
        c.id === answer.choice &&
        c.value !== undefined &&
        message.slice(c.start, c.end) === c.text,
    );
  }
  const party = select("party", parsed.party),
    date = select("date", parsed.date);
  if (!party || !date)
    return { status: "fallback", reason: "unresolved_selection" };
  let budget: IntakeSpan<number> | undefined;
  if (parsed.budget.length) {
    if (!(p("budget_present") >= JEV_POSITIVE_THRESHOLD))
      return { status: "fallback", reason: "budget_uncertain" };
    budget = select("budget", parsed.budget);
    if (!budget) return { status: "fallback", reason: "unresolved_budget" };
  } else if (!(p("budget_present") <= JEV_NEGATIVE_THRESHOLD))
    return { status: "fallback", reason: "budget_absence_uncertain" };
  const constraints: IntakeCriteria["constraints"] = {};
  for (const key of ["step_free", "public_transport", "pets"] as const) {
    const value = p(`required_${key}`);
    if (value >= JEV_POSITIVE_THRESHOLD) {
      if (!parsed.constraints[key].length)
        return { status: "fallback", reason: `missing_${key}_span` };
      constraints[key] = true;
    } else if (!(value <= JEV_NEGATIVE_THRESHOLD))
      return { status: "fallback", reason: `uncertain_${key}` };
  }
  return {
    status: "accepted",
    criteria: {
      partySize: party.value,
      date: date.value,
      ...(budget ? { budgetCents: budget.value } : {}),
      constraints,
    },
    decisionMetadata: response,
  };
}
export function eligibleIntakeTurn(
  input: Pick<
    BookingTurnInput,
    "locale" | "history" | "draft" | "bookings" | "acceptedBooking"
  >,
  replay = Boolean(getEnv("BOOKING_AGENT_REPLAY")),
): boolean {
  return (
    input.locale === "es" &&
    !replay &&
    !input.acceptedBooking &&
    !input.history.length &&
    !input.bookings.length &&
    input.draft.status === "open" &&
    [
      input.draft.partySize,
      input.draft.slotDate,
      input.draft.slotTime,
      input.draft.budgetCents,
    ].every((value) => value == null) &&
    Object.keys(input.draft.constraints).length === 0
  );
}
export type IntakeAttempt =
  | { status: "handled"; events: ChatStreamEvent[] }
  | { status: "fallback"; reason: string }
  | { status: "aborted" };
/** Search finishes before any event escapes. Legacy in-flight DB HTTP is not cancellable. */
export async function tryBookingIntake(
  input: BookingTurnInput,
  options: JevOptions = {},
): Promise<IntakeAttempt> {
  if (input.signal.aborted) return { status: "aborted" };
  if (!isJevTaskEnabled("booking_intake") || !eligibleIntakeTurn(input))
    return { status: "fallback", reason: "ineligible_turn" };
  const interpreted = await interpretBookingIntake(input.message, {
    ...options,
    now: input.now,
    signal: input.signal,
  });
  if (interpreted.status !== "accepted") return interpreted;
  return executeIntakeSearch(input, interpreted.criteria);
}
/** Shared buffered read-only operation for the runtime and explicit local comparator. */
export async function executeIntakeSearch(
  input: BookingTurnInput,
  criteria: IntakeCriteria,
): Promise<IntakeAttempt> {
  if (input.signal.aborted) return { status: "aborted" };
  const outcome = await executeBookingTool(
    { ...input.tools, signal: input.signal },
    "search_experiences",
    criteria,
  );
  if (input.signal.aborted) return { status: "aborted" };
  if (outcome.isError || outcome.card?.kind !== "offer")
    return { status: "fallback", reason: "search_unavailable" };
  const offerable = outcome.card.options.filter(
    (option) => option.suitability !== "rejected",
  );
  const text =
    outcome.card.options.length === 0
      ? "No hay opciones en el catálogo con estos criterios. Puedes cambiar la fecha, las personas o el presupuesto."
      : offerable.length === 0
        ? "Las opciones del catálogo están descartadas con estos criterios; consulta sus motivos. Puedes cambiar la fecha, las personas o el presupuesto."
        : `Opciones del catálogo: ${offerable.map((option) => option.title).join("; ")}. Las necesidades sin confirmar siguen sin confirmar. Dime el nombre exacto de una experiencia y la hora que prefieres para seguir. Todavía no se ha hecho ninguna reserva.`;
  return {
    status: "handled",
    events: [
      { type: "tool", name: "search_experiences", status: "start" },
      { type: "tool", name: "search_experiences", status: "done" },
      { type: "card", card: outcome.card },
      { type: "text", content: text },
    ],
  };
}
