// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

const loader = fileURLToPath(import.meta.resolve("tsx"));
const script = fileURLToPath(new URL("./check-env.ts", import.meta.url));

it("imports both CLI consumers and the pure parser silently without a project tree", () => {
  const root = mkdtempSync(join(tmpdir(), "paisaxe-env-import-"));
  try {
    const modules = [script, fileURLToPath(new URL("./check-secret-inventory.ts", import.meta.url)), fileURLToPath(new URL("./lib/env-example.ts", import.meta.url))];
    const code = modules.map(path => `await import(${JSON.stringify(pathToFileURL(path).href)});`).join("\n") + '\nprocess.stdout.write("imports-completed");';
    const result = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", code], { cwd: root, encoding: "utf8", timeout: 15_000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("imports-completed");
    expect(result.stderr).toBe("");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it("runs the real env CLI: documented 0, missing key 1 with location, corrected 0", () => {
  const root = mkdtempSync(join(tmpdir(), "paisaxe-env-cli-"));
  try {
    mkdirSync(join(root, "src/nested"), { recursive: true });
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "src/nested/consumer.ts"), "process.env.ACTIVE_KEY; process.env['OPTIONAL_KEY']; process.env.NODE_ENV;");
    writeFileSync(join(root, "src/ignored.test.ts"), "process.env.IGNORED_TEST_KEY;");
    writeFileSync(join(root, "scripts/consumer.tsx"), 'process.env["SCRIPT_KEY"];');
    const example = " ACTIVE_KEY = $VALUE=a=b\r\n# OPTIONAL_KEY =\r\nSCRIPT_KEY=\r\n";
    writeFileSync(join(root, ".env.example"), example);
    const run = () => spawnSync(process.execPath, ["--import", loader, script], { cwd: root, encoding: "utf8", timeout: 15_000 });
    const documented = run();
    expect(documented.status, documented.stderr).toBe(0);
    expect(documented.stdout).toContain("All process.env vars");
    writeFileSync(join(root, "src/nested/consumer.ts"), "process.env.ACTIVE_KEY; process.env.MISSING_KEY;");
    const missing = run();
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("MISSING_KEY");
    expect(missing.stderr).toContain("src/nested/consumer.ts");
    writeFileSync(join(root, ".env.example"), example + "# MISSING_KEY=\n");
    const corrected = run();
    expect(corrected.status, corrected.stderr).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it("reports the exact missing example path and succeeds after it is restored", () => {
  const root = mkdtempSync(join(tmpdir(), "paisaxe-env-missing-file-"));
  try {
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "src/consumer.ts"), "process.env.REQUIRED_KEY;");
    const examplePath = join(root, ".env.example");
    const run = () => spawnSync(process.execPath, ["--import", loader, script], { cwd: root, encoding: "utf8", timeout: 15_000 });
    const missing = run();
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("ENOENT");
    expect(missing.stderr).toContain(examplePath);
    writeFileSync(examplePath, "REQUIRED_KEY=\n");
    const corrected = run();
    expect(corrected.status, corrected.stderr).toBe(0);
    expect(corrected.stdout).toContain("All process.env vars");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
