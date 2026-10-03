import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { measureCadence, collectEvidence, writePrivateEvidence } from './measure-ci-cadence.mjs';

const fixture = JSON.parse(await readFile(new URL('../tests/fixtures/ci-cadence/jobs.json', import.meta.url)));
const input = () => structuredClone(fixture);

test('public output allowlists interval and target fields', () => {
  const data = input(); data.interval.privateRepository = 'owner/private-project';
  data.target = { routineDailyLimit: 80, cycleDays: 31, releaseReserve: 500, cycleLimit: 2980, privateAccount: 'billing-secret' };
  assert.doesNotMatch(JSON.stringify(measureCadence(data)), /owner\/private-project|billing-secret|privateAccount|privateRepository/);
});

test('empty inventory, null SKU entries and impossible dates give field-specific errors', () => {
  const data = input(); data.repositories = []; data.runs = []; data.collection.pages = [];
  assert.throws(() => measureCadence(data), /repositories/);
  const rates = input(); rates.rates.skus.linux = null;
  assert.throws(() => measureCadence(rates), /rates.skus.linux/);
  const dates = input(); dates.interval.start = '2026-02-30T00:00:00Z';
  assert.throws(() => measureCadence(dates), /interval.start/);
});

test('all attempts, per-job rounding and window overlap remain distinct', () => {
  const report = measureCadence(input());
  assert.equal(report.scan_complete, true);
  assert.equal(report.hostedRoundedMinutes, 5);
  assert.equal(report.hostedOverlapMinutes, 2.5);
  assert.equal(report.attempts, 2);
  assert.equal(report.createdCohortRuns, 1);
  assert.equal(report.earlierCreatedRuns, 1);
  assert.equal(report.events.push.hostedRoundedMinutes, 3);
  assert.equal(report.events.schedule.hostedRoundedMinutes, 2);
  assert.equal(report.selfHostedOverlapMinutes, 1);
  assert.equal(report.netSavings, null);
});
test('a complete retry attempt adds every rounded job without replacing the first attempt', () => {
  const data=input(); const run=data.runs[0]; run.run_attempt=2;
  run.jobs.push(...structuredClone(run.jobs).map(job=>({...job,id:job.id+1000,run_attempt:2})));
  data.collection.pages.push({...data.collection.pages[2],attempt:2});
  const report=measureCadence(data);
  assert.equal(report.attempts,3);
  assert.equal(report.hostedRoundedMinutes,8);
  assert.equal(report.scan_complete,true);
});

test('SKU weights and public discounts require supplied dated rate evidence', () => {
  const data = input();
  data.repositories[0].visibility = 'public';
  const report = measureCadence(data);
  assert.equal(report.rateWeightedPrivateMinutes, 4);
  assert.equal(report.estimatedHostedListCost, 0.02);
  data.rates = null;
  assert.equal(measureCadence(data).estimatedHostedListCost, null);
  assert.equal(measureCadence(data).target.status, 'unavailable');
});

for (const [label, mutate] of [
  ['unknown labels', d => { d.runs[0].jobs[0].labels = ['unidentified']; }],
  ['missing runtime', d => { d.runs[0].jobs[0].completed_at = null; }],
  ['queued runtime', d => { d.runs[0].jobs[0].started_at = null; }],
  ['unsupported SKU', d => { d.runs[0].jobs[0].sku = 'unsupported'; }],
  ['missing API page', d => { d.collection.pages[0].observed = 0; }],
  ['missing attempt', d => { d.runs[0].run_attempt = 2; }],
  ['source interval too narrow', d => { d.collection.start = d.interval.start; }],
  ['unfinished collection', d => { d.collection.fetchedAt = '2026-10-02T12:00:00Z'; }],
  ['API failure', d => { d.collection.errors.push('job page unavailable'); }],
]) {
  test(`${label} is visible and cannot pass completeness or cost acceptance`, () => {
    const data = input(); mutate(data);
    const report = measureCadence(data);
    assert.equal(report.scan_complete, false);
    assert.ok(report.gaps.length > 0);
    assert.equal(report.netSavings, null);
    assert.equal(report.target.status, 'unavailable');
  });
}

test('window boundary excludes non-overlapping execution and never counts queue time', () => {
  const data = input();
  data.runs[0].jobs[0].started_at = '2026-10-01T00:00:00Z';
  data.runs[0].jobs[0].completed_at = data.interval.start;
  assert.equal(measureCadence(data).hostedRoundedMinutes, 3);
});

test('cancelled execution costs time without claiming avoided cost', () => {
  const data = input(); data.runs[0].jobs[0].conclusion = 'cancelled';
  const report = measureCadence(data);
  assert.equal(report.hostedRoundedMinutes, 5);
  assert.equal(report.netSavings, null);
});

test('skipped jobs cannot refresh execution or charge known duration', () => {
  const data = input(); data.runs[0].jobs[0].conclusion = 'skipped';
  data.runs[0].jobs[0].started_at = null; data.runs[0].jobs[0].completed_at = null;
  assert.equal(measureCadence(data).hostedRoundedMinutes, 3);
});

test('missing billing/provider, zero baseline and mismatched allocation cannot manufacture savings', () => {
  const data = input();
  const accounting = { ...data.interval, observedAt: data.collection.fetchedAt, source: 'fixture export', reconciled: true, cash: 10 };
  data.billing = accounting;
  assert.equal(measureCadence(data).netSavings, null);
  data.provider = { ...accounting, cash: 2 };
  data.baseline = { ...accounting, cash: 0, providerCash: 0, comparable: true };
  const report = measureCadence(data);
  assert.equal(report.netSavings.cash, -12);
  assert.equal(report.netSavings.percent, null);
  data.provider.end = '2026-10-04T00:00:00Z';
  assert.equal(measureCadence(data).netSavings, null);
});
test('accounting captured before its interval closes cannot reconcile cash or savings', () => {
  const data=input();const evidence={...data.interval,observedAt:'2026-10-01T00:00:00Z',source:'synthetic premature accounting',reconciled:true,cash:1};
  data.billing=evidence;data.provider=evidence;data.baseline={...evidence,observedAt:data.collection.fetchedAt,cash:100,providerCash:1,comparable:true};
  const report=measureCadence(data);
  assert.equal(report.billingReconciled,false);assert.equal(report.providerReconciled,false);assert.equal(report.netSavings,null);
  data.billing={...evidence,observedAt:data.collection.fetchedAt};data.provider={...evidence,observedAt:data.collection.fetchedAt};
  assert.equal(measureCadence(data).netSavings.cash,99);
});

test('target pass/fail preserves absolute counts and includes monitoring', () => {
  const data = input();
  data.target = { routineDailyLimit: 0.001, cycleDays: 31, releaseReserve: 500, cycleLimit: 2980 };
  assert.equal(measureCadence(data).target.status, 'failed');
  data.target.routineDailyLimit = 80;
  const report = measureCadence(data);
  assert.equal(report.target.status, 'passed');
  assert.equal(report.lanes.monitoring.hostedRoundedMinutes, 2);
  assert.equal(report.target.routineRoundedWeightedMinutes, 7);
});

for (const [field, mutate] of [
  ['interval.end', d => { d.interval.end = 'bad'; }],
  ['visibility', d => { d.repositories[0].visibility = 'unknown'; }],
  ['rates', d => { d.rates.skus.linux.usdPerMinute = -1; }],
  ['completed_at', d => { d.runs[0].jobs[0].completed_at = 'bad'; }],
  ['run_attempt', d => { d.runs[0].jobs[0].run_attempt = 0; }],
]) test(`invalid ${field} names its field and corrected evidence recovers`, () => {
  const data = input(); mutate(data);
  assert.throws(() => measureCadence(data), new RegExp(field));
  assert.equal(measureCadence(input()).scan_complete, true);
});

test('duplicates reject evidence rather than double-count jobs', () => {
  const data = input(); data.runs[0].jobs.push(data.runs[0].jobs[0]);
  assert.throws(() => measureCadence(data), /duplicate/);
});

test('publication denominator requires unique ledger identity and owner aliases', () => {
  const data = input();
  assert.equal(measureCadence(data).publicationCount, null);
  data.runs[0].publication = { id:'push-1', ownerAlias:'OWNER1' };
  const second = structuredClone(data.runs[0]); second.id=3;
  data.runs.push(second);
  data.collection.pages[0].expected=2; data.collection.pages[0].observed=2;
  data.collection.pages.push({...data.collection.pages[2],runId:3});
  const report=measureCadence(data);
  assert.equal(report.pushWorkflowRunCount,2);
  assert.equal(report.publicationCount,1);
  assert.equal(report.perOwnerPublicationCount.OWNER1,1);
  assert.equal(report.minutesPerPublication,10);
});

test('collector paginates every attempt and records failed pages without remote mutation', async () => {
  const calls = [];
  const config = { repositories: [{ alias: 'A', name: 'example/fixture', visibility: 'private' }], interval: input().interval,
    start: input().collection.start, end: input().collection.end, earlierCreatedCoverage: true, accountScopeComplete: true };
  const request = async endpoint => {
    calls.push(endpoint);
    if (endpoint.includes('/attempts/')) {
      const attempt = Number(endpoint.match(/attempts\/(\d+)/)[1]);
      return { total_count: 1, jobs: [{ ...input().runs[0].jobs[0], id: attempt, run_attempt: attempt }] };
    }
    return { total_count: 1, workflow_runs: [{ ...input().runs[0], run_attempt: 2 }] };
  };
  const evidence = await collectEvidence(config, request);
  assert.equal(evidence.runs[0].jobs.length, 2);
  assert.ok(calls.every(c => !/rerun|dispatch|cancel/.test(c)));
  assert.ok(calls.some(c => c.includes('/attempts/1/jobs')));
  assert.ok(calls.some(c => c.includes('/attempts/2/jobs')));
  const failed = await collectEvidence(config, async e => {
    if (e.includes('/attempts/1/')) throw new Error('API unavailable');
    return request(e);
  });
  assert.equal(failed.collection.complete, false);
  assert.equal(measureCadence(failed).scan_complete, false);
});

test('collector requests subsequent pages and exposes GitHub capped run cohorts', async () => {
  const config = { repositories: [{ alias: 'A', name: 'example/fixture', visibility: 'private' }], interval: input().interval,
    start: input().collection.start, end: input().collection.end, earlierCreatedCoverage: true, accountScopeComplete: true };
  const calls = [];
  const evidence = await collectEvidence(config, async e => {
    calls.push(e);
    if (e.includes('/jobs')) return { total_count: 0, jobs: [] };
    const page = Number(e.match(/&page=(\d+)/)[1]);
    return { total_count: 101, workflow_runs: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({
      ...input().runs[0], id: page * 100 + i, run_attempt: 1, jobs: undefined,
    })) };
  });
  assert.equal(evidence.runs.length, 101);
  assert.ok(calls.some(e => e.includes('&page=2')));
  assert.equal(evidence.collection.complete, true);
  const capped = await collectEvidence(config, async () => ({ total_count: 1001, workflow_runs: [] }));
  assert.equal(capped.collection.complete, false);
});

test('private evidence permissions are restrictive and output cannot overwrite supplied input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cadence-'));
  const path = join(dir, 'evidence.json');
  await writePrivateEvidence(path, input());
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(() => writePrivateEvidence(path, input()), /exist/);
});

test('CLI summary uses aliases and explicit paths; missing paths fail', () => {
  const command = new URL('./measure-ci-cadence.mjs', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [command, '--source', new URL('../tests/fixtures/ci-cadence/jobs.json', import.meta.url).pathname], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).repositories.A);
  assert.equal(/example\/fixture/.test(result.stdout), false);
  assert.notEqual(spawnSync(process.execPath, [command], { encoding: 'utf8' }).status, 0);
});
