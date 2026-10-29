// @vitest-environment node
import { describe, expect, it } from "vitest";
import { enumerateIntakeCandidates } from "../../src/lib/booking/intake-candidates";
import { buildIntakeRequest } from "../../src/lib/booking/intake-questions";
import { bookingIntakeSuite } from "./jev-booking-intake";
import { hashJev } from "../lib/jev-evaluation";

const message =
  "¿Qué experiencias hay para dos personas el 2026-10-30 hasta 40 euros?";
const now = new Date("2026-10-28T10:00:00Z");

describe("booking intake semantic question contract", () => {
  it("gives each independent judgment its own true and false criteria", () => {
    const candidates = enumerateIntakeCandidates(message, now);
    if (candidates.status === "fallback")
      throw new Error("Authored tuning input must parse");
    const questions = Object.values(
      buildIntakeRequest(candidates).questionSet.questions,
    );
    expect(questions.length).toBe(13);
    const criteria = questions.map((question) => {
      expect(question.type).toBe("noul");
      expect(question.criteria).toBeDefined();
      return hashJev(question.criteria);
    });
    // A shared generic criterion made unrelated fields ambiguous in the live trial.
    expect(new Set(criteria).size).toBe(questions.length);
  });

  it("binds evaluation identity to the complete questions, including criteria", () => {
    const suite = bookingIntakeSuite();
    const request = suite.cases.find((item) => item.requests.length)
      ?.requests[0];
    expect(request).toBeDefined();
    for (const [key, question] of Object.entries(
      request!.questionSet.questions,
    )) {
      if (question.type === "noul")
        expect(suite.questionIdentity).toHaveProperty(key, question);
    }
  });
});
