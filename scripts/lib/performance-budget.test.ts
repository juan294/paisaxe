// @vitest-environment node
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const helperPath = join(process.cwd(), "scripts/lib/performance-budget.sh");

async function checkLargestChunk(largestChunks: string, budgetKb = 650) {
  return execFileAsync(
    "bash",
    [
      "-c",
      'source "$1"\nlargest_chunk_budget_violation "$2" "$3"',
      "performance-budget-test",
      helperPath,
      largestChunks,
      String(budgetKb),
    ],
    { cwd: process.cwd() }
  );
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
