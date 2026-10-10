import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = new URL('./check-mobile-lighthouse.mjs', import.meta.url);
const loadChecker = async () => (await import(script.href)).evaluateMobileReports;
const report = (index, performance = 0.75, lcp = 3900, tbt = 450) => ({
  lighthouseVersion: '12.6.1',
  fetchTime: `2026-10-10T10:00:0${index}.000Z`,
  requestedUrl: 'http://localhost:3000/immersive',
  finalDisplayedUrl: 'http://localhost:3000/immersive',
  finalUrl: 'http://localhost:3000/immersive',
  configSettings: {
    formFactor: 'mobile', throttlingMethod: 'simulate', disableStorageReset: false,
    screenEmulation: { mobile: true, disabled: false, width: 412, height: 823, deviceScaleFactor: 1.75 },
    throttling: {
      rttMs: 150, throughputKbps: 1638.4, requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.5600000000002, uploadThroughputKbps: 675, cpuSlowdownMultiplier: 4,
    },
  },
  categories: { performance: { score: performance } },
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'total-blocking-time': { numericValue: tbt },
  },
});
const reports = () => [report(1), report(2), report(3)];

test('three independent numeric medians permit the exact score/LCP boundaries and TBT below 500', async () => {
  const evaluate = await loadChecker();
  // No single representative report has these three values. Arithmetic means
  // also fail here, so neither shortcut can satisfy the metric-median contract.
  const result = evaluate([
    report(1, 0.99, 9000, 100), report(2, 0.70, 2000, 499.999), report(3, 0.01, 4000, 900),
  ]);
  assert.deepEqual(result, { performance: 0.70, lcp: 4000, tbt: 499.999 });
});

for (const [name, values, expected] of [
  ['score below .7', [report(1, 0.699), report(2, 0.699), report(3, 0.99)], /performance/i],
  ['LCP above 4000', [report(1, 0.8, 4000.001), report(2, 0.8, 4000.001), report(3, 0.8, 1)], /LCP/i],
  ['TBT exactly 500', [report(1, 0.8, 3900, 499), report(2, 0.8, 3900, 500), report(3, 0.8, 3900, 501)], /TBT/i],
  ['TBT above 500', [report(1, 0.8, 3900, 501), report(2, 0.8, 3900, 502), report(3, 0.8, 3900, 1)], /TBT/i],
]) test(`rejects ${name} even with a passing outlier`, async () => {
  const evaluate = await loadChecker();
  assert.throws(() => evaluate(values), expected);
});

for (const count of [0, 1, 2, 4]) test(`rejects ${count} reports instead of exactly three`, async () => {
  const evaluate = await loadChecker();
  assert.throws(() => evaluate(Array.from({ length: count }, (_, i) => report(i))), /three|3/i);
});

const invalidReports = [
  ['missing performance', r => { delete r.categories.performance; }],
  ['null score', r => { r.categories.performance.score = null; }],
  ['string score', r => { r.categories.performance.score = '0.9'; }],
  ['out of range score', r => { r.categories.performance.score = 1.1; }],
  ['missing LCP', r => { delete r.audits['largest-contentful-paint']; }],
  ['negative LCP', r => { r.audits['largest-contentful-paint'].numericValue = -1; }],
  ['nonfinite TBT', r => { r.audits['total-blocking-time'].numericValue = Infinity; }],
  ['null TBT', r => { r.audits['total-blocking-time'].numericValue = null; }],
  ['audit error', r => { r.audits['total-blocking-time'].errorMessage = 'measurement failed'; }],
  ['runtime error', r => { r.runtimeError = { code: 'NO_FCP', message: 'No paint' }; }],
  ['desktop report', r => { r.configSettings.formFactor = 'desktop'; }],
  ['missing settings', r => { delete r.configSettings; }],
  ['unthrottled report', r => { r.configSettings.throttlingMethod = 'provided'; }],
  ['wrong CPU slowdown', r => { r.configSettings.throttling.cpuSlowdownMultiplier = 1; }],
  ['faster network', r => { r.configSettings.throttling.throughputKbps = 10000; }],
  ['wrong network latency', r => { r.configSettings.throttling.rttMs = 40; }],
  ['disabled screen emulation', r => { r.configSettings.screenEmulation.disabled = true; }],
  ['desktop screen emulation', r => { r.configSettings.screenEmulation.mobile = false; }],
  ['warm storage override', r => { r.configSettings.disableStorageReset = true; }],
  ['coerced requested URL array', r => { r.requestedUrl = [r.requestedUrl]; }],
  ['coerced displayed URL array', r => { r.finalDisplayedUrl = [r.finalDisplayedUrl]; }],
  ['coerced final URL array', r => { r.finalUrl = [r.finalUrl]; }],
  ...['blockedUrlPatterns', 'onlyAudits', 'skipAudits'].map(key => [key + ' override', r => { r.configSettings[key] = ['*auth*']; }]),
  ['precomputed network data', r => { r.configSettings.precomputedLanternData = { rtt: 1 }; }],
  ['authentication header override', r => { r.configSettings.extraHeaders = { authorization: 'synthetic' }; }],
  ['different route', r => { r.requestedUrl = 'http://localhost:3000/pricing'; }],
  ['redirected route', r => { r.finalDisplayedUrl = 'http://localhost:3000/maintenance'; }],
  ['mixed versions', r => { r.lighthouseVersion = '13.0.0'; }],
  ['invalid run timestamp', r => { r.fetchTime = 'not-a-timestamp'; }],
];
for (const [name, mutate] of invalidReports) test(`rejects one invalid report: ${name}`, async () => {
  const evaluate = await loadChecker();
  const values = reports(); mutate(values[0]);
  assert.throws(() => evaluate(values), /invalid|report|settings|mobile|throttl|storage|route|URL|version|timestamp|audit/i);
});

test('duplicate raw runs cannot stand in for three measurements', async () => {
  const evaluate = await loadChecker();
  const one = report(1);
  assert.throws(() => evaluate([one, structuredClone(one), report(3)]), /duplicate|distinct/i);
});

function withDirectory(fn) {
  const directory = mkdtempSync(join(tmpdir(), 'paisaxe-mobile-gate-test-'));
  try { return fn(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
function run(directory) {
  // A missing implementation must fail the test, never impersonate the
  // expected nonzero budget result.
  readFileSync(script);
  return spawnSync(process.execPath, [fileURLToPath(script), directory], { encoding: 'utf8', cwd: root });
}
function writeReports(directory, values) {
  values.forEach((value, index) => writeFileSync(join(directory, `lhr-${1000 + index}.json`), JSON.stringify(value)));
}

test('CLI reads three raw LHCI reports, ignoring filesystem upload copies and assertion summaries', () => withDirectory(directory => {
  writeReports(directory, reports());
  writeFileSync(join(directory, 'manifest.json'), '[]');
  writeFileSync(join(directory, 'assertion-results.json'), '[]');
  writeFileSync(join(directory, 'localhost-immersive.json'), JSON.stringify(report(4, 0.01, 9000, 9000)));
  const result = run(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { performance: 0.75, lcp: 3900, tbt: 450 });
}));

test('CLI exits nonzero at exact TBT 500', () => withDirectory(directory => {
  writeReports(directory, [report(1, 0.8, 3900, 500), report(2, 0.8, 3900, 500), report(3, 0.8, 3900, 499)]);
  const result = run(directory);
  assert.equal(result.status, 1); assert.match(result.stderr, /TBT/i);
}));

test('CLI fails on malformed raw JSON without treating another summary as a report', () => withDirectory(directory => {
  writeReports(directory, reports());
  writeFileSync(join(directory, 'lhr-1001.json'), '{broken');
  const result = run(directory);
  assert.equal(result.status, 1); assert.match(result.stderr, /JSON|report/i);
}));

test('CLI fails closed on an empty or missing report directory', () => withDirectory(directory => {
  for (const target of [directory, join(directory, 'missing')]) {
    const result = run(target);
    assert.equal(result.status, 1); assert.match(result.stderr, /report|directory|three|3/i);
  }
}));

test('mobile config restores all required budgets without changing default mobile throttling or run count', () => {
  const config = JSON.parse(readFileSync(new URL('../lighthouserc.mobile.json', import.meta.url)));
  assert.equal(config.ci.collect.numberOfRuns, 3);
  assert.deepEqual(config.ci.collect.url, ['http://localhost:3000/immersive']);
  assert.equal(config.ci.collect.settings.preset, undefined);
  assert.equal(config.ci.collect.settings.throttling, undefined);
  assert.deepEqual(config.ci.assert.assertions['categories:performance'], ['error', { minScore: 0.7, aggregationMethod: 'median' }]);
  assert.deepEqual(config.ci.assert.assertions['largest-contentful-paint'], ['error', { maxNumericValue: 4000, aggregationMethod: 'median' }]);
  assert.deepEqual(config.ci.assert.assertions['total-blocking-time'], ['error', { maxNumericValue: 500, aggregationMethod: 'median' }]);
});

for (const path of ['.github/workflows/lighthouse.yml', '.github/workflows/ci-cadence-lighthouse-full.yml']) {
  test(`${path} requires the strict checker immediately after the actual mobile action`, () => {
    const workflow = parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
    const steps = workflow.jobs.lighthouse.steps;
    const index = steps.findIndex(step => step.name === 'Run Lighthouse CI (mobile)');
    assert.ok(index >= 0);
    assert.equal(steps[index].uses, 'treosh/lighthouse-ci-action@v12');
    assert.equal(steps[index].id, 'mobile_lighthouse');
    const gate = steps[index + 1];
    assert.equal(gate.name, 'Require strict mobile Lighthouse medians');
    assert.equal(gate.run, 'node scripts/check-mobile-lighthouse.mjs "$LIGHTHOUSE_RESULTS_PATH"');
    assert.deepEqual(gate.env, { LIGHTHOUSE_RESULTS_PATH: '${{ steps.mobile_lighthouse.outputs.resultsPath }}' });
    assert.equal(gate.if, undefined); assert.equal(gate['continue-on-error'], undefined);
    assert.equal(steps[index]['continue-on-error'], undefined);
  });
}
