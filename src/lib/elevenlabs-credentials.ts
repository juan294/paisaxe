import "server-only";
import { createHash } from "node:crypto";

export const ELEVENLABS_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{16}$/;

export type ElevenLabsCredentialErrorCode =
  | "missing_api_key"
  | "missing_api_key_fingerprint"
  | "malformed_api_key_fingerprint"
  | "api_key_fingerprint_mismatch";

export class ElevenLabsCredentialError extends Error {
  constructor(
    public readonly code: ElevenLabsCredentialErrorCode,
    public readonly fingerprint?: string,
    public readonly fingerprintMatches = false
  ) {
    super(code);
    this.name = "ElevenLabsCredentialError";
  }
}

export interface ElevenLabsRuntimeCredential {
  apiKey: string;
  fingerprint: string;
  fingerprintMatches: boolean;
}

export function fingerprintElevenLabsApiKey(apiKey: string): string {
  return `sha256:${createHash("sha256")
    .update(apiKey.trim())
    .digest("hex")
    .slice(0, 16)}`;
}

/** Bind the deployed runtime key to its configured safe identity. */
export function getElevenLabsRuntimeCredential(): ElevenLabsRuntimeCredential {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new ElevenLabsCredentialError("missing_api_key");
  }

  const fingerprint = fingerprintElevenLabsApiKey(apiKey);
  const expectedFingerprint =
    process.env.ELEVENLABS_API_KEY_FINGERPRINT?.trim();

  if (
    expectedFingerprint &&
    !ELEVENLABS_FINGERPRINT_PATTERN.test(expectedFingerprint)
  ) {
    throw new ElevenLabsCredentialError(
      "malformed_api_key_fingerprint",
      fingerprint
    );
  }

  if (expectedFingerprint && expectedFingerprint !== fingerprint) {
    throw new ElevenLabsCredentialError(
      "api_key_fingerprint_mismatch",
      fingerprint
    );
  }

  if (process.env.VERCEL_ENV === "production" && !expectedFingerprint) {
    throw new ElevenLabsCredentialError(
      "missing_api_key_fingerprint",
      fingerprint
    );
  }

  return {
    apiKey,
    fingerprint,
    fingerprintMatches: expectedFingerprint === fingerprint,
  };
}
