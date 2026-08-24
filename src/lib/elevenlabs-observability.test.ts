import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: { error: mocks.error } }));

import {
  classifyElevenLabsProviderStatus,
  logElevenLabsFailure,
} from "./elevenlabs-observability";

describe("ElevenLabs observability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits a safe canonical credential rejection event", () => {
    logElevenLabsFailure({
      source: "test",
      failureClass: "upstream_authentication_failed",
      providerStatus: 401,
      fingerprint: "sha256:1234567890abcdef",
      fingerprintMatches: true,
    });

    expect(mocks.error).toHaveBeenCalledWith(
      "[ELEVENLABS_CREDENTIAL_REJECTED]",
      {
        source: "test",
        failure_class: "upstream_authentication_failed",
        provider_status: 401,
        fingerprint: "sha256:1234567890abcdef",
        fingerprint_matches: true,
      }
    );
    expect(JSON.stringify(mocks.error.mock.calls)).not.toMatch(
      /wss:\/\/|signed_url|api[_-]?key|bearer|sk-/i
    );
  });

  it("classifies auth, rate-limit, and outage statuses", () => {
    expect(classifyElevenLabsProviderStatus(401)).toBe(
      "upstream_authentication_failed"
    );
    expect(classifyElevenLabsProviderStatus(429)).toBe(
      "upstream_rate_limited"
    );
    expect(classifyElevenLabsProviderStatus(500)).toBe("upstream_unavailable");
  });
});
