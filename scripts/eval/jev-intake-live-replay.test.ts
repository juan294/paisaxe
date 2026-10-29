// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interpretBookingIntake } from "../../src/lib/booking/intake";
import { hashJev } from "../lib/jev-evaluation";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../src/lib/booking/__fixtures__/intake-v2-transport.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  packets: {
    id: string;
    input: { message: string; now: string };
    expected: { status: string; criteria?: unknown };
    request: unknown;
    response: unknown;
    observedOutcome: { status: string; reason?: string; criteria?: unknown };
  }[];
};
afterEach(() => vi.unstubAllEnvs());

describe("authorized live intake exchanges replayed at the SDK HTTP boundary", () => {
  for (const packet of fixture.packets) {
    it(`${packet.id}: preserves the reference outcome through the versioned request`, async () => {
      vi.stubEnv("TYPESAFE_API_KEY", "synthetic-replay-key");
      let observedUrl = "";
      let observedRequest: unknown = null;
      let responseServed = false;
      const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
        observedUrl = String(input);
        observedRequest = JSON.parse(String(init?.body));
        const response = Response.json(packet.response);
        responseServed = true;
        return response;
      });
      const result = await interpretBookingIntake(packet.input.message, {
        now: new Date(packet.input.now),
        fetch,
        context: {
          mode: "evaluation",
          task: "booking_intake",
          authorized: true,
        },
      });
      // The adapter catches transport failures, including thrown assertions.
      // Assert provenance outside that boundary, including for expected fallbacks.
      expect(observedUrl).toBe("https://api.typesafe.ai/v1/systemone");
      expect(hashJev(observedRequest)).toBe(hashJev(packet.request));
      expect(responseServed).toBe(true);
      expect(result).toMatchObject(packet.observedOutcome);
      expect(result.status).toBe(packet.expected.status);
      if (packet.expected.status === "accepted") {
        expect(result).toHaveProperty("criteria", packet.expected.criteria);
      }
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  }
});
