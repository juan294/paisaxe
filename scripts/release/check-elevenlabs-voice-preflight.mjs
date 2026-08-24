#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  EXPECTED_VOICE_AGENTS,
  FULL_COMMIT_PATTERN,
  validateElevenLabsVoiceHealth,
} from "./elevenlabs-voice-evidence.mjs";

export { EXPECTED_VOICE_AGENTS };
const FETCH_TIMEOUT_MS = 45_000;

function required(value, name) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function normalizedTarget(baseUrl) {
  const target = new URL(required(baseUrl, "RELEASE_TARGET_URL"));
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(
    target.hostname
  );
  if (target.protocol !== "https:" && !(target.protocol === "http:" && loopback)) {
    throw new Error(
      "RELEASE_TARGET_URL must use HTTPS (HTTP is allowed only for loopback tests)"
    );
  }
  target.pathname = "/";
  target.search = "";
  target.hash = "";
  return target;
}

export async function checkElevenLabsVoicePreflight({
  baseUrl = process.env.RELEASE_TARGET_URL,
  healthProbeSecret = process.env.HEALTH_PROBE_SECRET,
  bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  expectedDeploymentCommit = process.env.RELEASE_CANDIDATE_COMMIT,
  githubDeploymentId = process.env.RELEASE_GITHUB_DEPLOYMENT_ID,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  const target = normalizedTarget(baseUrl);
  const probeSecret = required(healthProbeSecret, "HEALTH_PROBE_SECRET");
  const expectedCommit = required(
    expectedDeploymentCommit,
    "RELEASE_CANDIDATE_COMMIT"
  );
  if (!FULL_COMMIT_PATTERN.test(expectedCommit)) {
    throw new Error("RELEASE_CANDIDATE_COMMIT must be a full commit hash");
  }
  const boundDeploymentId = required(
    githubDeploymentId,
    "RELEASE_GITHUB_DEPLOYMENT_ID"
  );
  if (!/^[1-9][0-9]*$/.test(boundDeploymentId)) {
    throw new Error("RELEASE_GITHUB_DEPLOYMENT_ID must be numeric");
  }
  const headers = {
    authorization: `Bearer ${probeSecret}`,
    "cache-control": "no-cache",
    ...(bypassSecret?.trim()
      ? { "x-vercel-protection-bypass": bypassSecret.trim() }
      : {}),
  };

  const url = new URL("/api/health/voice", target).toString();
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error?.name;
    throw new Error(
      name === "AbortError" || name === "TimeoutError"
        ? "voice preflight request timed out"
        : "voice preflight request failed"
    );
  }
  if (response.url && response.url !== url) {
    throw new Error("voice preflight response escaped the candidate URL");
  }
  const raw = await response.text();

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(
      `voice preflight returned a non-JSON response (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(`voice preflight failed with status ${response.status}`);
  }
  const validationErrors = validateElevenLabsVoiceHealth(body);
  if (validationErrors.length > 0) throw new Error(validationErrors[0]);
  if (body?.deployment_commit !== expectedCommit) {
    throw new Error("voice preflight deployment commit does not match candidate");
  }

  return {
    provider: "ok",
    fingerprint: body.fingerprint,
    fingerprint_matches: true,
    agents: EXPECTED_VOICE_AGENTS,
    custom_llm: "not_applicable",
    target_url: target.origin,
    response_url: url,
    github_deployment_id: boundDeploymentId,
    deployment_commit: expectedCommit,
    checked_at: now().toISOString(),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkElevenLabsVoicePreflight()
    .then((evidence) => {
      console.log(JSON.stringify(evidence));
    })
    .catch((error) => {
      console.error(`[elevenlabs-voice-preflight] FAIL ${error.message}`);
      process.exitCode = 1;
    });
}
