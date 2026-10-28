import type {
  VisitorConstraints,
  ConstraintVerdict,
} from "../lib/booking/facts";
import type { Experience } from "../lib/booking/types";
import type {
  SearchResult,
  SlotAvailability,
} from "../lib/booking/availability";
export interface MatchRequest {
  locale: "es";
  preference: string;
  date?: string;
  partySize?: number;
  budgetCents?: number;
  constraints?: VisitorConstraints;
}
export interface MatchCatalogOption {
  experience: Pick<
    Experience,
    | "id"
    | "title"
    | "description"
    | "currency"
    | "priceCents"
    | "depositCents"
    | "maxParty"
    | "durationMinutes"
    | "facts"
  >;
  suitability: SearchResult["suitability"];
  verdicts: ConstraintVerdict[];
  reasons: SearchResult["reasons"];
  slots: SlotAvailability[];
  alternatives: SlotAvailability[];
}
export interface MatchSuggestion extends MatchCatalogOption {
  styleFit: "estimated" | "not_established";
}
interface MatchResults {
  suggestions: MatchSuggestion[];
  catalog: MatchCatalogOption[];
  examinedCount: number;
  truncated: boolean;
  remaining: number;
}
export type MatchResult =
  | (MatchResults & {
      status: "matched";
      reason: "style_matches" | "no_clear_style_match";
    })
  | (MatchResults & {
      status: "degraded";
      reason: "semantic_unavailable" | "deadline";
    })
  | (MatchResults & { status: "no_results"; suggestions: [] })
  | {
      status: "unavailable";
      reason:
        "catalog_unavailable" | "deadline" | "cancelled" | "metering_unknown";
      guidance: "retry_or_chat";
      turnMayBeConsumed: boolean;
    };
export type MatchResponse =
  | MatchResult
  | { status: "invalid_input"; fields: Record<string, string> }
  | { status: "rate_limited" | "allowance_exhausted"; retryAfter?: number }
  | { error: "Not found" };
