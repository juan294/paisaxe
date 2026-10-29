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
};
const NUMBER =
  "(?:\\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)";
const EXCLUDED =
  /\b(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|cancelar|cancela|pagar|pago|pagado|cotizaci[oó]n|presupuesto de|reserva|reservar|cambiar|modificar|descuento|menos de|m[aá]s de|pasado ma[ñn]ana|por la ma[ñn]ana|por la tarde|por la noche|a las|horario|ni[ñn]os?|beb[eé]s?|a[ñn]os|idioma|ingl[eé]s|franc[eé]s|alem[aá]n|espa[ñn]ol|alergia|equipo|prefiero|preferimos|tranquilo|rom[aá]ntico)\b/i;
// Qualifiers must attach to the party phrase; unrelated duration/budget uncertainty stays separate.
const PARTY_UNCERTAINTY = String.raw`(?:aproximadamente|aprox\.?|alrededor\s+de|cerca\s+de|en\s+torno\s+a|m[aá]s\s+o\s+menos|un[oa]s|quiz[aá]s?|tal\s+vez|o\s+as[ií]|probablemente|posiblemente|puede\s+que|no\s+s[eé]\s+si|al\s+menos|como\s+m[ií]nimo|hasta|como\s+m[aá]ximo|o\s+m[aá]s|o\s+menos|y\s+pico)`;
const UNCERTAIN_PARTY_PREFIX = new RegExp(
  String.raw`\b${PARTY_UNCERTAINTY}\s+(?:(?:somos|seremos|seamos|ser|para|de)\s+)?$`,
  "i",
);
const UNCERTAIN_PARTY_SUFFIX = new RegExp(
  String.raw`^\s*(?:personas?\b\s*)?[,()]?\s*(${PARTY_UNCERTAINTY})(?=$|[\s,.!?;)])`,
  "i",
);
// An adjacent qualifier may instead introduce a stated duration or monetary amount.
const FOLLOWING_OTHER_QUANTITY = new RegExp(
  String.raw`^\s+(?:${PARTY_UNCERTAINTY}\s+)*(?:\d+(?:[.,]\d+)?|${NUMBER}|un|media|medio|un\s+par\s+de|un\s+cuarto\s+de)\s*(?:horas?|minutos?|segundos?|d[ií]as?|euros?|€)(?=$|[\s,.;!?)])`,
  "i",
);
const COUNT_ONLY_PARTY_SUFFIX =
  /^(?:o\s+m[aá]s|o\s+menos|o\s+as[ií]|y\s+pico)$/i;
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
/** Enumerate only original spans; values, horizon and arithmetic are code-owned. */
export function enumerateIntakeCandidates(
  message: string,
  now: Date = new Date(),
): CandidateResult {
  const fallback = (reason: string): CandidateResult => ({
    status: "fallback",
    reason,
  });
  if (!message.trim() || message.length > 500 || EXCLUDED.test(message))
    return fallback("unsupported_request");
  if (
    new RegExp(
      `\\b${NUMBER}\\s*(?:o|y)\\s*${NUMBER}\\s+personas?\\b`,
      "i",
    ).test(message)
  )
    return fallback("ambiguous_party");
  const party = spans(
    message,
    new RegExp(`\\b(?:somos\\s+(${NUMBER})|(${NUMBER})\\s+personas?)\\b`, "gi"),
    "party",
    (match) =>
      NUMBERS[(match[1] ?? match[2] ?? "").toLowerCase()] ??
      Number(match[1] ?? match[2]),
  );
  if (!party.length) return fallback("missing_party");
  if (
    party.some(
      (candidate) =>
        UNCERTAIN_PARTY_PREFIX.test(message.slice(0, candidate.start)) ||
        uncertainPartySuffix(message.slice(candidate.end)),
    )
  )
    return fallback("uncertain_party");
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
    /\b(?:\d{4}-\d{2}-\d{2}|hoy|ma[ñn]ana)\b/gi,
    "date",
    (match) =>
      /^hoy$/i.test(match[0])
        ? today
        : /^ma[ñn]ana$/i.test(match[0])
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
    /\b(?:hasta|como m[aá]ximo)\s+(\d+(?:[.,]\d{1,2})?)\s*(?:euros?|€)/gi,
    "budget",
    (match) => {
      const [whole, fraction = ""] = String(match[1])
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
  const currencyCount = [...message.matchAll(/\beuros?\b|€/gi)].length;
  if (
    [...message.matchAll(/\b(?:hasta|como m[aá]ximo)\b/gi)].length !==
      budget.length ||
    currencyCount !== budget.length ||
    (/\b(?:presupuesto|dinero|gastar|cuesta|cuestan)\b/i.test(message) &&
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
      /\b(?:sin escaleras|sin escalones|sin barreras)\b/gi,
      "step_free",
      () => true,
    ),
    public_transport: spans(
      message,
      /\b(?:transporte p[uú]blico)\b/gi,
      "public_transport",
      () => true,
    ),
    pets: spans(
      message,
      /\b(?:con (?:mi |nuestro )?(?:perro|perra|mascotas?))\b/gi,
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
    !/\b(?:experiencias|qu[eé] hay|hacer algo|opciones|actividades|disponib)/i.test(
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
