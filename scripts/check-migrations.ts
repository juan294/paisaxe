import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const DEFAULT_ROOT = process.cwd();

// Known intentional gaps in the migration sequence.
// These are migrations that were deliberately skipped (e.g., applied via a different path,
// removed before being committed, or reserved). Gaps here do not indicate an error.
// If you add a gap, document why.
const KNOWN_GAPS = new Set([
  5,  // 005 was never committed — schema at that point was managed via the Supabase dashboard
  23, // 023 was never committed — applied out-of-band during early development
  24, // 024 was never committed — applied out-of-band during early development
]);

// The largest gap between two consecutive migration numbers we consider plausible.
// The project's real historical gaps (see KNOWN_GAPS) are all a single missing number,
// so this is a very generous margin. It exists to fail fast on a malformed filename —
// e.g. a timestamp prefix like 20260818120000_revert_x.sql (~2e13) instead of the
// documented sequential NNN prefix (docs/operations/migration-policy.md) — without
// foreclosing on any future numbering scheme. Bounding the GAP SIZE between
// consecutive present numbers (rather than an absolute ceiling on the migration
// number itself) means this doesn't care about the numbering scheme's magnitude:
// consistently-close timestamp prefixes would still pass; a single wildly-out-of-range
// outlier fails immediately instead of forcing a scan across trillions of integers.
const MAX_PLAUSIBLE_GAP = 1000;

// Migration file must match NNN_description.sql (1+ digit prefix, underscore, description, .sql)
const MIGRATION_PATTERN = /^(\d+)_[a-z0-9_]+\.sql$/;

interface MigrationFile {
  number: number;
  name: string;
  path: string;
}

interface MigrationValidationOptions {
  root?: string;
  migrationsDir?: string;
}

export interface MigrationValidationResult {
  migrationCount: number;
  errors: string[];
}

const SENSITIVE_SERVICE_ROLE_TABLES = [
  "booking_sms_jobs",
  "elevenlabs_webhook_events",
  "translate_webhook_events",
  "stripe_webhook_events",
];

const TRANSLATION_SECURITY_DEFINER_FUNCTIONS = [
  "trigger_translation_webhook",
  "fail_stale_story_translations",
  "fail_stale_story_translations_locked",
];

const COMPLETE_BOOKING_SMS_JOB_SIGNATURE_ERROR =
  "Internal function revokes must target public.complete_booking_sms_job(text, text, text), not the dropped two-argument signature";

function parseMigrations(migrationsDir: string): {
  migrations: MigrationFile[];
  errors: string[];
} {
  const entries = readdirSync(migrationsDir).sort();
  const migrations: MigrationFile[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    const match = MIGRATION_PATTERN.exec(entry);
    if (!match) {
      errors.push(`  Invalid filename format: ${entry} (expected NNN_description.sql)`);
      continue;
    }
    const number = parseInt(match[1], 10);
    migrations.push({ number, name: entry, path: join(migrationsDir, entry) });
  }

  return { migrations, errors };
}

function checkForDuplicates(migrations: MigrationFile[]): string[] {
  const seen = new Map<number, string[]>();
  for (const { number, name } of migrations) {
    if (!seen.has(number)) seen.set(number, []);
    seen.get(number)!.push(name);
  }

  const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);
  return duplicates.map(([num, files]) => `Duplicate migration number ${num}: ${files.join(", ")}`);
}

function checkForUnexpectedGaps(migrations: MigrationFile[]): string[] {
  if (migrations.length === 0) return [];

  // Walk the sorted numbers pairwise instead of iterating the full integer range
  // from min to max. This is behaviorally identical for legitimate input (every
  // integer strictly between two consecutive present numbers is exactly the set
  // of "missing" numbers — duplicates naturally produce a non-positive gapSize
  // below and are skipped, since checkForDuplicates already reports them), but
  // bounds each individual gap independently — so a single pathological outlier
  // (e.g. a timestamp-prefixed filename parsed as ~2e13) fails fast with a clear
  // error instead of forcing the scanner to iterate — and potentially crash on —
  // an astronomical range.
  const numbers = migrations.map((m) => m.number).sort((a, b) => a - b);
  const errors: string[] = [];

  for (let i = 1; i < numbers.length; i++) {
    const prev = numbers[i - 1];
    const curr = numbers[i];
    const gapSize = curr - prev - 1;

    if (gapSize <= 0) continue;

    if (gapSize > MAX_PLAUSIBLE_GAP) {
      errors.push(
        `Migration number ${curr} is implausibly large: it creates a gap of ${gapSize} after ` +
          `${prev}, far beyond the ${MAX_PLAUSIBLE_GAP}-gap sanity margin. Migration filenames ` +
          `must use a sequential NNN prefix (see docs/operations/migration-policy.md), not a ` +
          `timestamp — refusing to scan this gap rather than iterating it.`
      );
      continue;
    }

    for (let missing = prev + 1; missing < curr; missing++) {
      if (!KNOWN_GAPS.has(missing)) {
        errors.push(
          `Unexpected migration gap: missing ${String(missing).padStart(3, "0")} (not in KNOWN_GAPS)`
        );
      }
    }
  }

  return errors;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hasPattern(sql: string, pattern: RegExp): boolean {
  return pattern.test(sql);
}

function checkSensitiveTablePosture(sql: string): string[] {
  const errors: string[] = [];

  for (const table of SENSITIVE_SERVICE_ROLE_TABLES) {
    const escapedTable = escapeRegExp(table);
    const qualifiedTable = `(?:public\\.)?${escapedTable}`;
    const tableWasCreated = hasPattern(
      sql,
      new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+${qualifiedTable}\\b`)
    );

    if (!tableWasCreated) continue;

    if (
      !hasPattern(
        sql,
        new RegExp(`alter\\s+table\\s+${qualifiedTable}\\s+enable\\s+row\\s+level\\s+security\\b`)
      )
    ) {
      errors.push(`Sensitive table public.${table} must enable RLS`);
    }

    for (const role of ["anon", "authenticated"]) {
      if (
        !hasPattern(
          sql,
          new RegExp(
            `revoke\\s+(?:all(?:\\s+privileges)?|select)\\s+on(?:\\s+table)?\\s+${qualifiedTable}\\s+from\\s+${role}\\b`
          )
        )
      ) {
        errors.push(`Sensitive table public.${table} must revoke privileges from ${role}`);
      }
    }

    if (
      !hasPattern(
        sql,
        new RegExp(
          `grant\\s+all(?:\\s+privileges)?\\s+on(?:\\s+table)?\\s+${qualifiedTable}\\s+to\\s+service_role\\b`
        )
      )
    ) {
      errors.push(`Sensitive table public.${table} must grant service_role access explicitly`);
    }

    if (
      !hasPattern(
        sql,
        new RegExp(
          `create\\s+policy\\s+[^;]+\\s+on\\s+${qualifiedTable}\\s+[^;]*\\bto\\s+service_role\\b`
        )
      )
    ) {
      errors.push(`Sensitive table public.${table} must define a service_role RLS policy`);
    }
  }

  return errors;
}

function checkMarketingCredentialShape(sql: string): string[] {
  const marketingAccountsCreated = hasPattern(
    sql,
    /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.marketing_accounts\b/
  );

  if (!marketingAccountsCreated) return [];

  const hasEncryptedShapeConstraint =
    sql.includes("marketing_accounts_credentials_encrypted_shape") &&
    sql.includes("credentials ? 'encrypted'") &&
    sql.includes("not (credentials ? 'accesstoken'") &&
    sql.includes("not (credentials ? 'refreshtoken'");

  if (hasEncryptedShapeConstraint) return [];

  return [
    "marketing_accounts.credentials must have an encrypted-shape CHECK constraint",
  ];
}

function getFunctionHeader(sql: string, functionName: string): string | null {
  const match = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${escapeRegExp(functionName)}\\s*\\(`
  ).exec(sql);

  if (!match) return null;

  const headerEnd = sql.indexOf(" as $$", match.index);
  return headerEnd === -1 ? sql.slice(match.index) : sql.slice(match.index, headerEnd);
}

function checkTranslationFunctionSearchPaths(migrations: MigrationFile[]): string[] {
  const errors: string[] = [];
  const latestHeaders = new Map<string, string>();

  for (const migration of migrations) {
    const sql = normalizeSql(readFileSync(migration.path, "utf8"));

    for (const functionName of TRANSLATION_SECURITY_DEFINER_FUNCTIONS) {
      const header = getFunctionHeader(sql, functionName);
      if (!header) continue;

      latestHeaders.set(functionName, header);
    }
  }

  for (const [functionName, header] of latestHeaders) {
    if (!header.includes("security definer")) continue;

    if (!header.includes("set search_path = ''")) {
      errors.push(
        `SECURITY DEFINER translation function public.${functionName} must use SET search_path = ''`
      );
    }
  }

  return errors;
}

function checkCompleteBookingSmsJobSignatureReferences(migrations: MigrationFile[]): string[] {
  const badTwoArgGrantOrRevokePattern =
    /\b(?:revoke|grant)\b[^;]*\bon\s+function\s+public\.complete_booking_sms_job\s*\(\s*(?:p_event_key\s+)?text\s*,\s*(?:p_provider_sid\s+)?text\s*\)/;
  let threeArgReplacementExists = false;

  for (const migration of migrations) {
    const sql = normalizeSql(readFileSync(migration.path, "utf8"));

    if (
      sql.includes("create or replace function public.complete_booking_sms_job") &&
      sql.includes("p_outcome_message text")
    ) {
      threeArgReplacementExists = true;
    }

    if (threeArgReplacementExists && badTwoArgGrantOrRevokePattern.test(sql)) {
      return [COMPLETE_BOOKING_SMS_JOB_SIGNATURE_ERROR];
    }
  }

  return [];
}

export function validateMigrations(
  options: MigrationValidationOptions = {}
): MigrationValidationResult {
  const root = options.root ?? DEFAULT_ROOT;
  const migrationsDir = options.migrationsDir ?? join(root, "supabase", "migrations");
  const { migrations, errors } = parseMigrations(migrationsDir);
  const migrationSql = normalizeSql(
    migrations.map((migration) => readFileSync(migration.path, "utf8")).join("\n")
  );

  errors.push(...checkForDuplicates(migrations));
  errors.push(...checkForUnexpectedGaps(migrations));
  errors.push(...checkSensitiveTablePosture(migrationSql));
  errors.push(...checkMarketingCredentialShape(migrationSql));
  errors.push(...checkTranslationFunctionSearchPaths(migrations));
  errors.push(...checkCompleteBookingSmsJobSignatureReferences(migrations));

  return {
    migrationCount: migrations.length,
    errors,
  };
}

function runCli(): void {
  const result = validateMigrations();

  if (result.errors.length > 0) {
    console.error("✗ Migration validation errors:\n");
    for (const error of result.errors) {
      console.error(`  ${error}`);
    }
    console.error(
      "\nIf a sequence gap is intentional, add it to KNOWN_GAPS in scripts/check-migrations.ts with a comment explaining why."
    );
    process.exit(1);
  }

  console.log(
    `✓ ${result.migrationCount} migration files validated (sequence, security posture, credential checks)`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
