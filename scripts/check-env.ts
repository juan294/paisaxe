import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

import { parseEnvExampleKeys } from "./lib/env-example";
import { isMain } from "./lib/is-main";

// Variables that are set by Node.js, Next.js, the OS, or test runners — not user-configured
const PLATFORM_VARS = new Set([
  "NODE_ENV",
  "HOME",
  "PATH",
  "PWD",
  "NEXT_PHASE",
  "NEXT_RUNTIME",
  "VERCEL",
  "VERCEL_ENV",
  "CI",
  // Test runner flags (set automatically by Vitest/Jest — never in .env)
  "VITEST",
  // Script-specific runtime flags (set inline by calling code, not .env)
  "PLAYWRIGHT_PORT",
  "PLAYWRIGHT_REUSE_SERVER",
]);

function walkTs(dir: string, exclude?: string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkTs(full, exclude));
    } else if ([".ts", ".tsx"].includes(extname(entry)) && !entry.includes(".test.")) {
      if (!exclude?.includes(full)) {
        files.push(full);
      }
    }
  }
  return files;
}

function getUsedEnvKeys(files: string[], root: string): Map<string, string[]> {
  // Matches process.env.KEY and process.env["KEY"] / process.env['KEY']
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g,
  ];
  const usage = new Map<string, string[]>();
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[1];
        if (key === undefined) continue;
        const relative = file.replace(root + "/", "");
        const files = usage.get(key) ?? [];
        files.push(relative);
        usage.set(key, files);
      }
    }
  }
  return usage;
}

export function checkEnv(root = process.cwd()): number {
  const scriptsDir = join(root, "scripts");
  const exampleKeys = parseEnvExampleKeys(readFileSync(join(root, ".env.example"), "utf-8"));

  // Scan both src/ and scripts/ for process.env usage.
  // Exclude check-env.ts itself to avoid false positives from its own pattern strings.
  const selfPath = join(scriptsDir, "check-env.ts");
  const srcFiles = walkTs(join(root, "src"));
  const scriptFiles = walkTs(scriptsDir, [selfPath]);
  const allFiles = [...srcFiles, ...scriptFiles];

  const usedKeys = getUsedEnvKeys(allFiles, root);

  const missing = [...usedKeys.entries()].filter(
    ([key]) => !exampleKeys.has(key) && !PLATFORM_VARS.has(key)
  );

  if (missing.length === 0) {
    console.log("✓ All process.env vars in src/ and scripts/ are documented in .env.example");
    return 0;
  } else {
    console.error(`✗ ${missing.length} env var(s) used in src/ or scripts/ but missing from .env.example:\n`);
    for (const [key, files] of missing) {
      console.error(`  ${key}`);
      for (const f of [...new Set(files)].slice(0, 3)) {
        console.error(`    used in: ${f}`);
      }
    }
    return 1;
  }
}

if (isMain(import.meta.url)) process.exit(checkEnv());
