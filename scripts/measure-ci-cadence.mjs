#!/usr/bin/env node
// Standalone read-only measurement. No optimizer, registry or provider imports.
import { readFile, mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const MINUTE = 60_000;
const DAY = 86_400_000;
const LANES = ['fast', 'nightly', 'release', 'activation', 'monitoring', 'unknown'];
const DEFAULT_TARGET = { routineDailyLimit: 80, cycleDays: 31, releaseReserve: 500, cycleLimit: 2980 };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireField(condition, field, repair) {
  if (!condition) throw new Error(`${field}: ${repair}`);
}
function timestamp(value, field) {
  requireField(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)), field, 'supply a valid UTC execution timestamp');
  requireField(new Date(value).toISOString().slice(0, 19) === value.slice(0, 19), field, 'supply an existing UTC calendar date');
  return Date.parse(value);
}
function interval(value, field) {
  const start = timestamp(value?.start, `${field}.start`);
  const end = timestamp(value?.end, `${field}.end`);
  requireField(end > start, `${field}.end`, 'end must follow start');
  return { start, end };
}
function natural(value, field, minimum = 0) {
  requireField(Number.isSafeInteger(value) && value >= minimum, field, `supply an integer >= ${minimum}`);
}
function nonnegative(value, field) {
  requireField(Number.isFinite(value) && value >= 0, field, 'supply a finite nonnegative number');
}
function alias(value) {
  requireField(typeof value === 'string' && /^[A-Z][A-Z0-9]{0,7}$/.test(value), 'alias', 'use a public-safe uppercase alias');
}
function bucket() { return { hostedRoundedMinutes: 0, hostedOverlapMinutes: 0, selfHostedOverlapMinutes: 0, jobs: 0 }; }
function rounded(value) { return Math.round(value * 1e6) / 1e6; }

function validateRates(rates, window) {
  if (rates == null) return false;
  timestamp(rates.observedAt, 'rates.observedAt');
  requireField(typeof rates.source === 'string' && rates.source.length > 0, 'rates.source', 'name the dated billing/export evidence');
  const covered = interval(rates, 'rates');
  requireField(rates.skus && typeof rates.skus === 'object' && !Array.isArray(rates.skus), 'rates.skus', 'provide SKU-specific rates');
  for (const [sku, entry] of Object.entries(rates.skus)) {
    requireField(isRecord(entry), `rates.skus.${sku}`, 'supply a SKU rate object');
    requireField(entry.kind === 'hosted', `rates.skus.${sku}.kind`, 'only hosted rate entries are supported');
    requireField(Array.isArray(entry.labels) && entry.labels.length && entry.labels.every(x => typeof x === 'string'), `rates.skus.${sku}.labels`, 'supply the export-backed label inventory');
    nonnegative(entry.usdPerMinute, `rates.skus.${sku}.usdPerMinute`);
    nonnegative(entry.weight, `rates.skus.${sku}.weight`);
    nonnegative(entry.publicDiscount, `rates.skus.${sku}.publicDiscount`);
    requireField(entry.publicDiscount <= 1, `rates.skus.${sku}.publicDiscount`, 'discount must be between zero and one');
  }
  return covered.start <= window.start && covered.end >= window.end;
}

function accountingEvidence(value, expected, field) {
  if (value == null) return false;
  const covered = interval(value, field);
  const observedAt = timestamp(value.observedAt, `${field}.observedAt`);
  nonnegative(value.cash, `${field}.cash`);
  requireField(typeof value.source === 'string' && value.source.length > 0, `${field}.source`, 'name the cash accounting source');
  return observedAt >= covered.end && covered.start === expected.start && covered.end === expected.end && value.reconciled === true;
}

export function measureCadence(data) {
  requireField(data?.schema_version === 1, 'schema_version', 'use evidence schema 1');
  const window = interval(data.interval, 'interval');
  const source = interval(data.collection, 'collection');
  const fetched = timestamp(data.collection.fetchedAt, 'collection.fetchedAt');
  requireField(Array.isArray(data.collection.errors), 'collection.errors', 'supply collected error records');
  requireField(Array.isArray(data.collection.pages), 'collection.pages', 'supply run and all-attempt job page receipts');
  requireField(Array.isArray(data.repositories) && data.repositories.length > 0 && Array.isArray(data.runs), 'repositories/runs', 'supply a nonempty repository inventory and complete run array');
  const gaps = [];
  if (data.collection.complete !== true || data.collection.errors.length) gaps.push('collection has failed or incomplete pages');
  if (source.start >= window.start || source.end < window.end || data.collection.earlierCreatedCoverage !== true) gaps.push('source window lacks attested earlier-created execution coverage');
  if (fetched < window.end) gaps.push('collection occurred before accounting window closed');
  if (data.collection.accountScopeComplete !== true) gaps.push('account allocation scope is incomplete');
  const repositories = Object.create(null);
  const visibility = new Map();
  for (const repo of data.repositories) {
    requireField(isRecord(repo), 'repositories', 'supply repository objects');
    alias(repo.alias);
    requireField(!visibility.has(repo.alias), 'repositories.alias', 'duplicate repository alias');
    requireField(['private', 'public'].includes(repo.visibility), 'visibility', 'use private or public');
    visibility.set(repo.alias, repo.visibility); repositories[repo.alias] = bucket();
  }
  const pages = new Map();
  for (const page of data.collection.pages) {
    requireField(isRecord(page), 'collection.pages', 'supply page receipt objects');
    alias(page.alias);
    requireField(visibility.has(page.alias), 'collection.pages.alias', 'page repository must be in inventory');
    requireField(['runs', 'jobs'].includes(page.kind), 'collection.pages.kind', 'use runs or jobs');
    natural(page.expected, 'collection.pages.expected'); natural(page.observed, 'collection.pages.observed');
    const key = page.kind === 'runs' ? `${page.alias}:runs` : `${page.alias}:${page.runId}:${page.attempt}`;
    requireField(!pages.has(key), 'collection.pages', 'duplicate page receipt');
    pages.set(key, page);
    if (page.expected !== page.observed || page.complete !== true) gaps.push(`incomplete ${page.kind} pages for ${page.alias}`);
  }
  const ratesValid = validateRates(data.rates, window);
  let rateComplete = ratesValid;
  let estimatedHostedListCost = 0;
  let rateWeightedPrivateMinutes = 0;
  let routineMinutes = 0;
  let releaseMinutes = 0;
  let hostedRoundedMinutes = 0;
  let hostedOverlapMinutes = 0;
  let selfHostedOverlapMinutes = 0;
  let unknownJobs = 0;
  let missingTimingJobs = 0;
  let createdCohortRuns = 0;
  let earlierCreatedRuns = 0;
  let attempts = 0;
  let pushWorkflowRunCount = 0;
  let publicationsComplete = true;
  const publications = new Map();
  const perOwnerPublicationCount = Object.create(null);
  const events = Object.create(null);
  const lanes = Object.fromEntries(LANES.map(lane => [lane, bucket()]));
  const seenRuns = new Set();
  const observedRuns = new Map();
  for (const run of data.runs) {
    requireField(isRecord(run), 'run', 'supply a native run object');
    alias(run.alias);
    requireField(visibility.has(run.alias), 'run.alias', 'run must belong to repository inventory');
    natural(run.id, 'run.id', 1); natural(run.run_attempt, 'run.run_attempt', 1);
    const runKey = `${run.alias}:${run.id}`;
    requireField(!seenRuns.has(runKey), 'run.id', 'duplicate run'); seenRuns.add(runKey);
    observedRuns.set(run.alias, (observedRuns.get(run.alias) ?? 0) + 1);
    const created = timestamp(run.created_at, 'run.created_at');
    if (created < source.start || created > source.end) gaps.push(`run created outside captured cohort for ${run.alias} run ${run.id}`);
    requireField(typeof run.event === 'string' && /^[a-z_]+$/.test(run.event), 'run.event', 'supply native event kind');
    requireField(Array.isArray(run.jobs), 'run.jobs', 'supply jobs from every attempt');
    if (created >= window.start && created < window.end) createdCohortRuns++;
    else if (created < window.start) earlierCreatedRuns++;
    if (run.event === 'push' && created >= window.start && created < window.end) {
      pushWorkflowRunCount++;
      if (run.publication == null) publicationsComplete = false;
      else {
        requireField(isRecord(run.publication) && typeof run.publication.id === 'string' && /^[A-Za-z0-9_.-]+$/.test(run.publication.id), 'run.publication.id', 'supply the immutable push event identity from the rollout ledger');
        alias(run.publication.ownerAlias);
        const key = `${run.alias}:${run.publication.id}`;
        requireField(!publications.has(key) || publications.get(key) === run.publication.ownerAlias, 'run.publication.ownerAlias', 'publication owner differs across workflows');
        if (!publications.has(key)) { publications.set(key, run.publication.ownerAlias); perOwnerPublicationCount[run.publication.ownerAlias] = (perOwnerPublicationCount[run.publication.ownerAlias] ?? 0) + 1; }
      }
    }
    const lane = LANES.includes(run.lane) ? run.lane : 'unknown';
    const eventBucket = events[run.event] ??= bucket();
    const attemptCounts = new Map();
    const seenJobs = new Set();
    for (const job of run.jobs) {
      requireField(isRecord(job), 'job', 'supply a native job object');
      natural(job.id, 'job.id', 1); natural(job.run_attempt, 'job.run_attempt', 1);
      requireField(job.run_attempt <= run.run_attempt, 'job.run_attempt', 'attempt exceeds native run attempt');
      const jobKey = `${job.run_attempt}:${job.id}`;
      requireField(!seenJobs.has(jobKey), 'job.id', 'duplicate job'); seenJobs.add(jobKey);
      attemptCounts.set(job.run_attempt, (attemptCounts.get(job.run_attempt) ?? 0) + 1);
      requireField(Array.isArray(job.labels) && job.labels.every(x => typeof x === 'string'), 'job.labels', 'supply runner labels');
      const start = job.started_at == null ? null : timestamp(job.started_at, 'job.started_at');
      const end = job.completed_at == null ? null : timestamp(job.completed_at, 'job.completed_at');
      requireField(start === null || end === null || end >= start, 'job.completed_at', 'completion precedes start');
      requireField(start === null || end === null || end <= fetched, 'job.completed_at', 'execution completes after fetch time');
      if (job.conclusion === 'skipped') continue;
      if (start === null || end === null) { missingTimingJobs++; gaps.push(`missing execution timing for ${run.alias} run ${run.id} attempt ${job.run_attempt}`); continue; }
      const overlap = Math.max(0, Math.min(end, window.end) - Math.max(start, window.start)) / MINUTE;
      if (!overlap) continue;
      const minutes = Math.ceil((end - start) / MINUTE);
      const groups = [repositories[run.alias], eventBucket, lanes[lane]];
      for (const group of groups) group.jobs++;
      if (job.labels.includes('self-hosted')) {
        selfHostedOverlapMinutes += overlap;
        for (const group of groups) group.selfHostedOverlapMinutes += overlap;
        continue;
      }
      const knownHosted = job.labels.some(label => /^(ubuntu|windows|macos)-(latest|\d[\w.-]*)$/.test(label) || label === 'github-hosted');
      if (!knownHosted) { unknownJobs++; gaps.push(`unknown runner for ${run.alias} run ${run.id} job ${job.id}`); continue; }
      hostedRoundedMinutes += minutes; hostedOverlapMinutes += overlap;
      for (const group of groups) { group.hostedRoundedMinutes += minutes; group.hostedOverlapMinutes += overlap; }
      const rate = ratesValid ? data.rates.skus[job.sku] : null;
      if (data.rates && (!rate || !rate.labels.every(label => job.labels.includes(label)))) {
        unknownJobs++; rateComplete = false; gaps.push(`unsupported SKU/label evidence for ${run.alias} run ${run.id} job ${job.id}`); continue;
      }
      if (!rate) { rateComplete = false; continue; }
      const isPrivate = visibility.get(run.alias) === 'private';
      estimatedHostedListCost += minutes * rate.usdPerMinute * (isPrivate ? 1 : 1 - rate.publicDiscount);
      if (isPrivate) {
        const weighted = minutes * rate.weight;
        rateWeightedPrivateMinutes += weighted;
        if (['fast', 'nightly', 'monitoring'].includes(lane)) routineMinutes += weighted;
        else if (lane === 'release') releaseMinutes += weighted;
        else if (lane === 'unknown') gaps.push(`unattributed allocation for ${run.alias} run ${run.id}`);
      }
    }
    for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
      attempts++;
      const page = pages.get(`${run.alias}:${run.id}:${attempt}`);
      if (!page || page.observed !== (attemptCounts.get(attempt) ?? 0)) gaps.push(`missing/mismatched jobs for ${run.alias} run ${run.id} attempt ${attempt}`);
    }
  }
  for (const repo of data.repositories) {
    const page = pages.get(`${repo.alias}:runs`);
    if (!page || page.observed !== (observedRuns.get(repo.alias) ?? 0)) gaps.push(`missing/mismatched run cohort for ${repo.alias}`);
  }
  const scan_complete = gaps.length === 0;
  const targetConfig = Object.fromEntries(Object.keys(DEFAULT_TARGET).map(key => [key, data.target == null ? DEFAULT_TARGET[key] : data.target[key]]));
  for (const key of Object.keys(DEFAULT_TARGET)) nonnegative(targetConfig[key], `target.${key}`);
  requireField(targetConfig.cycleDays > 0, 'target.cycleDays', 'cycle must contain days');
  const days = (window.end - window.start) / DAY;
  const routineDailyMean = routineMinutes / days;
  const projection = routineDailyMean * targetConfig.cycleDays + targetConfig.releaseReserve;
  const target = {
    ...targetConfig,
    status: !scan_complete || !rateComplete ? 'unavailable' : routineDailyMean <= targetConfig.routineDailyLimit && projection <= targetConfig.cycleLimit ? 'passed' : 'failed',
    routineRoundedWeightedMinutes: rateComplete ? rounded(routineMinutes) : null,
    routineDailyMean: rateComplete ? rounded(routineDailyMean) : null,
    cycleProjectionWithReleaseReserve: rateComplete ? rounded(projection) : null,
    observedReleaseWeightedMinutes: rateComplete ? rounded(releaseMinutes) : null,
    releaseReserveAdequacy: 'unmeasured: observation is not a full future cycle',
  };
  const billingValid = accountingEvidence(data.billing, window, 'billing');
  const providerValid = accountingEvidence(data.provider, window, 'provider');
  let netSavings = null;
  if (data.baseline != null) {
    interval(data.baseline, 'baseline'); timestamp(data.baseline.observedAt, 'baseline.observedAt');
    nonnegative(data.baseline.cash, 'baseline.cash'); nonnegative(data.baseline.providerCash, 'baseline.providerCash');
    requireField(typeof data.baseline.source === 'string' && data.baseline.source.length, 'baseline.source', 'name the comparator accounting source');
    const baseDays = (Date.parse(data.baseline.end) - Date.parse(data.baseline.start)) / DAY;
    if (scan_complete && rateComplete && billingValid && providerValid && timestamp(data.baseline.observedAt,'baseline.observedAt') >= Date.parse(data.baseline.end) && data.baseline.comparable === true && data.baseline.reconciled === true && baseDays === days) {
      const baselineCash = data.baseline.cash + data.baseline.providerCash;
      const cash = baselineCash - data.billing.cash - data.provider.cash;
      netSavings = { cash: rounded(cash), percent: baselineCash === 0 ? null : rounded(cash / baselineCash * 100) };
    }
  }
  return {
    schema_version: 1, interval: { start: data.interval.start, end: data.interval.end }, sourceInterval: { start: data.collection.start, end: data.collection.end }, fetchedAt: data.collection.fetchedAt,
    scan_complete, gaps: [...new Set(gaps)], repositories, events, lanes, attempts, createdCohortRuns, earlierCreatedRuns,
    hostedRoundedMinutes, hostedOverlapMinutes: rounded(hostedOverlapMinutes), selfHostedOverlapMinutes: rounded(selfHostedOverlapMinutes), unknownJobs, missingTimingJobs,
    rateWeightedPrivateMinutes: rateComplete ? rounded(rateWeightedPrivateMinutes) : null,
    estimatedHostedListCost: rateComplete ? rounded(estimatedHostedListCost) : null,
    pushWorkflowRunCount, publicationCount: publicationsComplete ? publications.size : null,
    perOwnerPublicationCount: publicationsComplete ? perOwnerPublicationCount : null,
    minutesPerPublication: rateComplete && publicationsComplete && publications.size ? rounded(routineMinutes / publications.size) : null,
    publicationReason: publicationsComplete ? 'immutable push identities supplied by rollout ledger' : 'unavailable: workflow run records do not identify unique push publications',
    target, netSavings, billingReconciled: billingValid, providerReconciled: providerValid, zeroMonthlyInvoice: 'unverified',
    method: 'Rounded full duration of jobs intersecting the window; overlap is a separate execution estimate. Neither reconstructs the invoice. Self-hosted duration has no avoided-hosted-cost credit.',
  };
}

// The request transport represents GitHub REST only. gh invocation below uses explicit GET.
export async function collectEvidence(config, request = ghGet) {
  const window = interval(config.interval, 'interval');
  const source = interval(config, 'collection');
  requireField(source.start < window.start && source.end >= window.end, 'collection.start/end', 'collect a wider created cohort than the accounting window');
  requireField(Array.isArray(config.repositories), 'repositories', 'supply alias/name/visibility inventory');
  const result = { schema_version: 1, interval: config.interval, repositories: [], runs: [], rates: config.rates ?? null,
    billing: config.billing ?? null, provider: config.provider ?? null, baseline: config.baseline ?? null,
    collection: { start: config.start, end: config.end, fetchedAt: '', complete: true, earlierCreatedCoverage: config.earlierCreatedCoverage === true,
      accountScopeComplete: config.accountScopeComplete === true, errors: [], pages: [] } };
  async function paginate(endpoint, field, receipt, cap) {
    const entries = []; let expected = null; let complete = true;
    // Bounded pagination. GitHub created-filtered run endpoints cap at 1000 results.
    for (let page = 1; page <= (cap ? 10 : 100); page++) {
      try {
        const data = await request(`${endpoint}&page=${page}`);
        natural(data.total_count, `${field}.total_count`);
        requireField(Array.isArray(data[field]), field, 'API response must contain an array');
        if (expected === null) expected = data.total_count;
        if (data.total_count !== expected) { complete = false; result.collection.errors.push(`${receipt.alias} ${field}: cohort changed during pagination`); }
        entries.push(...data[field]);
        if (cap && data.total_count > 1000) { complete = false; result.collection.errors.push(`${receipt.alias} ${field}: split the created interval below GitHub's 1000-run cap`); }
        if (entries.length >= data.total_count || data[field].length < 100) break;
      } catch {
        complete = false; result.collection.errors.push(`${receipt.alias} ${field}: GET page ${page} failed; supply a corrected complete capture`); break;
      }
    }
    complete &&= expected !== null && entries.length === expected;
    result.collection.pages.push({ ...receipt, expected: expected ?? 0, observed: entries.length, complete });
    result.collection.complete &&= complete;
    return entries;
  }
  for (const repo of config.repositories) {
    alias(repo.alias);
    requireField(typeof repo.name === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repo.name), 'repositories.name', 'supply owner/repository');
    requireField(['private', 'public'].includes(repo.visibility), 'visibility', 'use private or public');
    result.repositories.push({ alias: repo.alias, visibility: repo.visibility });
    const prefix = `repos/${repo.name}/actions/runs`;
    const runs = await paginate(`${prefix}?created=${encodeURIComponent(`${config.start}..${config.end}`)}&per_page=100`, 'workflow_runs', { alias: repo.alias, kind: 'runs' }, true);
    for (const run of runs) {
      natural(run.id, 'run.id', 1); natural(run.run_attempt, 'run.run_attempt', 1);
      const jobs = [];
      for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
        const pageJobs = await paginate(`${prefix}/${run.id}/attempts/${attempt}/jobs?per_page=100`, 'jobs', { alias: repo.alias, kind: 'jobs', runId: run.id, attempt }, false);
        for (const job of pageJobs) jobs.push({ id: job.id, run_attempt: attempt, name: job.name, labels: job.labels ?? [],
          sku: config.skuByRunner?.[job.runner_name] ?? null, conclusion: job.conclusion, started_at: job.started_at ?? null, completed_at: job.completed_at ?? null });
      }
      result.runs.push({ alias: repo.alias, id: run.id, run_attempt: run.run_attempt, event: run.event, created_at: run.created_at,
        headSha: run.head_sha ?? null, ownerAlias: config.ownerAliases?.[run.actor?.login] ?? null,
        publication: config.publicationByRun?.[repo.alias]?.[run.id] ?? null,
        lane: config.laneByWorkflow?.[repo.alias]?.[run.workflow_id] ?? 'unknown', jobs });
    }
  }
  result.collection.fetchedAt = new Date().toISOString();
  return result;
}

function ghGet(endpoint) {
  return JSON.parse(execFileSync('gh', ['api', '--method', 'GET', endpoint], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
}

export async function writePrivateEvidence(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(`${JSON.stringify(value, null, 2)}\n`); } finally { await file.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    requireField(['--source', '--collect', '--output', '--evidence-output'].includes(args[i]) && args[i + 1], 'arguments', 'use --source FILE or --collect CONFIG, with optional --output FILE / --evidence-output FILE');
    requireField(!options[args[i]], 'arguments', 'do not repeat options');
    options[args[i]] = resolve(args[i + 1]);
  }
  requireField(Boolean(options['--source']) !== Boolean(options['--collect']), 'arguments', 'provide exactly one explicit source or collection config');
  const sourcePath = options['--source'] ?? options['--collect'];
  requireField(![options['--output'], options['--evidence-output']].includes(sourcePath), 'output', 'output cannot overwrite input');
  const config = JSON.parse(await readFile(sourcePath, 'utf8'));
  const data = options['--collect'] ? await collectEvidence(config) : config;
  if (options['--collect']) {
    const path = options['--evidence-output'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../docs/agents/ci-cadence', `capture-${Date.now()}.json`);
    await writePrivateEvidence(path, data);
  } else requireField(!options['--evidence-output'], 'arguments', 'evidence-output is available only with collection');
  const report = measureCadence(data);
  if (options['--output']) await writePrivateEvidence(options['--output'], report);
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`cadence measurement: ${error.message}\n`); process.exitCode = 1; });
}
