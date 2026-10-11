// @vitest-environment node
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXTERNAL_ONLY_ALLOWLIST,
  diffSecretInventory,
  extractCredentialKeysFromEnvExample,
  extractDocumentedSecrets,
} from "./check-secret-inventory";

describe("extractCredentialKeysFromEnvExample", () => {
  it("shares optional whitespace syntax while filtering credentials only here", () => {
    expect([...extractCredentialKeysFromEnvExample([
      "# OPTIONAL_SECRET = $VALUE=a=b", "# SECOND_TOKEN=", "ACTIVE_PASSWORD=",
      "NEXT_PUBLIC_SERVICE_KEY=value", "# NEXT_PUBLIC_OPTIONAL_KEY =value",
      "PUBLIC_URL=value", "#lowercase_TOKEN=value", "# prose_KEY=value",
      "ACTIVE_PASSWORD=duplicate",
    ].join("\r\n"))]).toEqual(["OPTIONAL_SECRET", "SECOND_TOKEN", "ACTIVE_PASSWORD"]);
  });
  it("picks up active and commented credential-shaped keys", () => {
    const content = [
      "ANTHROPIC_API_KEY=sk-ant-xxxxx",
      "# SUPABASE_LOCAL_ANON_KEY=eyJxxxxx",
      "STRIPE_WEBHOOK_SECRET=whsec_xxxxx",
    ].join("\n");

    const keys = extractCredentialKeysFromEnvExample(content);

    expect(keys.has("ANTHROPIC_API_KEY")).toBe(true);
    expect(keys.has("SUPABASE_LOCAL_ANON_KEY")).toBe(true);
    expect(keys.has("STRIPE_WEBHOOK_SECRET")).toBe(true);
  });

  it("excludes NEXT_PUBLIC_* vars even if credential-shaped", () => {
    const content = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx";

    const keys = extractCredentialKeysFromEnvExample(content);

    expect(keys.has("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")).toBe(false);
  });

  it("excludes vars that don't look like credentials", () => {
    const content = [
      "GOOGLE_CLIENT_ID=your-google-client-id",
      "STRIPE_DAY_PASS_PRICE_ID=price_xxxxx",
      "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
      "ADMIN_EMAIL=admin@paisaxe.es",
    ].join("\n");

    const keys = extractCredentialKeysFromEnvExample(content);

    expect(keys.size).toBe(0);
  });
});

it("runs the real inventory CLI: matching 0, stale and missing 1, corrected 0", () => {
  const root = mkdtempSync(join(tmpdir(), "paisaxe-inventory-cli-"));
  try {
    mkdirSync(join(root, "docs/operations"), { recursive: true });
    writeFileSync(join(root, ".env.example"), "# SERVICE_SECRET = $OTHER==\r\nNEXT_PUBLIC_SERVICE_KEY=value\r\n");
    const path = join(root, "docs/operations/secret-inventory.md");
    writeFileSync(path, "| `SERVICE_SECRET` | fixture |\n| `VERCEL_TOKEN` | external |\n");
    const loader = fileURLToPath(import.meta.resolve("tsx"));
    const script = fileURLToPath(new URL("./check-secret-inventory.ts", import.meta.url));
    const run = () => spawnSync(process.execPath, ["--import", loader, script], { cwd: root, encoding: "utf8", timeout: 15_000 });
    const matching = run();
    expect(matching.status, matching.stderr).toBe(0);
    writeFileSync(path, "| `SERVICE_SECRET` | fixture |\n| `RETIRED_TOKEN` | stale |\n");
    const stale = run();
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("RETIRED_TOKEN");
    expect(stale.stderr).toContain("no longer found in .env.example");
    writeFileSync(path, "| `VERCEL_TOKEN` | external |\n");
    const missing = run();
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("SERVICE_SECRET");
    expect(missing.stderr).toContain("missing from docs/operations/secret-inventory.md");
    writeFileSync(path, "| `SERVICE_SECRET` | fixture |\n");
    const corrected = run();
    expect(corrected.status, corrected.stderr).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

describe("extractDocumentedSecrets", () => {
  it("reads backticked env var names from inventory table rows", () => {
    const content = [
      "| Secret | Purpose |",
      "|---|---|",
      "| `ANTHROPIC_API_KEY` | Claude API |",
      "| `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Admin client |",
    ].join("\n");

    const keys = extractDocumentedSecrets(content);

    expect(keys.has("ANTHROPIC_API_KEY")).toBe(true);
    expect(keys.has("SUPABASE_SERVICE_KEY")).toBe(true);
    expect(keys.has("SUPABASE_SERVICE_ROLE_KEY")).toBe(true);
  });

  it("ignores prose backticks outside the inventory table", () => {
    const content = "See `docs/operations/operations.md` for details.";

    const keys = extractDocumentedSecrets(content);

    expect(keys.size).toBe(0);
  });
});

describe("diffSecretInventory", () => {
  it("flags a credential-shaped env var missing from the inventory", () => {
    const envExampleContent = "NEW_SERVICE_API_KEY=xxxxx";
    const inventoryContent = "| `ANTHROPIC_API_KEY` | Claude API |";

    const result = diffSecretInventory({ envExampleContent, inventoryContent });

    expect(result.missingFromInventory).toContain("NEW_SERVICE_API_KEY");
  });

  it("flags a documented secret no longer present in .env.example", () => {
    const envExampleContent = "ANTHROPIC_API_KEY=sk-ant-xxxxx";
    const inventoryContent = "| `RETIRED_SERVICE_TOKEN` | No longer used |";

    const result = diffSecretInventory({ envExampleContent, inventoryContent });

    expect(result.staleInInventory).toContain("RETIRED_SERVICE_TOKEN");
  });

  it("does not flag entries on the external-only allowlist", () => {
    const envExampleContent = "ANTHROPIC_API_KEY=sk-ant-xxxxx";
    const inventoryContent = `| \`${EXTERNAL_ONLY_ALLOWLIST[0]}\` | CI only |`;

    const result = diffSecretInventory({ envExampleContent, inventoryContent });

    expect(result.staleInInventory).not.toContain(EXTERNAL_ONLY_ALLOWLIST[0]);
  });

  it("reports no drift when the inventory matches .env.example exactly", () => {
    const envExampleContent = "ANTHROPIC_API_KEY=sk-ant-xxxxx";
    const inventoryContent = "| `ANTHROPIC_API_KEY` | Claude API |";

    const result = diffSecretInventory({ envExampleContent, inventoryContent });

    expect(result.missingFromInventory).toEqual([]);
    expect(result.staleInInventory).toEqual([]);
  });
});
