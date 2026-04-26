import { readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

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
}

function parseMigrations(): MigrationFile[] {
  const entries = readdirSync(MIGRATIONS_DIR).sort();
  const migrations: MigrationFile[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    const match = MIGRATION_PATTERN.exec(entry);
    if (!match) {
      errors.push(`  Invalid filename format: ${entry} (expected NNN_description.sql)`);
      continue;
    }
    const number = parseInt(match[1], 10);
    migrations.push({ number, name: entry });
  }

  if (errors.length > 0) {
    console.error("✗ Migration filename errors:\n");
    for (const err of errors) console.error(err);
    process.exit(1);
  }

  return migrations;
}

function checkForDuplicates(migrations: MigrationFile[]): void {
  const seen = new Map<number, string[]>();
  for (const { number, name } of migrations) {
    if (!seen.has(number)) seen.set(number, []);
    seen.get(number)!.push(name);
  }

  const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);
  if (duplicates.length > 0) {
    console.error("✗ Duplicate migration numbers found:\n");
    for (const [num, files] of duplicates) {
      console.error(`  ${num}: ${files.join(", ")}`);
    }
    process.exit(1);
  }
}

function checkForUnexpectedGaps(migrations: MigrationFile[]): void {
  if (migrations.length === 0) return;

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

  if (unexpectedGaps.length > 0) {
    console.error("✗ Unexpected gaps in migration sequence:\n");
    for (const gap of unexpectedGaps) {
      console.error(`  Missing: ${String(gap).padStart(3, "0")} (not in KNOWN_GAPS)`);
    }
    console.error(
      "\nIf this gap is intentional, add the number to KNOWN_GAPS in scripts/check-migrations.ts with a comment explaining why."
    );
    process.exit(1);
  }
}

const migrations = parseMigrations();
checkForDuplicates(migrations);
checkForUnexpectedGaps(migrations);

console.log(
  `✓ ${migrations.length} migration files validated (sequential, no duplicates, no unexpected gaps)`
);
