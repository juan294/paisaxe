import "server-only";
import { logger } from "@/lib/logger";
import type { ElevenLabsCredentialErrorCode } from "@/lib/elevenlabs-credentials";

export type ElevenLabsFailureClass =
  | ElevenLabsCredentialErrorCode
  | "missing_agent_configuration"
  | "agent_identity_mismatch"
  | "upstream_authentication_failed"
  | "upstream_rate_limited"
  | "upstream_unavailable"
  | "upstream_timeout"
  | "invalid_upstream_response"
  | "unknown";

export type ElevenLabsProviderStatusClass =
  | "upstream_authentication_failed"
  | "upstream_rate_limited"
  | "upstream_unavailable";

const CREDENTIAL_FAILURE_CLASSES = new Set<ElevenLabsFailureClass>([
  "missing_api_key",
  "missing_api_key_fingerprint",
  "malformed_api_key_fingerprint",
  "api_key_fingerprint_mismatch",
  "upstream_authentication_failed",
]);

interface ElevenLabsFailureDetails {
  source: string;
  agentKey?: string;
  failureClass: ElevenLabsFailureClass;
  providerStatus?: number;
  fingerprint?: string;
  fingerprintMatches?: boolean;
}

/** Emit one canonical, credential-safe event for every ElevenLabs failure. */
export function logElevenLabsFailure({
  source,
  agentKey,
  failureClass,
  providerStatus,
  fingerprint,
  fingerprintMatches = false,
}: ElevenLabsFailureDetails): void {
  const credentialRejected =
    isElevenLabsCredentialFailureClass(failureClass) ||
    providerStatus === 401 ||
    providerStatus === 403;

  logger.error(
    credentialRejected
      ? "[ELEVENLABS_CREDENTIAL_REJECTED]"
      : "[ELEVENLABS_PROVIDER_UNAVAILABLE]",
    {
      source,
      ...(agentKey ? { agent_key: agentKey } : {}),
      failure_class: failureClass,
      provider_status: providerStatus ?? null,
      fingerprint: fingerprint ?? null,
      fingerprint_matches: fingerprintMatches,
    }
  );
}

export function isElevenLabsCredentialFailureClass(
  failureClass: ElevenLabsFailureClass
): boolean {
  return CREDENTIAL_FAILURE_CLASSES.has(failureClass);
}

export function classifyElevenLabsProviderStatus(
  status: number
): ElevenLabsProviderStatusClass {
  if (status === 401 || status === 403) {
    return "upstream_authentication_failed";
  }
  if (status === 429) return "upstream_rate_limited";
  return "upstream_unavailable";
}
