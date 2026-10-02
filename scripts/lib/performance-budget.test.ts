// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const helperPath = join(process.cwd(), "scripts/lib/performance-budget.sh");

// Source the helper and run a bash snippet; positional args follow as "$2"...
function bash(script: string, ...args: string[]) {
  return execFileAsync(
    "bash",
    ["-c", `source "$1"\n${script}`, "performance-budget-test", helperPath, ...args],
    { cwd: process.cwd() }
  );
}

async function checkLargestChunk(largestChunks: string, budgetKb = 650) {
  return bash('largest_chunk_budget_violation "$2" "$3"', largestChunks, String(budgetKb));
}

describe("largest_chunk_budget_violation", () => {
  it("allows a chunk exactly at the configured budget", async () => {
    await expect(
      checkLargestChunk(`${650 * 1024} .next/static/chunks/exact.js`)
    ).resolves.toMatchObject({ stdout: "" });
  });

  it("reports a chunk that exceeds the budget by one byte", async () => {
    await expect(
      checkLargestChunk(
        `${650 * 1024 + 1} .next/static/chunks/chunk with spaces.js\n1024 .next/static/chunks/small.js`
      )
    ).resolves.toMatchObject({
      stdout:
        "\\n- Largest chunk (651 KB) exceeds budget (650 KB)",
    });
  });

  it("fails closed when the largest chunk measurement is malformed", async () => {
    await expect(checkLargestChunk("not-a-size chunk.js")).rejects.toMatchObject({
      stderr: expect.stringContaining("Invalid largest chunk measurement"),
    });
  });
});

describe("largest_chunk_budget_violation with a content-based exemption", () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-budget-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function chunk(name: string, content: string) {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  }

  function check(largestChunks: string) {
    return bash('largest_chunk_budget_violation "$2" 650 livekit 800', largestChunks);
  }

  it("allows a voice-SDK chunk up to the exemption budget", async () => {
    const voice = chunk("voice.js", "var x='livekit';");
    await expect(check(`${750 * 1024} ${voice}`)).resolves.toMatchObject({
      stdout: "",
    });
  });

  it("still holds an unrelated chunk to the default budget", async () => {
    const other = chunk("other.js", "var x='posthog';");
    await expect(check(`${750 * 1024} ${other}`)).resolves.toMatchObject({
      stdout: "\\n- Largest chunk (750 KB) exceeds budget (650 KB)",
    });
  });

  it("holds the voice-SDK chunk to the exemption budget", async () => {
    const voice = chunk("voice-big.js", "var x='livekit';");
    await expect(check(`${801 * 1024} ${voice}`)).resolves.toMatchObject({
      stdout: "\\n- Largest chunk (801 KB) exceeds budget (800 KB)",
    });
  });

  it("checks every listed chunk, not only the largest", async () => {
    const voice = chunk("voice-ok.js", "var x='livekit';");
    const other = chunk("other2.js", "var x='supabase';");
    await expect(
      check(`${750 * 1024} ${voice}\n${700 * 1024} ${other}`)
    ).resolves.toMatchObject({
      stdout: `\\n- Chunk ${other} (700 KB) exceeds budget (650 KB)`,
    });
  });

  it("fails closed on an invalid exemption budget", async () => {
    await expect(
      bash('largest_chunk_budget_violation "$2" 650 livekit nope', "1024 a.js")
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Invalid exempt chunk budget"),
    });
  });
});

describe("route first-load helpers (.next/diagnostics/route-bundle-stats.json)", () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-first-load-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const statsPath = join(dir, "route-bundle-stats.json");
  writeFileSync(
    statsPath,
    JSON.stringify([
      { route: "/", firstLoadUncompressedJsBytes: 640920, firstLoadChunkPaths: [] },
      { route: "/admin", firstLoadUncompressedJsBytes: 1031065, firstLoadChunkPaths: [] },
      { route: "/immersive", firstLoadUncompressedJsBytes: 789377, firstLoadChunkPaths: [] },
    ])
  );

  function run(fn: string, file: string, budgetKb = "") {
    return bash(`${fn} "$2" ${budgetKb}`, file);
  }

  it("summarises routes largest first in KB", async () => {
    const { stdout } = await run("first_load_summary", statsPath);
    expect(stdout.trim().split("\n")).toEqual([
      "- /admin: 1007 KB",
      "- /immersive: 771 KB",
      "- /: 626 KB",
    ]);
  });

  it("reports no violation when every route is within budget", async () => {
    await expect(run("first_load_budget_violation", statsPath, "2100")).resolves.toMatchObject({
      stdout: "",
    });
  });

  it("reports each route over the initial-load budget", async () => {
    await expect(run("first_load_budget_violation", statsPath, "800")).resolves.toMatchObject({
      stdout: "\\n- First load of /admin (1007 KB) exceeds budget (800 KB)",
    });
  });

  it("says so when the stats file is absent, without failing", async () => {
    const { stdout } = await run("first_load_summary", join(dir, "missing.json"));
    expect(stdout).toContain("route-bundle-stats.json not present");
    await expect(
      run("first_load_budget_violation", join(dir, "missing.json"), "2100")
    ).resolves.toMatchObject({ stdout: "" });
  });
});
