import { requiredValue } from "@/test/required-value";
import { describe, expect, it } from "vitest";
import { evaluateConstraints, visitorConstraintsSchema } from "./facts";
import type { ExperienceFact } from "./types";

function fact(partial: Partial<ExperienceFact> & Pick<ExperienceFact, "key" | "value">): ExperienceFact {
  return { detail: null, data: {}, confirmedByProvider: true, ...partial };
}

const coastalWalk = {
  facts: [
    fact({ key: "step_free", value: "yes", detail: "Sendero llano" }),
    fact({ key: "public_transport", value: "yes" }),
    fact({ key: "languages", value: "yes", data: { languages: ["es", "en"] } }),
    fact({ key: "min_age", value: "yes", data: { min_age: 0 } }),
  ],
};
const canoe = {
  facts: [
    fact({ key: "step_free", value: "no", detail: "El embarcadero tiene escalones" }),
    fact({ key: "min_age", value: "yes", data: { min_age: 8 } }),
  ],
};
const jeep = {
  facts: [
    fact({ key: "step_free", value: "unknown", confirmedByProvider: false }),
    fact({ key: "public_transport", value: "no" }),
    fact({ key: "pets_allowed", value: "unknown", confirmedByProvider: false }),
  ],
};

describe("evaluateConstraints (F07)", () => {
  it("returns supported, unsupported and unknown for step_free across the three fixture values", () => {
    expect(evaluateConstraints(coastalWalk, { step_free: true })).toEqual([
      { key: "step_free", verdict: "supported", detail: "Sendero llano", confirmedByProvider: true },
    ]);
    expect(evaluateConstraints(canoe, { step_free: true })).toEqual([
      { key: "step_free", verdict: "unsupported", detail: "El embarcadero tiene escalones", confirmedByProvider: true },
    ]);
    expect(evaluateConstraints(jeep, { step_free: true })[0]).toMatchObject({
      key: "step_free",
      verdict: "unknown",
      confirmedByProvider: false,
    });
  });

  it("treats a yes or no the provider has not confirmed as unknown", () => {
    const unconfirmed = { facts: [fact({ key: "step_free", value: "yes", confirmedByProvider: false })] };
    expect(requiredValue(evaluateConstraints(unconfirmed, { step_free: true })[0], "src/lib/booking/facts.test.ts:48 evaluateConstraints(unconfirmed, { step_free: true })[0]").verdict).toBe("unknown");
  });

  it("treats a missing fact as unknown", () => {
    expect(evaluateConstraints(canoe, { public_transport: true })).toEqual([
      { key: "public_transport", verdict: "unknown", detail: null, confirmedByProvider: false },
    ]);
  });

  it("maps pets onto pets_allowed", () => {
    expect(evaluateConstraints(jeep, { pets: true })[0]).toMatchObject({ key: "pets", verdict: "unknown" });
    const petFriendly = { facts: [fact({ key: "pets_allowed", value: "yes" })] };
    expect(requiredValue(evaluateConstraints(petFriendly, { pets: true })[0], "src/lib/booking/facts.test.ts:60 evaluateConstraints(petFriendly, { pets: true })[0]").verdict).toBe("supported");
  });

  it("compares the youngest participant's age with the provider's minimum age", () => {
    expect(requiredValue(evaluateConstraints(canoe, { min_age: 6 })[0], "src/lib/booking/facts.test.ts:64 evaluateConstraints(canoe, { min_age: 6 })[0]").verdict).toBe("unsupported");
    expect(requiredValue(evaluateConstraints(canoe, { min_age: 8 })[0], "src/lib/booking/facts.test.ts:65 evaluateConstraints(canoe, { min_age: 8 })[0]").verdict).toBe("supported");
    expect(requiredValue(evaluateConstraints(coastalWalk, { min_age: 2 })[0], "src/lib/booking/facts.test.ts:66 evaluateConstraints(coastalWalk, { min_age: 2 })[0]").verdict).toBe("supported");
    expect(requiredValue(evaluateConstraints(jeep, { min_age: 10 })[0], "src/lib/booking/facts.test.ts:67 evaluateConstraints(jeep, { min_age: 10 })[0]").verdict).toBe("unknown");
  });

  it("checks a requested language against the provider's stated languages", () => {
    expect(requiredValue(evaluateConstraints(coastalWalk, { language: "en" })[0], "src/lib/booking/facts.test.ts:71 evaluateConstraints(coastalWalk, { language: \"en\" })[0]").verdict).toBe("supported");
    expect(requiredValue(evaluateConstraints(coastalWalk, { language: "de" })[0], "src/lib/booking/facts.test.ts:72 evaluateConstraints(coastalWalk, { language: \"de\" })[0]").verdict).toBe("unsupported");
    expect(requiredValue(evaluateConstraints(canoe, { language: "en" })[0], "src/lib/booking/facts.test.ts:73 evaluateConstraints(canoe, { language: \"en\" })[0]").verdict).toBe("unknown");
  });

  it("evaluates only the constraints the visitor asked for, in a stable order", () => {
    expect(evaluateConstraints(coastalWalk, {})).toEqual([]);
    expect(evaluateConstraints(coastalWalk, { step_free: false })).toEqual([]);
    expect(
      evaluateConstraints(coastalWalk, { language: "es", step_free: true }).map((v) => v.key)
    ).toEqual(["step_free", "language"]);
  });
});

describe("visitorConstraintsSchema", () => {
  it("accepts the closed key list", () => {
    expect(
      visitorConstraintsSchema.parse({ step_free: true, public_transport: false, pets: true, min_age: 7, language: "en" })
    ).toEqual({ step_free: true, public_transport: false, pets: true, min_age: 7, language: "en" });
  });

  it("rejects unknown keys and out-of-range values", () => {
    expect(visitorConstraintsSchema.safeParse({ wheelchair: true }).success).toBe(false);
    expect(visitorConstraintsSchema.safeParse({ min_age: -1 }).success).toBe(false);
    expect(visitorConstraintsSchema.safeParse({ language: "english" }).success).toBe(false);
  });
});
