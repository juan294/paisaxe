import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const SCRIPTS_DIR = join(ROOT, "scripts");
const ENV_EXAMPLE = join(ROOT, ".env.example");

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

function getEnvExampleKeys(): Set<string> {
  const lines = readFileSync(ENV_EXAMPLE, "utf-8").split("\n");
  const keys = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    // Active line: KEY=value
    if (!trimmed.startsWith("#") && trimmed.includes("=")) {
      const key = trimmed.split("=")[0].trim();
      if (key) keys.add(key);
    }
    // Optional/commented line: # KEY=value (no space before KEY)
    if (trimmed.startsWith("# ") && trimmed.includes("=")) {
      const rest = trimmed.slice(2).trim();
      if (rest.includes("=")) {
        const key = rest.split("=")[0].trim();
        // Only treat as a key if it looks like an env var (uppercase + underscores)
        if (/^[A-Z][A-Z0-9_]*$/.test(key)) keys.add(key);
      }
    }
  }
  return keys;
}

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

function getUsedEnvKeys(files: string[]): Map<string, string[]> {
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
        const relative = file.replace(ROOT + "/", "");
        if (!usage.has(key)) usage.set(key, []);
        usage.get(key)!.push(relative);
      }
    }
  }
  return usage;
}

const exampleKeys = getEnvExampleKeys();

// Scan both src/ and scripts/ for process.env usage.
// Exclude check-env.ts itself to avoid false positives from its own pattern strings.
const selfPath = join(SCRIPTS_DIR, "check-env.ts");
const srcFiles = walkTs(SRC_DIR);
const scriptFiles = walkTs(SCRIPTS_DIR, [selfPath]);
const allFiles = [...srcFiles, ...scriptFiles];

const usedKeys = getUsedEnvKeys(allFiles);

const missing = [...usedKeys.entries()].filter(
  ([key]) => !exampleKeys.has(key) && !PLATFORM_VARS.has(key)
);

if (missing.length === 0) {
  console.log("✓ All process.env vars in src/ and scripts/ are documented in .env.example");
  process.exit(0);
} else {
  console.error(`✗ ${missing.length} env var(s) used in src/ or scripts/ but missing from .env.example:\n`);
  for (const [key, files] of missing) {
    console.error(`  ${key}`);
    for (const f of [...new Set(files)].slice(0, 3)) {
      console.error(`    used in: ${f}`);
    }
  }
  process.exit(1);
}
