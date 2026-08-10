// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RepeatedServerFailureCircuit,
  formatChatApiError,
} from "../src/tests/qa/llm-quality-helpers";

describe("QA LLM quality helpers", () => {
  it("includes nested debug details in chat API errors", async () => {
    const response = Response.json(
      {
        error: "Internal server error",
        debug: { message: "Anthropic credit balance is too low" },
      },
      { status: 500 }
    );

    await expect(formatChatApiError(response)).resolves.toBe(
      "Chat API error: 500 (Internal server error: Anthropic credit balance is too low)"
    );
  });

  it("blocks future requests after four identical server failures", () => {
    const circuit = new RepeatedServerFailureCircuit(4);
    const detail = "Chat API error: 500 (credit balance is too low)";

    for (let count = 1; count < 4; count += 1) {
      expect(circuit.recordFailure(500, detail).message).toBe(detail);
      expect(() => circuit.assertRequestAllowed()).not.toThrow();
    }

    expect(circuit.recordFailure(500, detail).message).toContain(
      "QA BLOCKED: 4 identical HTTP 500 responses"
    );
    expect(() => circuit.assertRequestAllowed()).toThrow(
      "QA BLOCKED: 4 identical HTTP 500 responses"
    );
  });

  it("resets the identical-failure count after a success", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    const detail = "Chat API error: 503 (unavailable)";

    circuit.recordFailure(503, detail);
    circuit.recordSuccess();

    expect(circuit.recordFailure(503, detail).message).toBe(detail);
    expect(() => circuit.assertRequestAllowed()).not.toThrow();
  });
});
