/**
 * Visitor constraints evaluated against provider facts (plan F07).
 *
 * Each requested constraint gets a verdict: supported, unsupported or unknown.
 * Only a fact the provider confirmed can support or rule out a constraint;
 * anything else is unknown, and the agent may not claim suitability for an
 * unknown. The verdict carries the provider's detail so the offer can show
 * its evidence.
 */
import { z } from "zod";
import type { Experience, ExperienceFact, FactKey } from "./types";

export const visitorConstraintsSchema = z
  .object({
    step_free: z.boolean().optional(),
    public_transport: z.boolean().optional(),
    pets: z.boolean().optional(),
    /** Age of the youngest participant. */
    min_age: z.number().int().min(0).max(120).optional(),
    /** ISO 639-1 language code, e.g. "en". */
    language: z.string().regex(/^[a-z]{2}$/).optional(),
  })
  .strict();

export type VisitorConstraints = z.infer<typeof visitorConstraintsSchema>;
type ConstraintKey = keyof VisitorConstraints;

type Verdict = "supported" | "unsupported" | "unknown";

export interface ConstraintVerdict {
  key: ConstraintKey;
  verdict: Verdict;
  detail: string | null;
  confirmedByProvider: boolean;
}

/** Evaluation order, and the provider fact each constraint is checked against. */
const CONSTRAINT_FACTS: [ConstraintKey, FactKey][] = [
  ["step_free", "step_free"],
  ["public_transport", "public_transport"],
  ["pets", "pets_allowed"],
  ["min_age", "min_age"],
  ["language", "languages"],
];

function isRequested(constraints: VisitorConstraints, key: ConstraintKey): boolean {
  const value = constraints[key];
  return value !== undefined && value !== false;
}

function verdictFor(key: ConstraintKey, fact: ExperienceFact, constraints: VisitorConstraints): Verdict {
  if (!fact.confirmedByProvider || fact.value === "unknown") return "unknown";

  switch (key) {
    case "min_age": {
      // "no" means the provider states there is no minimum age.
      if (fact.value === "no") return "supported";
      const minimum = fact.data.min_age;
      if (typeof minimum !== "number") return "unknown";
      return (constraints.min_age ?? 0) >= minimum ? "supported" : "unsupported";
    }
    case "language": {
      const languages = fact.data.languages;
      if (fact.value !== "yes" || !Array.isArray(languages)) return "unknown";
      return languages.includes(constraints.language) ? "supported" : "unsupported";
    }
    default:
      return fact.value === "yes" ? "supported" : "unsupported";
  }
}

export function evaluateConstraints(
  experience: Pick<Experience, "facts">,
  constraints: VisitorConstraints
): ConstraintVerdict[] {
  const facts = new Map(experience.facts.map((fact) => [fact.key, fact]));

  return CONSTRAINT_FACTS.filter(([key]) => isRequested(constraints, key)).map(([key, factKey]) => {
    const fact = facts.get(factKey);
    if (!fact) return { key, verdict: "unknown", detail: null, confirmedByProvider: false };
    return {
      key,
      verdict: verdictFor(key, fact, constraints),
      detail: fact.detail,
      confirmedByProvider: fact.confirmedByProvider,
    };
  });
}
