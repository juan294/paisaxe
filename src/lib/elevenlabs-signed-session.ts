import "server-only";
import {
  ELEVENLABS_AGENT_IDS,
  type ElevenLabsAgentKey,
} from "@/config/elevenlabs-agents";
import {
  ELEVENLABS_BOOKING_AGENT_ID,
  type ElevenLabsVoiceAgentKey,
} from "@/config/elevenlabs-owned-agents";
import {
  ElevenLabsCredentialError,
  getElevenLabsRuntimeCredential,
  type ElevenLabsRuntimeCredential,
} from "@/lib/elevenlabs-credentials";
import {
  classifyElevenLabsProviderStatus,
  isElevenLabsCredentialFailureClass,
  logElevenLabsFailure,
} from "@/lib/elevenlabs-observability";

const VISITOR_AGENT_KEYS = new Set<ElevenLabsAgentKey>(["pelayo"]);
const ADMIN_AGENT_KEYS = new Set<ElevenLabsAgentKey>([
  "penny",
  "iris",
  "xander",
]);

export const ELEVENLABS_VOICE_AGENT_KEYS = [
  "pelayo",
  "booking",
  "penny",
  "iris",
  "xander",
] as const satisfies readonly ElevenLabsVoiceAgentKey[];

export type ElevenLabsSignedSessionErrorCode =
  | "missing_api_key"
  | "missing_api_key_fingerprint"
  | "malformed_api_key_fingerprint"
  | "api_key_fingerprint_mismatch"
  | "missing_agent_configuration"
  | "agent_identity_mismatch"
  | "upstream_authentication_failed"
  | "upstream_rate_limited"
  | "upstream_unavailable"
  | "invalid_upstream_response";

interface ElevenLabsSignedSessionErrorDetails {
  providerStatus?: number;
  fingerprint?: string;
  fingerprintMatches?: boolean;
}

export class ElevenLabsSignedSessionError extends Error {
  public readonly providerStatus?: number;
  public readonly fingerprint?: string;
  public readonly fingerprintMatches: boolean;

  constructor(
    public readonly code: ElevenLabsSignedSessionErrorCode,
    public readonly status: number,
    details: ElevenLabsSignedSessionErrorDetails = {}
  ) {
    super(code);
    this.name = "ElevenLabsSignedSessionError";
    this.providerStatus = details.providerStatus;
    this.fingerprint = details.fingerprint;
    this.fingerprintMatches = details.fingerprintMatches ?? false;
  }
}

export function isElevenLabsCredentialFailure(
  error: unknown
): error is ElevenLabsSignedSessionError {
  return (
    error instanceof ElevenLabsSignedSessionError &&
    isElevenLabsCredentialFailureClass(error.code)
  );
}

export function logElevenLabsSignedSessionError(
  error: ElevenLabsSignedSessionError,
  source: string,
  agentKey: ElevenLabsVoiceAgentKey
): void {
  logElevenLabsFailure({
    source,
    agentKey,
    failureClass: error.code,
    providerStatus: error.providerStatus,
    fingerprint: error.fingerprint,
    fingerprintMatches: error.fingerprintMatches,
  });
}

export function isVisitorVoiceAgentKey(
  value: unknown
): value is ElevenLabsAgentKey {
  return (
    typeof value === "string" &&
    VISITOR_AGENT_KEYS.has(value as ElevenLabsAgentKey)
  );
}

export function isAdminVoiceAgentKey(
  value: unknown
): value is ElevenLabsAgentKey {
  return (
    typeof value === "string" &&
    ADMIN_AGENT_KEYS.has(value as ElevenLabsAgentKey)
  );
}

function normalizeCredentialError(
  error: ElevenLabsCredentialError
): ElevenLabsSignedSessionError {
  return new ElevenLabsSignedSessionError(error.code, 503, {
    fingerprint: error.fingerprint,
    fingerprintMatches: error.fingerprintMatches,
  });
}

function resolveAgentId(agentKey: ElevenLabsVoiceAgentKey): string {
  if (agentKey !== "booking") {
    return ELEVENLABS_AGENT_IDS[agentKey];
  }

  const configured = process.env.ELEVENLABS_BOOKING_AGENT_ID?.trim();
  if (!configured) {
    throw new ElevenLabsSignedSessionError(
      "missing_agent_configuration",
      503
    );
  }
  if (configured !== ELEVENLABS_BOOKING_AGENT_ID) {
    throw new ElevenLabsSignedSessionError("agent_identity_mismatch", 503);
  }
  return configured;
}

function validSignedUrl(payload: unknown): string | undefined {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { signed_url?: unknown }).signed_url !== "string"
  ) {
    return undefined;
  }

  const value = (payload as { signed_url: string }).signed_url;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "wss:" && parsed.hostname ? value : undefined;
  } catch {
    return undefined;
  }
}

async function requestSignedUrl(
  agentKey: ElevenLabsVoiceAgentKey,
  agentId: string,
  credential: ElevenLabsRuntimeCredential,
  source: string,
  logFailure = true
): Promise<string> {
  const url = new URL(
    "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
  );
  url.searchParams.set("agent_id", agentId);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "xi-api-key": credential.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    const error = new ElevenLabsSignedSessionError(
      "upstream_unavailable",
      503,
      {
        fingerprint: credential.fingerprint,
        fingerprintMatches: credential.fingerprintMatches,
      }
    );
    if (logFailure) logElevenLabsSignedSessionError(error, source, agentKey);
    throw error;
  }

  if (!response.ok) {
    const code = classifyElevenLabsProviderStatus(response.status);
    const error = new ElevenLabsSignedSessionError(code, 503, {
      providerStatus: response.status,
      fingerprint: credential.fingerprint,
      fingerprintMatches: credential.fingerprintMatches,
    });
    if (logFailure) logElevenLabsSignedSessionError(error, source, agentKey);
    throw error;
  }

  const payload = await response.json().catch(() => null);
  const signedUrl = validSignedUrl(payload);
  if (!signedUrl) {
    const error = new ElevenLabsSignedSessionError(
      "invalid_upstream_response",
      503,
      {
        providerStatus: response.status,
        fingerprint: credential.fingerprint,
        fingerprintMatches: credential.fingerprintMatches,
      }
    );
    if (logFailure) logElevenLabsSignedSessionError(error, source, agentKey);
    throw error;
  }

  return signedUrl;
}

function normalizeLogAndThrow(
  error: unknown,
  source: string,
  agentKey: ElevenLabsVoiceAgentKey
): never {
  const normalized =
    error instanceof ElevenLabsCredentialError
      ? normalizeCredentialError(error)
      : error instanceof ElevenLabsSignedSessionError
        ? error
        : new ElevenLabsSignedSessionError("upstream_unavailable", 503);
  logElevenLabsSignedSessionError(normalized, source, agentKey);
  throw normalized;
}

function resolveCredentialAndAgent(
  agentKey: ElevenLabsVoiceAgentKey,
  source: string
): { credential: ElevenLabsRuntimeCredential; agentId: string } {
  try {
    return {
      credential: getElevenLabsRuntimeCredential(),
      agentId: resolveAgentId(agentKey),
    };
  } catch (error) {
    normalizeLogAndThrow(error, source, agentKey);
  }
}

export async function getElevenLabsSignedUrl(
  agentKey: ElevenLabsVoiceAgentKey,
  source = "signed-session"
): Promise<string> {
  const { credential, agentId } = resolveCredentialAndAgent(agentKey, source);
  return requestSignedUrl(agentKey, agentId, credential, source);
}

/** Request and discard signed URLs, returning only safe provider evidence. */
export async function probeElevenLabsVoiceAgents(
  agentKeys: readonly ElevenLabsVoiceAgentKey[] = ELEVENLABS_VOICE_AGENT_KEYS,
  source = "voice-probe"
): Promise<{
  provider: "ok";
  fingerprint: string;
  fingerprintMatches: boolean;
  agents: readonly ElevenLabsVoiceAgentKey[];
}> {
  let credential: ElevenLabsRuntimeCredential;
  let resolved: { agentKey: ElevenLabsVoiceAgentKey; agentId: string }[];
  try {
    credential = getElevenLabsRuntimeCredential();
    resolved = agentKeys.map((agentKey) => ({
      agentKey,
      agentId: resolveAgentId(agentKey),
    }));
  } catch (error) {
    normalizeLogAndThrow(error, source, agentKeys[0] ?? "pelayo");
  }

  const outcomes = await Promise.allSettled(
    resolved.map(({ agentKey, agentId }) =>
      requestSignedUrl(agentKey, agentId, credential, source, false)
    )
  );
  const failedIndex = outcomes.findIndex(
    (outcome) => outcome.status === "rejected"
  );
  if (failedIndex >= 0) {
    const failed = outcomes[failedIndex] as PromiseRejectedResult;
    normalizeLogAndThrow(
      failed.reason,
      source,
      resolved[failedIndex].agentKey
    );
  }

  return {
    provider: "ok",
    fingerprint: credential.fingerprint,
    fingerprintMatches: credential.fingerprintMatches,
    agents: [...agentKeys],
  };
}
