import { bookingDisplayText } from "@/lib/booking/display";
import type { ExperienceMatchCopy } from "../experience-match-panel";
import type { MatchCriteria } from "@/hooks/use-experience-match";
import type { Locale } from "@/lib/i18n/types";
import { interpolate } from "@/lib/i18n/interpolate";
import { money } from "@/lib/booking-format";

const COPY_KEYS = [
  "title",
  "preference",
  "preferenceHelp",
  "budgetDisclosure",
  "consumptionDisclosure",
  "date",
  "partySize",
  "budgetEuros",
  "requirements",
  "stepFree",
  "publicTransport",
  "pets",
  "minAge",
  "language",
  "none",
  "submit",
  "cancel",
  "retry",
  "close",
  "checking",
  "searching",
  "disabled",
  "accessExpired",
  "accessAction",
  "allowanceExhausted",
  "rateLimited",
  "retryAfter",
  "invalidInput",
  "unavailable",
  "cancelled",
  "noResults",
  "degraded",
  "noClearStyleMatch",
  "estimatedStyle",
  "notEstablishedStyle",
  "useInChat",
  "remaining",
  "examined",
  "truncated",
  "catalogNotices",
  "slots",
  "alternatives",
  "places",
  "deposit",
  "duration",
  "maxParty",
  "chatGuidance",
] as const;
type Translate = (key: string) => string;

export function buildExperienceMatchCopy(t: Translate): ExperienceMatchCopy {
  const copy = Object.fromEntries(
    COPY_KEYS.map((key) => [key, t(`booking.match.${key}`)]),
  ) as Pick<ExperienceMatchCopy, (typeof COPY_KEYS)[number]>;
  return {
    ...copy,
    validation: {
      preference: t("booking.match.validation.preference"),
      date: t("booking.match.validation.date"),
      partySize: t("booking.match.validation.partySize"),
      budgetCents: t("booking.match.validation.budgetCents"),
      min_age: t("booking.match.validation.min_age"),
    },
    suitability: {
      suitable: t("booking.cards.suitability.suitable"),
      unconfirmed: t("booking.cards.suitability.unconfirmed"),
      rejected: t("booking.cards.suitability.rejected"),
    },
    reasons: {
      over_budget: t("booking.cards.reason.over_budget"),
      party_too_large: t("booking.cards.reason.party_too_large"),
      constraint_unsupported: t("booking.cards.reason.constraint_unsupported"),
      no_availability: t("booking.cards.reason.no_availability"),
    },
    verdicts: {
      supported: t("booking.match.verdictSupported"),
      unsupported: t("booking.cards.verdict.unsupported"),
      unknown: t("booking.cards.verdict.unknown"),
    },
    constraintLabels: {
      step_free: copy.stepFree,
      public_transport: copy.publicTransport,
      pets: copy.pets,
      min_age: t("booking.match.ageRequirement"),
      language: t("booking.match.languageRequirement"),
    },
    languageOptions: ["es", "en", "fr", "de", "pt"].map((value) => ({
      value,
      label: t(`booking.match.languageNames.${value}`),
    })),
  };
}

/** Plain editable text only. Selecting an option never sends a chat turn. */
export function formatExperienceMatchPrefill(
  title: string,
  criteria: MatchCriteria,
  t: Translate,
  locale: Locale,
): string {
  const lines = [interpolate(t("booking.match.prefill.title"), { title: bookingDisplayText(title, locale) })];
  if (criteria.date)
    lines.push(
      interpolate(t("booking.match.prefill.date"), { date: criteria.date }),
    );
  if (criteria.partySize !== undefined)
    lines.push(
      interpolate(t("booking.match.prefill.party"), {
        partySize: String(criteria.partySize),
      }),
    );
  if (criteria.budgetCents !== undefined)
    lines.push(
      interpolate(t("booking.match.prefill.budget"), {
        budget: money(criteria.budgetCents, "EUR", locale),
      }),
    );
  const constraints = criteria.constraints ?? {},
    labels: string[] = [];
  if (constraints.step_free) labels.push(t("booking.match.stepFree"));
  if (constraints.public_transport)
    labels.push(t("booking.match.publicTransport"));
  if (constraints.pets) labels.push(t("booking.match.pets"));
  if (constraints.min_age !== undefined)
    labels.push(`${t("booking.match.ageRequirement")}: ${constraints.min_age}`);
  if (constraints.language) {
    const key = `booking.match.languageNames.${constraints.language}`,
      name = t(key);
    labels.push(
      `${t("booking.match.languageRequirement")}: ${name === key ? constraints.language : name}`,
    );
  }
  if (labels.length)
    lines.push(
      interpolate(t("booking.match.prefill.requirements"), {
        constraints: labels.join("; "),
      }),
    );
  return lines.join(" ");
}
