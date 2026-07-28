import "server-only";
import {
  ELEVENLABS_AGENT_IDS,
  type ElevenLabsAgentKey,
} from "@/config/elevenlabs-agents";

const VISITOR_AGENT_KEYS = new Set<ElevenLabsAgentKey>(["pelayo"]);
const ADMIN_AGENT_KEYS = new Set<ElevenLabsAgentKey>([
  "penny",
  "iris",
  "xander",
]);

export type ElevenLabsSignedSessionErrorCode =
  | "missing_api_key"
  | "upstream_authentication_failed"
  | "upstream_rate_limited"
  | "upstream_unavailable"
  | "invalid_upstream_response";

export class ElevenLabsSignedSessionError extends Error {
  constructor(
    public readonly code: ElevenLabsSignedSessionErrorCode,
    public readonly status: number
  ) {
    super(code);
    this.name = "ElevenLabsSignedSessionError";
  }
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

/**
 * Mint a short-lived ElevenLabs WebSocket URL on the server.
 *
 * The caller must authorize the product-level agent key before invoking this
 * function. The API key is sent only in the provider request header.
 */
export async function getElevenLabsSignedUrl(
  agentKey: ElevenLabsAgentKey
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new ElevenLabsSignedSessionError("missing_api_key", 503);
  }

  const url = new URL(
    "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
  );
  url.searchParams.set("agent_id", ELEVENLABS_AGENT_IDS[agentKey]);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ElevenLabsSignedSessionError("upstream_unavailable", 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ElevenLabsSignedSessionError(
        "upstream_authentication_failed",
        502
      );
    }
    if (response.status === 429) {
      throw new ElevenLabsSignedSessionError("upstream_rate_limited", 503);
    }
    throw new ElevenLabsSignedSessionError("upstream_unavailable", 502);
  }

  const payload = (await response.json().catch(() => null)) as {
    signed_url?: unknown;
  } | null;
  if (
    !payload ||
    typeof payload.signed_url !== "string" ||
    !payload.signed_url.startsWith("wss://")
  ) {
    throw new ElevenLabsSignedSessionError("invalid_upstream_response", 502);
  }

  return payload.signed_url;
}
