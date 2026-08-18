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

  const numbers = migrations.map((m) => m.number).sort((a, b) => a - b);
  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  const present = new Set(numbers);

  const unexpectedGaps: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!present.has(i) && !KNOWN_GAPS.has(i)) {
      unexpectedGaps.push(i);
    }
  }

  return unexpectedGaps.map(
    (gap) => `Unexpected migration gap: missing ${String(gap).padStart(3, "0")} (not in KNOWN_GAPS)`
  );
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

// Shared by checkSensitiveTablePosture (per-table regex) and
// checkPublicTableRlsPosture (generic table-name-capturing regex) so the two
// REVOKE grammars stay in sync.
const REVOKE_PREFIX_SOURCE = "revoke\\s+(?:all(?:\\s+privileges)?|select)\\s+on(?:\\s+table)?\\s+";

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
          new RegExp(`${REVOKE_PREFIX_SOURCE}${qualifiedTable}\\s+from\\s+${role}\\b`)
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

interface PublicTableRlsTracker {
  exists: boolean;
  rlsEnabled: boolean;
  revokedRoles: Set<string>;
}

type TableEvent =
  | { index: number; kind: "create"; name: string }
  | { index: number; kind: "drop"; name: string }
  | { index: number; kind: "rename"; from: string; to: string }
  | { index: number; kind: "rls"; name: string; enabled: boolean }
  | { index: number; kind: "revoke"; name: string; roles: string[] };

const CREATE_TABLE_RE = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/g;
const DROP_TABLE_RE = /drop\s+table(?:\s+if\s+exists)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/g;
const RENAME_TABLE_RE =
  /alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+rename\s+to\s+(?:public\.)?([a-z_][a-z0-9_]*)/g;
const RLS_TOGGLE_RE =
  /alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+(enable|disable)\s+row\s+level\s+security/g;
const REVOKE_ROLES_RE = new RegExp(
  `${REVOKE_PREFIX_SOURCE}(?:public\\.)?([a-z_][a-z0-9_]*)\\s+from\\s+([^;]+);`,
  "g"
);

// Walks the concatenated migration SQL once, collecting every table lifecycle
// event (create/drop/rename/RLS toggle/revoke) tagged with its position, then
// replays them in true chronological order. This keeps a renamed table's
// history attached across the rename, unlike processing each event type as a
// separate full pass.
function collectTableEvents(sql: string): TableEvent[] {
  const events: TableEvent[] = [];

  for (const match of sql.matchAll(CREATE_TABLE_RE)) {
    events.push({ index: match.index ?? 0, kind: "create", name: match[1] });
  }
  for (const match of sql.matchAll(DROP_TABLE_RE)) {
    events.push({ index: match.index ?? 0, kind: "drop", name: match[1] });
  }
  for (const match of sql.matchAll(RENAME_TABLE_RE)) {
    events.push({ index: match.index ?? 0, kind: "rename", from: match[1], to: match[2] });
  }
  for (const match of sql.matchAll(RLS_TOGGLE_RE)) {
    events.push({ index: match.index ?? 0, kind: "rls", name: match[1], enabled: match[2] === "enable" });
  }
  for (const match of sql.matchAll(REVOKE_ROLES_RE)) {
    events.push({
      index: match.index ?? 0,
      kind: "revoke",
      name: match[1],
      roles: match[2].split(",").map((role) => role.trim()),
    });
  }

  return events.sort((a, b) => a.index - b.index);
}

// Tables whose RLS is deliberately disabled must document the exception with an
// explicit REVOKE from both anon and authenticated (see migration 076's
// admin_audit_log pattern) -- this is the only tolerated alternative to RLS.
function checkPublicTableRlsPosture(sql: string): string[] {
  const tables = new Map<string, PublicTableRlsTracker>();

  const getTracker = (name: string): PublicTableRlsTracker => {
    let tracker = tables.get(name);
    if (!tracker) {
      tracker = { exists: false, rlsEnabled: false, revokedRoles: new Set() };
      tables.set(name, tracker);
    }
    return tracker;
  };

  for (const event of collectTableEvents(sql)) {
    switch (event.kind) {
      case "create":
        getTracker(event.name).exists = true;
        break;
      case "drop": {
        const tracker = tables.get(event.name);
        if (tracker) tracker.exists = false;
        break;
      }
      case "rename": {
        const tracker = tables.get(event.from);
        if (tracker) {
          tables.delete(event.from);
          tables.set(event.to, tracker);
        }
        break;
      }
      case "rls": {
        const tracker = tables.get(event.name);
        if (tracker) tracker.rlsEnabled = event.enabled;
        break;
      }
      case "revoke": {
        const tracker = tables.get(event.name);
        if (!tracker) break;
        for (const role of event.roles) tracker.revokedRoles.add(role);
        break;
      }
    }
  }

  const errors: string[] = [];
  for (const [name, tracker] of tables) {
    if (!tracker.exists || tracker.rlsEnabled) continue;
    if (tracker.revokedRoles.has("anon") && tracker.revokedRoles.has("authenticated")) continue;

    errors.push(
      `Table public.${name} has no RLS enabled and no documented anon/authenticated revoke exception -- ` +
        "enable RLS or add explicit REVOKE ... FROM anon, authenticated with a comment explaining why"
    );
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
  errors.push(...checkPublicTableRlsPosture(migrationSql));
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
