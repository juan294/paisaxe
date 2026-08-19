import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const ROOT = process.cwd();
const ENV_EXAMPLE = join(ROOT, ".env.example");
const INVENTORY_DOC = join(ROOT, "docs/operations/secret-inventory.md");

// Credential-shaped: ends in one of these suffixes. NEXT_PUBLIC_* vars are
// client-exposed by design and are never treated as secrets regardless of name.
const CREDENTIAL_SUFFIX = /(_KEY|_SECRET|_TOKEN|_PASSWORD)$/;

// Secrets that exist only in an external store (e.g. a GitHub Actions
// repository secret) and are never read via `process.env` in src/ or
// scripts/, so they cannot appear in .env.example. Documented in the
// inventory anyway for completeness; exempted from the "stale" check.
export const EXTERNAL_ONLY_ALLOWLIST = ["VERCEL_TOKEN"];

/**
 * Extract credential-shaped env var names from .env.example content —
 * both active (`KEY=value`) and commented-optional (`# KEY=value`) lines.
 * Mirrors the key-extraction approach in check-env.ts.
 */
export function extractCredentialKeysFromEnvExample(content: string): Set<string> {
  const keys = new Set<string>();
  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    let key: string | undefined;

    if (!trimmed.startsWith("#") && trimmed.includes("=")) {
      key = trimmed.split("=")[0].trim();
    } else if (trimmed.startsWith("# ") && trimmed.includes("=")) {
      const rest = trimmed.slice(2).trim();
      if (/^[A-Z][A-Z0-9_]*=/.test(rest)) {
        key = rest.split("=")[0].trim();
      }
    }

    if (
      key &&
      CREDENTIAL_SUFFIX.test(key) &&
      !key.startsWith("NEXT_PUBLIC_")
    ) {
      keys.add(key);
    }
  }
  return keys;
}

/**
 * Extract backticked ALL_CAPS env var names from the inventory doc's table
 * rows. Only matches within table rows (lines starting with `|`) to avoid
 * picking up unrelated backticked file paths in prose.
 */
export function extractDocumentedSecrets(content: string): Set<string> {
  const keys = new Set<string>();
  const varPattern = /`([A-Z][A-Z0-9_]*)`/g;
  for (const rawLine of content.split("\n")) {
    if (!rawLine.trim().startsWith("|")) continue;
    let match;
    varPattern.lastIndex = 0;
    while ((match = varPattern.exec(rawLine)) !== null) {
      keys.add(match[1]);
    }
  }
  return keys;
}

export function diffSecretInventory({
  envExampleContent,
  inventoryContent,
  externalOnlyAllowlist = EXTERNAL_ONLY_ALLOWLIST,
}: {
  envExampleContent: string;
  inventoryContent: string;
  externalOnlyAllowlist?: string[];
}): { missingFromInventory: string[]; staleInInventory: string[] } {
  const credentialKeys = extractCredentialKeysFromEnvExample(envExampleContent);
  const documentedKeys = extractDocumentedSecrets(inventoryContent);
  const allowlist = new Set(externalOnlyAllowlist);

  const missingFromInventory = [...credentialKeys]
    .filter((key) => !documentedKeys.has(key))
    .sort();

  const staleInInventory = [...documentedKeys]
    .filter((key) => !credentialKeys.has(key) && !allowlist.has(key))
    .sort();

  return { missingFromInventory, staleInInventory };
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envExampleContent = readFileSync(ENV_EXAMPLE, "utf-8");
  const inventoryContent = readFileSync(INVENTORY_DOC, "utf-8");
  const { missingFromInventory, staleInInventory } = diffSecretInventory({
    envExampleContent,
    inventoryContent,
  });

  if (missingFromInventory.length === 0 && staleInInventory.length === 0) {
    console.log(
      "✓ docs/operations/secret-inventory.md matches the credential-shaped vars in .env.example"
    );
    process.exit(0);
  }

  if (missingFromInventory.length > 0) {
    console.error(
      `✗ ${missingFromInventory.length} credential-shaped env var(s) in .env.example missing from docs/operations/secret-inventory.md:\n`
    );
    for (const key of missingFromInventory) console.error(`  ${key}`);
  }

  if (staleInInventory.length > 0) {
    console.error(
      `\n✗ ${staleInInventory.length} secret(s) documented in docs/operations/secret-inventory.md no longer found in .env.example:\n`
    );
    for (const key of staleInInventory) console.error(`  ${key}`);
    console.error(
      "\n  If this secret is genuinely external-only (e.g. a GitHub Actions repo secret\n" +
        "  never read via process.env), add it to EXTERNAL_ONLY_ALLOWLIST in\n" +
        "  scripts/check-secret-inventory.ts instead of removing this check."
    );
  }

  process.exit(1);
}
/* c8 ignore stop */
