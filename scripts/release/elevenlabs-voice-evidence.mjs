export const EXPECTED_VOICE_AGENTS = [
  "pelayo",
  "booking",
  "penny",
  "iris",
  "xander",
];

export const ELEVENLABS_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{16}$/;
export const FULL_COMMIT_PATTERN = /^[0-9a-f]{40}$/i;

const HEALTH_FIELDS = new Set([
  "provider",
  "fingerprint",
  "fingerprint_matches",
  "agents",
  "deployment_commit",
]);
const EVIDENCE_FIELDS = new Set([
  "id",
  "status",
  "oracles",
  ...HEALTH_FIELDS,
  "custom_llm",
  "target_url",
  "response_url",
  "github_deployment_id",
  "checked_at",
]);

function unexpectedFields(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["voice evidence must be an object"];
  }
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `voice evidence contains unsafe or unexpected field "${key}"`);
}

function hasExactAgentCoverage(agents) {
  return (
    Array.isArray(agents) &&
    agents.length === EXPECTED_VOICE_AGENTS.length &&
    EXPECTED_VOICE_AGENTS.every((agent) => agents.includes(agent))
  );
}

export function validateElevenLabsVoiceHealth(body) {
  const errors = unexpectedFields(body, HEALTH_FIELDS);
  if (!body || typeof body !== "object") return errors;
  if (body.provider !== "ok") {
    errors.push(`voice provider state is ${body.provider ?? "missing"}, expected ok`);
  }
  if (!ELEVENLABS_FINGERPRINT_PATTERN.test(body.fingerprint ?? "")) {
    errors.push("voice credential fingerprint is missing or malformed");
  }
  if (body.fingerprint_matches !== true) {
    errors.push("voice credential fingerprint is not bound");
  }
  if (!hasExactAgentCoverage(body.agents)) {
    errors.push("voice preflight agent coverage is incomplete");
  }
  if (!FULL_COMMIT_PATTERN.test(body.deployment_commit ?? "")) {
    errors.push("voice deployment commit is missing or malformed");
  }
  return errors;
}

export function validateElevenLabsVoiceEvidence(value) {
  const errors = unexpectedFields(value, EVIDENCE_FIELDS);
  if (!value || typeof value !== "object") return errors;
  errors.push(...validateElevenLabsVoiceHealth({
    provider: value.provider,
    fingerprint: value.fingerprint,
    fingerprint_matches: value.fingerprint_matches,
    agents: value.agents,
    deployment_commit: value.deployment_commit,
  }));
  if (value.id !== "elevenlabs-voice-preflight") {
    errors.push("voice evidence id is invalid");
  }
  if (value.status !== "passed") {
    errors.push("voice evidence status must be passed");
  }
  if (!Array.isArray(value.oracles) || value.oracles.length !== 1 || value.oracles[0] !== "http") {
    errors.push("voice evidence oracles must be exactly [http]");
  }
  if (value.custom_llm !== "not_applicable") {
    errors.push("voice custom LLM must be not_applicable");
  }
  try {
    if (new URL(value.target_url).protocol !== "https:") {
      errors.push("voice target URL must use HTTPS");
    }
  } catch {
    errors.push("voice target URL is missing or invalid");
  }
  try {
    if (new URL(value.response_url).protocol !== "https:") {
      errors.push("voice response URL must use HTTPS");
    }
  } catch {
    errors.push("voice response URL is missing or invalid");
  }
  if (!/^[1-9][0-9]*$/.test(value.github_deployment_id ?? "")) {
    errors.push("voice GitHub deployment id is missing or invalid");
  }
  if (!value.checked_at || Number.isNaN(new Date(value.checked_at).getTime())) {
    errors.push("voice check timestamp is missing or invalid");
  }
  return errors;
}
