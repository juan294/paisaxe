import * as fs from "fs";
import * as path from "path";

/**
 * Recursively collect files under `dir` whose name matches `predicate`.
 *
 * Shared by meta-tests that scan the source tree for structural invariants
 * (see src/lib/logger-migration.test.ts, src/lib/meta-invariants.test.ts) so
 * the directory-walk logic exists in exactly one place.
 */
export function collectFiles(
  dir: string,
  predicate: (name: string) => boolean
): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(full, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      result.push(full);
    }
  }
  return result;
}
