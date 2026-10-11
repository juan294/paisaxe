// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyVercelCron, verifyWebhookSecret } from "../../src/lib/cron-auth";
import { findMigrationProblems, parseCronCurlExamples, cronFixtureRequest } from "./runbook-contracts";

const file = "docs/operations/fixture.md";
const fenced = (command: string) => `# Fixture\n\n\`\`\`bash\n${command}\n\`\`\`\n`;
const post = 'curl -X POST https://paisaxe.es/api/cron/fail-stale-bookings -H "x-webhook-secret: $WEBHOOK_SECRET"';
const get = 'curl https://paisaxe.es/api/cron/fail-stale-bookings -H "Authorization: Bearer ${CRON_SECRET}"';
const accepted = (command: string) => {
  const [example] = parseCronCurlExamples(fenced(command), file);
  const request = cronFixtureRequest(example);
  return request.method === "GET" ? verifyVercelCron(new NextRequest(request)) : verifyWebhookSecret(new NextRequest(request));
};

describe("runbook migration contracts", () => {
  const files = new Set(["001_real.sql", "002_other.sql"]);
  it("accepts actual basenames in prose, paths and tables", () => {
    expect(findMigrationProblems("`001_real.sql` | supabase/migrations/002_other.sql", file, files)).toEqual([]);
  });
  it.each(["999_invented.sql", "001_wrong.sql"])("rejects invented or wrong basename %s with location", name => {
    expect(findMigrationProblems(`heading\n${name}`, file, files)).toEqual([`${file}:2: migration ${name} does not exist`]);
  });
  it("allows only an exact annotated historical basename with a reason", () => {
    expect(findMigrationProblems("999_retired.sql <!-- migration-history: 999_retired.sql: removed before consolidation -->", file, files)).toEqual([]);
    expect(findMigrationProblems("999_wrong.sql <!-- migration-history: 999_retired.sql: removed before consolidation -->", file, files)).toHaveLength(1);
    expect(findMigrationProblems("999_retired.sql <!-- migration-history: 999_retired.sql: -->", file, files)).not.toEqual([]);
  });
});

describe("fenced cron curl contracts exercise the real auth verifiers", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "docs-cron-fixture");
    vi.stubEnv("WEBHOOK_SECRET", "docs-webhook-fixture");
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([post, get])("accepts the documented method/header pair: %s", command => expect(accepted(command)).toBe(true));
  it.each([
    post.replace("POST", "GET"),
    get.replace("curl ", "curl -X POST "),
    post.replace("x-webhook-secret", "Authorization"),
    get.replace("Authorization", "x-webhook-secret"),
    post.replace("$WEBHOOK_SECRET", "$CRON_SECRET"),
  ])("rejects swapped verb/header/secret: %s", command => expect(accepted(command)).toBe(false));
  it("preserves physical line numbers and multiline quoted headers without expanding environment", () => {
    vi.stubEnv("WEBHOOK_SECRET", "never-expand-real-environment");
    const [example] = parseCronCurlExamples(fenced(post.replace(" -H", " \\\n  -H")), file);
    expect(example).toMatchObject({ file, line: 4, method: "POST", path: "/api/cron/fail-stale-bookings", headers: { "x-webhook-secret": "$WEBHOOK_SECRET" } });
    expect(cronFixtureRequest(example).headers.get("x-webhook-secret")).toBe("docs-webhook-fixture");
  });
  it.each(["$(touch /tmp/not-executed)", "`id`", "; echo unsafe", " | jq", " --data '{}'"])("rejects unsupported syntax safely and suggests a supported form: %s", suffix => {
    expect(() => parseCronCurlExamples(fenced(post + suffix), file)).toThrow(new RegExp(`${file}:4:.*Supported form:`));
  });
  it("rejects an unknown route placeholder instead of silently skipping it", () => {
    expect(() => parseCronCurlExamples(fenced(post.replace("fail-stale-bookings", "<route>")), file)).toThrow(/Supported form:/);
  });
  it("checks explicitly annotated unauthenticated rejection examples without executing curl output options", () => {
    const command = 'curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/cron/fail-stale-bookings"';
    const [example] = parseCronCurlExamples(fenced(command + "\n# Expected: 401"), file);
    expect(example).toMatchObject({ expectedAuth: false, method: "GET", path: "/api/cron/fail-stale-bookings" });
    expect(verifyVercelCron(new NextRequest(cronFixtureRequest(example)))).toBe(false);
    // Removing a credential from a success example cannot turn it into a passing rejection probe.
    expect(parseCronCurlExamples(fenced(command), file)[0].expectedAuth).toBe(true);
  });
  it("ignores non-cron examples and unfenced prose", () => {
    expect(parseCronCurlExamples(post + "\n" + fenced("curl https://paisaxe.es/api/health | jq"), file)).toEqual([]);
  });
});
