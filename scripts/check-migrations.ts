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
