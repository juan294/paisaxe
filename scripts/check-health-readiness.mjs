#!/usr/bin/env node

const HEALTH_PATH = "/api/health";
const TIMEOUT_MS = 45_000;

function usage() {
  return [
    "Usage: node scripts/check-health-readiness.mjs <base-url> [--require-sentry]",
    "",
    "Checks <base-url>/api/health and fails unless:",
    "- HTTP status is 200",
    '- JSON body has status: "healthy"',
    '- sentry.status is "configured" when --require-sentry is set',
  ].join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const requireSentry = args.includes("--require-sentry");
  const positional = args.filter((arg) => arg !== "--require-sentry");

  if (positional.length !== 1) {
    throw new Error(usage());
  }

  return {
    baseUrl: positional[0],
    requireSentry,
  };
}

function healthUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.pathname = HEALTH_PATH;
  url.search = "";
  url.hash = "";
  return url;
}

function requestHeaders() {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return bypassSecret
    ? { "x-vercel-protection-bypass": bypassSecret }
    : {};
}

async function readJson(response) {
  const bodyText = await response.text();
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`Health check failed: invalid JSON response: ${bodyText}`);
  }
}

async function main() {
  const { baseUrl, requireSentry } = parseArgs(process.argv);
  const url = healthUrl(baseUrl);

  const response = await fetch(url, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(`Health check failed: HTTP ${response.status}\n${JSON.stringify(body)}`);
  }

  if (body.status !== "healthy") {
    throw new Error(
      `Health check failed: status=${JSON.stringify(body.status)} (expected "healthy")\n${JSON.stringify(body)}`
    );
  }

  const sentryStatus = body.sentry?.status ?? "";
  if (requireSentry && sentryStatus !== "configured") {
    throw new Error(
      `Health check failed: sentry.status=${JSON.stringify(sentryStatus)} (expected "configured")\n${JSON.stringify(body)}`
    );
  }

  console.log(`Health readiness passed: ${url}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
