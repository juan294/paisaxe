import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ElevenLabsCredentialError,
  fingerprintElevenLabsApiKey,
  getElevenLabsRuntimeCredential,
} from "./elevenlabs-credentials";

describe("ElevenLabs runtime credentials", () => {
  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", "runtime-secret");
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", "");
    vi.stubEnv("VERCEL_ENV", "preview");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives the documented safe fingerprint format", () => {
    expect(fingerprintElevenLabsApiKey(" runtime-secret ")).toMatch(
      /^sha256:[0-9a-f]{16}$/
    );
    expect(fingerprintElevenLabsApiKey(" runtime-secret ")).toBe(
      fingerprintElevenLabsApiKey("runtime-secret")
    );
  });

  it("fails when the provider API key is missing", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    expect(() => getElevenLabsRuntimeCredential()).toThrowError(
      expect.objectContaining({ code: "missing_api_key" })
    );
  });

  it("fails before provider I/O when the configured fingerprint is malformed", () => {
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", "sha256:not-hex");

    expect(() => getElevenLabsRuntimeCredential()).toThrowError(
      expect.objectContaining({
        code: "malformed_api_key_fingerprint",
        fingerprintMatches: false,
      })
    );
  });

  it("fails before provider I/O when the configured fingerprint does not match", () => {
    vi.stubEnv(
      "ELEVENLABS_API_KEY_FINGERPRINT",
      "sha256:0000000000000000"
    );

    expect(() => getElevenLabsRuntimeCredential()).toThrowError(
      expect.objectContaining({
        code: "api_key_fingerprint_mismatch",
        fingerprint: fingerprintElevenLabsApiKey("runtime-secret"),
        fingerprintMatches: false,
      })
    );
  });

  it("fails closed in production when the fingerprint is absent", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(() => getElevenLabsRuntimeCredential()).toThrowError(
      expect.objectContaining({
        code: "missing_api_key_fingerprint",
        fingerprint: fingerprintElevenLabsApiKey("runtime-secret"),
      })
    );
  });

  it("returns a bound credential when the fingerprint matches", () => {
    const fingerprint = fingerprintElevenLabsApiKey("runtime-secret");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", fingerprint);

    expect(getElevenLabsRuntimeCredential()).toEqual({
      apiKey: "runtime-secret",
      fingerprint,
      fingerprintMatches: true,
    });
  });

  it("never serializes the API key in a credential error", () => {
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", "sha256:0000000000000000");

    const error = (() => {
      try {
        getElevenLabsRuntimeCredential();
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(ElevenLabsCredentialError);
    expect(JSON.stringify(error)).not.toContain("runtime-secret");
    expect(String(error)).not.toContain("runtime-secret");
  });
});
