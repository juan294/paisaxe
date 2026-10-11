// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { collectJourneyRun, type JourneyOptions } from './qa-journey';

const identity = { commit: 'fixture-commit', tree: 'fixture-tree' };
const passingReport = (recovery: string) => ({
  stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 0 }, recovery,
});
function passingCommand(launchMarker: string, recovery: string): string[] {
  return [process.execPath, '-e', `const fs = require('node:fs');
    fs.writeFileSync(${JSON.stringify(launchMarker)}, 'launched');
    fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, ${JSON.stringify(JSON.stringify(passingReport(recovery)))});`];
}
function options(directory: string, command: string[]): JourneyOptions {
  return { directory, target: 'http://127.0.0.1:3000', identity,
    cronSecret: 'fixture', enabled: true, command };
}
function mockHealth(ready: () => boolean) {
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => Response.json(url.pathname === '/api/health/live'
    ? { status: ready() ? 'live' : 'starting' } : { build: identity })));
}

afterEach(() => vi.unstubAllGlobals());
it('rejects an empty executable with a retained command diagnostic and no passing evidence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'journey-empty-command-'));
  mockHealth(() => true);
  try {
    const reportPath = join(directory, 'playwright.json');
    writeFileSync(reportPath, JSON.stringify({ stats: { expected: 97 } }));
    const result = await collectJourneyRun(options(directory, []));
    expect(result.status).toBe('invalid_report');
    expect(result.failures).toBe(1);
    expect(result.passed).toBe(0);
    expect(readFileSync(result.logPath, 'utf8')).toContain('Journey command requires a nonempty executable');
    expect(existsSync(reportPath)).toBe(false);

    // Reuse the rejected run's directory: success must come from a fresh real subprocess report.
    const launched = join(directory, 'corrected-tests-launched');
    const recovered = await collectJourneyRun(options(directory, passingCommand(launched, 'command-recovery')));
    expect(existsSync(launched)).toBe(true);
    expect(recovered).toMatchObject({ status: 'passed', passed: 2, failed: 0, skipped: 0, failures: 0, exitCode: 0 });
    expect(JSON.parse(readFileSync(recovered.reportPath, 'utf8'))).toEqual(passingReport('command-recovery'));
    expect(readFileSync(recovered.logPath, 'utf8')).not.toContain('Journey command requires a nonempty executable');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('rejects an empty startup executable before tests launch, then recovers with a valid owned startup command', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'journey-empty-start-command-'));
  const started = join(directory, 'corrected-server-started');
  const launched = join(directory, 'tests-launched');
  // Only the HTTP boundary is fake. Readiness requires the actual startup child to write its marker.
  mockHealth(() => existsSync(started));
  try {
    const reportPath = join(directory, 'playwright.json');
    writeFileSync(reportPath, JSON.stringify({ stats: { expected: 97 } }));
    const configured = { ...options(directory, passingCommand(launched, 'startup-recovery')),
      startCommand: [], startupTimeoutMs: 3000 };
    const rejected = await collectJourneyRun(configured);
    expect(rejected).toMatchObject({ status: 'startup_failed', passed: 0, failures: 1, exitCode: null });
    expect(readFileSync(rejected.logPath, 'utf8')).toContain('Journey command requires a nonempty executable');
    expect(existsSync(started)).toBe(false);
    expect(existsSync(launched)).toBe(false);
    expect(existsSync(reportPath)).toBe(false);

    const recovered = await collectJourneyRun({ ...configured,
      startCommand: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(started)}, 'started'); setInterval(() => {}, 1000);`] });
    expect(existsSync(started)).toBe(true);
    expect(existsSync(launched)).toBe(true);
    expect(recovered).toMatchObject({ status: 'passed', passed: 2, failed: 0, skipped: 0, failures: 0, exitCode: 0 });
    expect(JSON.parse(readFileSync(recovered.reportPath, 'utf8'))).toEqual(passingReport('startup-recovery'));
    expect(readFileSync(recovered.logPath, 'utf8')).not.toContain('Journey command requires a nonempty executable');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
