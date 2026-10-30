import { addDays, isoDateSchema, madridDate } from "./types";
export interface IntakeSpan<T extends number | string | boolean> {
  id: string;
  start: number;
  end: number;
  text: string;
  value: T;
}
export interface IntakeCriteria {
  partySize: number;
  date: string;
  budgetCents?: number;
  constraints: { step_free?: true; public_transport?: true; pets?: true };
}
export interface IntakeCandidates {
  status: "candidates";
  source: string;
  party: IntakeSpan<number>[];
  date: IntakeSpan<string>[];
  budget: IntakeSpan<number>[];
  constraints: Record<
    "step_free" | "public_transport" | "pets",
    IntakeSpan<boolean>[]
  >;
}
export type CandidateResult =
  | IntakeCandidates
  | { status: "fallback"; reason: string };
const NUMBERS: Record<string, number> = {
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const NUMBER =
  "(?:\\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const ENGLISH_EXCLUDED = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|cancel|pay|paid|reserve|booking|book|change|modify|discount|less than|more than|under|over|day after tomorrow|morning|afternoon|evening|tonight|at\s+\d+|children|child|babies|baby|years? old|age|ages|aged|language|english|french|german|spanish|allerg|equipment|prefer|quiet|romantic)\b/i;
const EXCLUDED =
  /\b(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|cancelar|cancela|pagar|pago|pagado|cotizaci[oó]n|presupuesto de|reserva|reservar|cambiar|modificar|descuento|menos de|m[aá]s de|pasado ma[ñn]ana|por la ma[ñn]ana|por la tarde|por la noche|a las|horario|ni[ñn]os?|beb[eé]s?|a[ñn]os|idioma|ingl[eé]s|franc[eé]s|alem[aá]n|espa[ñn]ol|alergia|equipo|prefiero|preferimos|tranquilo|rom[aá]ntico)\b/i;
// Qualifiers must attach to the party phrase; unrelated duration/budget uncertainty stays separate.
const PARTY_UNCERTAINTY = String.raw`(?:aproximadamente|aprox\.?|alrededor\s+de|cerca\s+de|en\s+torno\s+a|m[aá]s\s+o\s+menos|un[oa]s|quiz[aá]s?|tal\s+vez|o\s+as[ií]|probablemente|posiblemente|puede\s+que|no\s+s[eé]\s+si|al\s+menos|como\s+m[ií]nimo|hasta|como\s+m[aá]ximo|o\s+m[aá]s|o\s+menos|y\s+pico|approximately|roughly|about|around|maybe|perhaps|probably|possibly|at\s+least|at\s+most|up\s+to|or\s+so|or\s+more|or\s+less)`;
const UNCERTAIN_PARTY_PREFIX = new RegExp(
  String.raw`\b${PARTY_UNCERTAINTY}\s+(?:(?:somos|seremos|seamos|ser|para|de|we\s+are|we\s+will\s+be|for)\s+)?$`,
  "i",
);
const UNCERTAIN_PARTY_SUFFIX = new RegExp(
  String.raw`^\s*(?:(?:personas?|people|persons?|adults?|friends?)\b\s*)?[,()]?\s*(${PARTY_UNCERTAINTY})(?=$|[\s,.!?;)])`,
  "i",
);
// An adjacent qualifier may instead introduce a stated duration or monetary amount.
const FOLLOWING_OTHER_QUANTITY = new RegExp(
  String.raw`^\s+(?:${PARTY_UNCERTAINTY}\s+)*(?:\d+(?:[.,]\d+)?|${NUMBER}|un|media|medio|un\s+par\s+de|un\s+cuarto\s+de)\s*(?:horas?|minutos?|segundos?|d[ií]as?|hours?|minutes?|seconds?|days?|euros?|€)(?=$|[\s,.;!?)])`,
  "i",
);
const COUNT_ONLY_PARTY_SUFFIX =
  /^(?:o\s+m[aá]s|o\s+menos|o\s+as[ií]|y\s+pico|or\s+so|or\s+more|or\s+less)$/i;
function uncertainPartySuffix(text: string): boolean {
  const qualifier = UNCERTAIN_PARTY_SUFFIX.exec(text);
  return (
    qualifier !== null &&
    (COUNT_ONLY_PARTY_SUFFIX.test(qualifier[1]!) ||
      !FOLLOWING_OTHER_QUANTITY.test(text.slice(qualifier[0].length)))
  );
}
function spans<T extends number | string | boolean>(
  text: string,
  regex: RegExp,
  field: string,
  value: (match: RegExpMatchArray) => T,
): IntakeSpan<T>[] {
  return [...text.matchAll(regex)].map((match, index) => ({
    id: `${field}_${index}`,
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    value: value(match),
  }));
}
/** Tentative parties need clarification even outside the discovery fast path. */
export function partySizeClarificationReason(message: string): "uncertain_party" | "ambiguous_party" | null {
  if (new RegExp(`\\b${NUMBER}\\s*(?:o|y|or|and)\\s*${NUMBER}\\s+(?:personas?|people|persons?|adults?|friends?|of\\s+us)\\b`, "i").test(message)) return "ambiguous_party";
  if (new RegExp(String.raw`\b(?:we\s+(?:are|will\s+be)|we['’](?:re|ll\s+be))\s+(?:${PARTY_UNCERTAINTY}\s+)+${NUMBER}\b`, "i").test(message)) return "uncertain_party";
  const party = partySpans(message);
  return party.some(candidate => UNCERTAIN_PARTY_PREFIX.test(message.slice(0, candidate.start)) || uncertainPartySuffix(message.slice(candidate.end))) ? "uncertain_party" : null;
}
function partySpans(message: string): IntakeSpan<number>[] {
  return spans(message, new RegExp(`\\b(?:somos\\s+(${NUMBER})|(?:we\\s+(?:are|will\\s+be)|we['’](?:re|ll\\s+be))\\s+(?:exactly\\s+)?(${NUMBER})|(${NUMBER})\\s+(?:personas?|people|persons?|adults?|friends?|of\\s+us))\\b`, "gi"), "party",
    match => { const count=match[1] ?? match[2] ?? match[3] ?? ""; return NUMBERS[count.toLowerCase()] ?? Number(count); });
}
/** Enumerate only original spans; values, horizon and arithmetic are code-owned. */
export function enumerateIntakeCandidates(
  message: string,
  now: Date = new Date(),
): CandidateResult {
  const fallback = (reason: string): CandidateResult => ({
    status: "fallback",
    reason,
  });
  if (!message.trim() || message.length > 500 || EXCLUDED.test(message) || ENGLISH_EXCLUDED.test(message))
    return fallback("unsupported_request");
  const clarification = partySizeClarificationReason(message);
  if (clarification) return fallback(clarification);
  const party = partySpans(message);
  if (!party.length) return fallback("missing_party");
  if (
    party.some(
      (c) =>
        /[\d.,+\-]/.test(message[c.start - 1] ?? "") ||
        /^[.,]\d/.test(message.slice(c.end)),
    )
  )
    return fallback("unsupported_party_format");
  if (
    party.some((c) => !Number.isInteger(c.value) || c.value < 1 || c.value > 12)
  )
    return fallback("invalid_party");
  const today = madridDate(now),
    last = addDays(today, 90);
  const date = spans(
    message,
    /\b(?:\d{4}-\d{2}-\d{2}|hoy|ma[ñn]ana|today|tomorrow)\b/gi,
    "date",
    (match) =>
      /^(?:hoy|today)$/i.test(match[0])
        ? today
        : /^(?:ma[ñn]ana|tomorrow)$/i.test(match[0])
          ? addDays(today, 1)
          : match[0],
  );
  if (!date.length) return fallback("missing_date");
  if (
    date.some(
      (c) =>
        !isoDateSchema.safeParse(c.value).success ||
        c.value < today ||
        c.value > last,
    )
  )
    return fallback("invalid_date");
  const budget = spans(
    message,
    /\b(?:hasta|como m[aá]ximo|up to|at most)\s+(?:(\d+(?:[.,]\d{1,2})?)\s*(?:euros?|€|EUR)|(?:€|EUR)\s*(\d+(?:[.,]\d{1,2})?)(?![\d.,]))/gi,
    "budget",
    (match) => {
      const [whole, fraction = ""] = String(match[1] ?? match[2])
        .replace(",", ".")
        .split(".");
      return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    },
  );
  if (
    budget.some(
      (c) =>
        !Number.isSafeInteger(c.value) || c.value < 0 || c.value > 10_000_000,
    )
  )
    return fallback("invalid_budget");
  const currencyCount = [...message.matchAll(/\b(?:euros?|EUR)\b|€/gi)].length;
  if (
    [...message.matchAll(/\b(?:hasta|como m[aá]ximo|up to|at most)\b/gi)].length !==
      budget.length ||
    currencyCount !== budget.length ||
    (/\b(?:presupuesto|dinero|gastar|cuesta|cuestan|budget|money|spend|costs?)\b/i.test(message) &&
      !budget.length)
  )
    return fallback("unsupported_budget");
  if (
    [party, date, budget].some(
      (group) => new Set(group.map((c) => c.value)).size > 1,
    )
  )
    return fallback("contradictory_candidates");
  const constraints = {
    step_free: spans(
      message,
      /\b(?:sin escaleras|sin escalones|sin barreras|step[- ]free(?: access)?|(?:no|without) (?:steps|stairs))\b/gi,
      "step_free",
      () => true,
    ),
    public_transport: spans(
      message,
      /\b(?:transporte p[uú]blico|public transport)\b/gi,
      "public_transport",
      () => true,
    ),
    pets: spans(
      message,
      /\b(?:con (?:mi |nuestro )?(?:perro|perra|mascotas?)|(?:with|and) (?:my |our |a )?(?:dogs?|pets?))\b/gi,
      "pets",
      () => true,
    ),
  };
  return {
    status: "candidates",
    source: message,
    party,
    date,
    budget,
    constraints,
  };
}
/** Cheap literal comparator, not a model-quality baseline claim. */
export function deterministicIntake(
  message: string,
  now: Date = new Date(),
):
  | { status: "accepted"; criteria: IntakeCriteria }
  | { status: "fallback"; reason: string } {
  const parsed = enumerateIntakeCandidates(message, now);
  if (parsed.status === "fallback") return parsed;
  if (
    !/\b(?:experiencias|qu[eé] hay|hacer algo|opciones|actividades|disponib|experiences|activities|options|available|what is|what's)/i.test(
      message,
    )
  )
    return { status: "fallback", reason: "literal_discovery_absent" };
  const party = parsed.party[0],
    date = parsed.date[0],
    budget = parsed.budget[0];
  if (!party || !date)
    return { status: "fallback", reason: "missing_required" };
  return {
    status: "accepted",
    criteria: {
      partySize: party.value,
      date: date.value,
      ...(budget ? { budgetCents: budget.value } : {}),
      constraints: {
        ...(parsed.constraints.step_free.length ? { step_free: true } : {}),
        ...(parsed.constraints.public_transport.length
          ? { public_transport: true }
          : {}),
        ...(parsed.constraints.pets.length ? { pets: true } : {}),
      },
    },
  };
}
