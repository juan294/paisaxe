import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const ENV_EXAMPLE = join(ROOT, ".env.example");

// Variables that are set by Node.js, Next.js, or the OS — not user-configured
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

function walkTs(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkTs(full));
    } else if ([".ts", ".tsx"].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function getUsedEnvKeys(files: string[]): Map<string, string[]> {
  const pattern = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  const usage = new Map<string, string[]>();
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1];
      const relative = file.replace(ROOT + "/", "");
      if (!usage.has(key)) usage.set(key, []);
      usage.get(key)!.push(relative);
    }
  }
  return usage;
}

const exampleKeys = getEnvExampleKeys();
const usedKeys = getUsedEnvKeys(walkTs(SRC_DIR));

const missing = [...usedKeys.entries()].filter(
  ([key]) => !exampleKeys.has(key) && !PLATFORM_VARS.has(key)
);

if (missing.length === 0) {
  console.log("✓ All process.env vars in src/ are documented in .env.example");
  process.exit(0);
} else {
  console.error(`✗ ${missing.length} env var(s) used in src/ but missing from .env.example:\n`);
  for (const [key, files] of missing) {
    console.error(`  ${key}`);
    for (const f of [...new Set(files)].slice(0, 3)) {
      console.error(`    used in: ${f}`);
    }
  }
  process.exit(1);
}
