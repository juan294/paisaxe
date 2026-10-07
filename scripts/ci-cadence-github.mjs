import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { validatePolicy, validateReceipt } from './ci-cadence.mjs';

const REPOSITORY = 'juan294/paisaxe';
const REPOSITORY_ID = 1141286326;
const OWNER_ID = 3944118;
const OWNER = 'juan294';
const PREFIX = `/repos/${REPOSITORY}`;
const ORIGIN = 'https://api.github.com';
const SHA = /^[a-f0-9]{40}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value > 0;
const ownerAccount = value => record(value) && value.login === OWNER && value.id === OWNER_ID && value.type === 'User';
// Actions embeds minimal repositories; supplied expanded fields must agree.
const repositoryIdentity = value => record(value) && value.full_name === REPOSITORY && value.id === REPOSITORY_ID && value.owner?.login === OWNER && value.owner?.id === OWNER_ID
  && (!Object.hasOwn(value.owner, 'type') || value.owner.type === 'User')
  && (!Object.hasOwn(value, 'default_branch') || value.default_branch === 'main')
  && (!Object.hasOwn(value, 'fork') || value.fork === false);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19) ? Date.parse(value) : NaN;
function nativeJobInterval(job, observedAt) {
  const started = date(job?.started_at); const completed = date(job?.completed_at);
  return Number.isFinite(observedAt) && Number.isFinite(started) && Number.isFinite(completed) && started <= completed && completed <= observedAt ? { started, completed } : undefined;
}
function nativeStepWithin(step, interval) {
  const started = date(step?.started_at); const completed = date(step?.completed_at);
  return Boolean(interval && Number.isFinite(started) && Number.isFinite(completed) && interval.started <= started && started <= completed && completed <= interval.completed);
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
class NativeReadError extends Error {}
const fail = code => { throw new NativeReadError(code); };
const safeError = error => error instanceof NativeReadError ? error.message : 'native response unavailable';
const failure = error => ({ available: false, error });
const DEFAULTS = { maxRequests: 180, maxPages: 10, maxAttempts: 3, maxBytes: 1_000_000, maxArchiveBytes: 200_000, timeoutMs: 10_000, totalTimeoutMs: 60_000 };
const identityFields = ['repository', 'sourceSha', 'targetBranch', 'baseSha', 'definitionSha', 'policyFingerprint', 'helperFingerprint', 'lockfileFingerprint', 'runtimeFingerprint'];

/** Caller must load policy/projection from immutable protected definitions.
 * API authentication binds native jobs/artifacts to runs, not arbitrary authors'
 * claims of checkout/fingerprint. Protected, reviewed uploaders supply that trust.
 * This unit accepts only one actual caller-projected full workflow; never fake
 * independent callee runs. Projection must identify both reviewed artifact
 * uploader jobs/steps; measurement upload must occur after app completion.
 * It performs no writes, reruns, artifact execution or CLI.
 */
export function createGitHubCadenceReader({ token, fetchImpl = fetch, limits = {}, now = () => new Date() } = {}) {
  const settings = { ...DEFAULTS, ...limits };
  const configured = typeof token === 'string' && token.length > 0 && token.length <= 4096 && !/[\r\n]/.test(token) && typeof fetchImpl === 'function' && typeof now === 'function' && Object.keys(limits).every(key => key in DEFAULTS) && Object.entries(settings).every(([key, value]) => integer(value) && value <= DEFAULTS[key]);
  const session = () => ({ requests: 0, started: performance.now(), stopError: null });
  function context(input) {
    if (!configured) fail('configuration unavailable');
    const { expected, policy, projection } = input ?? {};
    if (!validatePolicy(policy).valid || policy.repository !== REPOSITORY || policy.defaultBranch !== 'main' || policy.integrationBranch !== 'develop' || policy.productionBranch !== 'main' || !same(policy.owners, [OWNER]) || policy.workflows.length !== 1) fail('protected projected policy invalid');
    if (!record(expected) || expected.repository !== REPOSITORY || !SHA.test(expected.sourceSha ?? '') || !SHA.test(expected.definitionSha ?? '') || (expected.baseSha !== undefined && !SHA.test(expected.baseSha)) || !['develop', 'main'].includes(expected.targetBranch) || identityFields.some(field => field !== 'baseSha' && (typeof expected[field] !== 'string' || !expected[field]))) fail('expected immutable identity invalid');
    const workflow = policy.workflows[0];
    if (!record(projection) || projection.kind !== 'full' || !record(projection.jobs) || !record(projection.steps) || !record(projection.workflowPins) || !record(projection.workflowSources) || !Array.isArray(projection.referencedWorkflows) || projection.workflowPins[workflow.path] !== workflow.definitionSha || Object.entries(projection.workflowPins).some(([path, blob]) => !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(path) || !SHA.test(blob)) || typeof projection.admissionJob !== 'string' || !projection.admissionJob) fail('protected full projection invalid');
    if (!same(Object.keys(projection.workflowSources).sort(), Object.keys(projection.workflowPins).sort()) || Object.values(projection.workflowSources).some(commit => !SHA.test(commit)) || projection.workflowSources[workflow.path] !== expected.definitionSha || typeof projection.admissionStep !== 'string' || !projection.admissionStep) fail('protected definition sources invalid');
    if (projection.referencedWorkflows.some(entry => !record(entry) || !SHA.test(entry.sha ?? '') || !Object.keys(projection.workflowPins).some(path => path !== workflow.path && entry.path === `${REPOSITORY}/${path}@${entry.ref}` && entry.sha === projection.workflowSources[path]) || !/^refs\/heads\/(main|develop)$/.test(entry.ref ?? '')) || new Set(projection.referencedWorkflows.map(entry => entry.path)).size !== projection.referencedWorkflows.length || projection.referencedWorkflows.length !== Object.keys(projection.workflowPins).length - 1) fail('native callee reference projection invalid');
    const referencedPaths = projection.referencedWorkflows.map(entry => entry.path.slice(REPOSITORY.length + 1).split('@')[0]);
    if (!same(referencedPaths.sort(), Object.keys(projection.workflowPins).filter(path => path !== workflow.path).sort())) fail('native callee reference inventory incomplete');
    const ids = workflow.jobs.map(job => job.id);
    if (!same([...Object.keys(projection.jobs)].sort(), [...ids].sort()) || !same([...Object.keys(projection.steps)].sort(), [...ids].sort()) || new Set(Object.values(projection.jobs)).size !== ids.length) fail('projected native job inventory invalid');
    for (const id of ids) {
      const steps = projection.steps[id]; const ignored = projection.ignoredSteps?.[id] ?? [];
      if (typeof projection.jobs[id] !== 'string' || !projection.jobs[id] || !Array.isArray(steps) || !steps.length || !Array.isArray(ignored) || [...steps, ...ignored].some(step => typeof step !== 'string' || !step) || new Set([...steps, ...ignored]).size !== steps.length + ignored.length) fail('required application step inventory invalid');
    }
    if (Object.keys(workflow.contexts).some(name => !Object.values(projection.jobs).includes(name))) fail('context lacks native application job');
    if (typeof projection.measurementJob !== 'string' || !projection.measurementJob || typeof projection.measurementStep !== 'string' || !projection.measurementStep || (projection.measurementJob === projection.admissionJob && projection.measurementStep === projection.admissionStep)) fail('protected measurement uploader invalid');
    const measurementId = ids.find(id => projection.jobs[id] === projection.measurementJob);
    if (measurementId && !(projection.ignoredSteps?.[measurementId] ?? []).includes(projection.measurementStep)) fail('measurement step must be separately classified');
    const producerId = ids.find(id => projection.jobs[id] === projection.admissionJob);
    if (producerId && !(projection.ignoredSteps?.[producerId] ?? []).includes(projection.admissionStep)) fail('admission step must be separately classified');
    const auxiliary = projection.census?.auxiliaryJobs ?? [];
    const names = Object.values(projection.jobs).concat(projection.admissionJob, projection.measurementJob);
    const conclusions = values => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length && values.every(value => ['success', 'skipped'].includes(value));
    if (!Array.isArray(auxiliary) || auxiliary.length > 32 || new Set(auxiliary.map(job => job?.name)).size !== auxiliary.length
      || auxiliary.some(job => !record(job) || typeof job.name !== 'string' || !job.name || names.includes(job.name) || !conclusions(job.conclusions)
        || !Array.isArray(job.steps) || new Set(job.steps.map(step => step?.name)).size !== job.steps.length
        || job.steps.some(step => !record(step) || typeof step.name !== 'string' || !step.name || !conclusions(step.conclusions)))
      || (projection.census && (projection.census.schemaVersion !== 1 || !['nightly','develop_push'].includes(projection.census.profile)))) fail('protected auxiliary census invalid');
    return { expected, policy, projection, workflow };
  }
  async function request(path, state, binary = false) {
    // All paths are constructed internally from validated IDs/workflow names.
    if (!(path.startsWith(`${PREFIX}/actions/`) || new RegExp(`^${PREFIX}/contents/\\.github/workflows/[A-Za-z0-9_.-]+\\.ya?ml\\?ref=[a-f0-9]{40}$`).test(path)) || path.includes('..') || path.includes('#') || path.includes('\\')) fail('endpoint forbidden');
    if (state.stopError) fail(state.stopError);
    if (++state.requests > settings.maxRequests || performance.now() - state.started >= settings.totalTimeoutMs) fail('request budget exhausted');
    const controller = new AbortController();
    const remaining = Math.min(settings.timeoutMs, settings.totalTimeoutMs - (performance.now() - state.started));
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new NativeReadError('request deadline exceeded')); }, remaining); });
    const work = async () => {
      let response;
      try { response = await fetchImpl(`${ORIGIN}${path}`, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' } }); }
      catch { fail('native transport unavailable'); }
      const initialRate = response?.headers?.get('x-ratelimit-remaining');
      if (initialRate === null || initialRate === undefined || !/^\d+$/.test(initialRate) || !Number.isSafeInteger(Number(initialRate)) || Number(initialRate) < 100) { state.stopError = 'native rate limit unavailable'; fail(state.stopError); }
      if (binary && response instanceof Response && response.status === 302) {
        let target; try { target = new URL(response.headers.get('location')); } catch { fail('artifact redirect forbidden'); }
        if (target.protocol !== 'https:' || target.username || target.password || target.port || target.hash || !/^productionresultssa[0-9]+\.blob\.core\.windows\.net$/.test(target.hostname)) fail('artifact redirect forbidden');
        if (++state.requests > settings.maxRequests) fail('request budget exhausted');
        try { response = await fetchImpl(target.href, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/zip' } }); }
        catch { fail('artifact storage unavailable'); }
      }
      if (!(response instanceof Response) || response.status !== 200) fail('native HTTP unavailable');
      const cap = binary ? settings.maxArchiveBytes : settings.maxBytes;
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > cap)) fail('native body exceeds bound');
      if (!response.body) fail('native body missing');
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > cap) fail('native body exceeds bound'); chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = Buffer.concat(chunks);
      if (declared !== null && Number(declared) !== bytes.length) fail('native body length mismatch');
      if (binary) return { data: bytes, headers: response.headers };
      let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { fail('native JSON invalid'); }
      return { data, headers: response.headers };
    };
    try { return await Promise.race([work(), timeout]); }
    catch (error) { if (error instanceof NativeReadError) throw error; fail('native response unavailable'); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  async function pages(path, key, state, maxPages = settings.maxPages, visitRows) {
    const rows = []; const ids = new Set(); let total;
    try {
      for (let page = 1; page <= maxPages; page++) {
        const query = `${path}?per_page=100&page=${page}`;
        const { data, headers } = await request(query, state);
        if (!record(data) || !Number.isSafeInteger(data.total_count) || data.total_count < 0 || !Array.isArray(data[key]) || data[key].length > 100) fail('native page shape invalid');
        if (total !== undefined && total !== data.total_count) fail('native page total changed'); total = data.total_count;
        for (const row of data[key]) {
          if (!record(row) || !integer(row.id) || ids.has(row.id)) fail('native page duplicate or invalid identity'); ids.add(row.id); rows.push(row);
        }
        if (visitRows) await visitRows(data[key]);
        const link = headers.get('link');
        const nextLinks = [...(link ?? '').matchAll(/<([^>]+)>;\s*rel="next"/g)];
        if (nextLinks.length > 1 || (link && link.includes('next') && nextLinks.length !== 1)) fail('native pagination link invalid');
        if (nextLinks.length) {
          if (nextLinks[0][1] !== `${ORIGIN}${path}?per_page=100&page=${page + 1}` || !data[key].length || rows.length >= total) fail('native pagination link invalid');
          continue;
        }
        if (rows.length !== total || (key === 'workflow_runs' && total >= 1000)) fail('native pagination incomplete');
        return { rows, complete: true };
      }
      fail('native pagination cap reached');
    } catch (error) { return { rows, complete: false, error: safeError(error) }; }
  }
  function runIdentity(run, runId, attempt, c) {
    const { expected, policy, workflow } = c;
    if (!record(run) || run.id !== runId || run.run_attempt !== attempt || run.path !== workflow.path || !repositoryIdentity(run.repository) || !repositoryIdentity(run.head_repository) || !ownerAccount(run.actor) || (Object.hasOwn(run, 'triggering_actor') && !ownerAccount(run.triggering_actor)) || !integer(run.check_suite_id) || !same(run.referenced_workflows ?? [], c.projection.referencedWorkflows) || run.html_url !== `https://github.com/${REPOSITORY}/actions/runs/${runId}`) fail('native run identity mismatch');
    if (!['push', 'schedule'].includes(run.event) || !['completed', 'in_progress', 'queued'].includes(run.status) || (run.status === 'completed' ? !['success', 'failure', 'cancelled', 'timed_out', 'action_required'].includes(run.conclusion) : run.conclusion !== null)) fail('native measuring run ineligible');
    const branch = run.event === 'schedule' ? policy.defaultBranch : expected.targetBranch;
    const head = run.event === 'schedule' ? expected.definitionSha : expected.sourceSha;
    if (run.head_branch !== branch || run.head_sha !== head) fail('native source or default definition mismatch');
  }
  function artifactIdentity(artifact, run) {
    if (!record(artifact) || !integer(artifact.id) || artifact.expired !== false || !integer(artifact.size_in_bytes) || artifact.size_in_bytes > settings.maxArchiveBytes || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') || artifact.workflow_run?.head_repository_id !== run.head_repository.id || artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== run.head_sha || !Number.isFinite(date(artifact.created_at))) fail('native artifact provenance invalid');
  }
  async function artifactData(rows, name, filename, run, state) {
    const matches = rows.filter(row => row.name === name);
    if (matches.length !== 1) fail('native required artifact missing or duplicated');
    const listed = matches[0]; artifactIdentity(listed, run);
    const { data: actual } = await request(`${PREFIX}/actions/artifacts/${listed.id}`, state);
    artifactIdentity(actual, run);
    if (!same(actual, listed)) fail('native artifact metadata changed');
    const { data: bytes } = await request(`${PREFIX}/actions/artifacts/${listed.id}/zip`, state, true);
    if (bytes.length !== actual.size_in_bytes || `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== actual.digest) fail('native artifact digest mismatch');
    return { value: parseJsonArchive(bytes, filename, settings.maxArchiveBytes), id: actual.id, digest: actual.digest };
  }
  function evidenceIdentity(value, kind, run, c) {
    if (!record(value) || value.schemaVersion !== 1 || value.kind !== kind || value.runId !== run.id || value.attempt !== run.run_attempt || value.workflow !== c.workflow.path || (kind === 'ci-cadence-admission' && value.testedCheckoutSha !== c.expected.sourceSha) || identityFields.some(field => value[field] !== c.expected[field])) fail('artifact measured identity mismatch');
  }
  function childInventory(rows, run, c, observedAt) {
    const { projection } = c;
    const auxiliary = projection.census?.auxiliaryJobs ?? [];
    const names = [...new Set(Object.values(projection.jobs).concat(projection.admissionJob, projection.measurementJob, auxiliary.map(job => job.name)))];
    if (rows.length !== names.length || new Set(rows.map(job => job.name)).size !== rows.length || rows.some(job => !names.includes(job.name) || job.run_id !== run.id || job.run_attempt !== run.run_attempt)) fail('native child inventory mismatch');
    for (const native of rows) {
      const reviewed = auxiliary.find(job => job.name === native.name);
      if (native.status !== 'completed' || (reviewed ? !reviewed.conclusions.includes(native.conclusion) : native.conclusion !== 'success')) fail('native full child did not succeed');
      if (reviewed && (!Array.isArray(native.steps) || native.steps.length !== reviewed.steps.length || new Set(native.steps.map(step => step.name)).size !== native.steps.length
          || native.steps.some(step => { const expected = reviewed.steps.find(item => item.name === step.name); return !expected || step.status !== 'completed' || !expected.conclusions.includes(step.conclusion); }))) fail('native auxiliary step census mismatch');
    }
    return applicationInventory(rows, run, c, observedAt);
  }
  function applicationInventory(rows, run, c, observedAt) {
    const { projection, workflow } = c; const times = []; const jobs = {};
    for (const job of workflow.jobs) {
      const native = rows.find(row => row.name === projection.jobs[job.id]);
      if (!native || !Array.isArray(native.steps) || new Set(native.steps.map(step => step.number)).size !== native.steps.length || new Set(native.steps.map(step => step.name)).size !== native.steps.length) fail('native required steps missing or duplicated');
      const required = projection.steps[job.id]; const allowed = required.concat(projection.ignoredSteps?.[job.id] ?? []);
      if (native.steps.some(step => !integer(step.number) || !allowed.includes(step.name)) || required.some(name => !native.steps.some(step => step.name === name))) fail('native application step inventory mismatch');
      for (const step of native.steps.filter(step => required.includes(step.name))) {
        if (step.status !== 'completed' || step.conclusion !== 'success') fail('native application step did not succeed');
        if (!nativeStepWithin(step, nativeJobInterval(native, observedAt))) fail('native application step time invalid');
        times.push(date(step.completed_at));
      }
      if((projection.ignoredSteps?.[job.id]??[]).includes('Verify completed callable source checkout'))physicalCheckoutGuards(native,required,observedAt);
      jobs[job.id] = { result: native.conclusion, needs: job.needs };
    }
    return { jobs, completedAt: new Date(Math.max(...times)).toISOString() };
  }
  function physicalCheckoutGuards(job,required,observedAt) {
    const steps=required.map(name=>job.steps.find(step=>step.name===name));
    const before=job.steps.filter(step=>step.name==='Verify callable source checkout'),after=job.steps.filter(step=>step.name==='Verify completed callable source checkout');
    if(before.length!==1||after.length!==1||[before[0],after[0]].some(step=>step.status!=='completed'||step.conclusion!=='success'||!nativeStepWithin(step,nativeJobInterval(job,observedAt)))
      ||date(before[0].completed_at)>Math.min(...steps.map(step=>date(step.started_at)))||date(after[0].started_at)<Math.max(...steps.map(step=>date(step.completed_at))))fail('measurement physical app checkout guards unavailable or unordered');
  }
  function validateUploader(rows, run, jobName, stepName, metadata, observedAt, postAfter) {
    const producers = rows.filter(job => job.name === jobName);
    if (producers.length !== 1) fail('protected artifact producer missing or duplicated');
    const producer = producers[0];
    const matching = Array.isArray(producer.steps) ? producer.steps.filter(step => record(step) && step.name === stepName) : [];
    const step = matching[0];
    if (producer.run_id !== run.id || producer.run_attempt !== run.run_attempt || producer.status !== 'completed' || matching.length !== 1 || !integer(step.number) || step.status !== 'completed' || step.conclusion !== 'success' || !nativeStepWithin(step, nativeJobInterval(producer, observedAt))) fail('protected artifact upload step did not succeed');
    const created = date(metadata?.created_at);
    if (!Number.isFinite(created) || created < date(step.started_at) || created > date(step.completed_at)) fail('artifact upload attribution mismatch');
    if (postAfter !== undefined && (producer.conclusion !== 'success' || date(step.started_at) < date(postAfter))) fail('measurement upload did not follow application completion');
    return { producer, step };
  }
  function applicationEvidence(rows, run, c, observedAt) {
    const completed = []; let malformed = false; let observedFailure;
    const negative = ['failure', 'cancelled', 'timed_out', 'action_required'];
    for (const [id, name] of Object.entries(c.projection.jobs)) {
      for (const job of rows.filter(row => row.name === name)) {
        if (job.run_id !== run.id || job.run_attempt !== run.run_attempt) { malformed = true; continue; }
        if (negative.includes(job.conclusion) && !observedFailure) observedFailure = { jobId: job.id, jobName: name, conclusion: job.conclusion };
        if (!Array.isArray(job.steps)) { malformed = true; continue; }
        for (const step of job.steps) {
          if (!record(step)) { malformed = true; continue; }
          if (!c.projection.steps[id].includes(step.name)) continue;
          if (negative.includes(step.conclusion) && !observedFailure) observedFailure = { jobId: job.id, jobName: name, stepName: step.name, stepNumber: step.number, conclusion: step.conclusion };
          const time = date(step.completed_at);
          if (nativeStepWithin(step, nativeJobInterval(job, observedAt))) completed.push(time);
          else malformed = true;
        }
      }
    }
    return { completed, malformed, observedFailure };
  }
  function failureEvidence(base, run, scan, uploadStep, provenance) {
    // Preserve source/run/attempt and original parent result even when a parent
    // masks failed app work. Malformed children cannot erase authenticated failure.
    const useApplicationTime = !scan.malformed && scan.completed.length > 0;
    const completedAt = new Date(useApplicationTime ? Math.max(...scan.completed) : date(uploadStep.completed_at)).toISOString();
    return { ...base, kind: 'native-failure-evidence', nativeConclusion: run.conclusion, conclusion: run.conclusion === 'success' ? scan.observedFailure.conclusion : run.conclusion, ...(scan.observedFailure ? { observedFailure: scan.observedFailure } : {}), completedAt, failureTimeSource: useApplicationTime ? 'application-step' : 'admission-uploader', provenance };
  }
  async function inspect(input, state) {
    const c = context(input); const { runId, attempt } = input;
    if (!integer(runId) || !integer(attempt) || attempt > settings.maxAttempts) fail('native run or attempt invalid');
    const { data: run } = await request(`${PREFIX}/actions/runs/${runId}/attempts/${attempt}`, state);
    runIdentity(run, runId, attempt, c);
    const requireWorkflowBlob = async (path, commit, blob) => {
      const { data: definition } = await request(`${PREFIX}/contents/${path}?ref=${commit}`, state);
      if (definition?.type !== 'file' || definition.path !== path || definition.sha !== blob) fail('native immutable workflow blob mismatch');
    };
    for (const [path, blob] of Object.entries(c.projection.workflowPins)) await requireWorkflowBlob(path, c.projection.workflowSources[path], blob);
    // BEFORE retains helper/policy authority, but native push executes its root
    // caller at AFTER. Authenticate that actual caller before trusting uploaders.
    // Schedule already binds native head to the protected default definition.
    if (run.event === 'push') await requireWorkflowBlob(c.workflow.path, run.head_sha, c.workflow.definitionSha);
    const artifacts = await pages(`${PREFIX}/actions/runs/${runId}/artifacts`, 'artifacts', state, Math.min(2, settings.maxPages));
    const admission = await artifactData(artifacts.rows, 'ci-cadence-admission', 'admission.json', run, state);
    evidenceIdentity(admission.value, 'ci-cadence-admission', run, c);
    if (!['full', 'nightly', 'release'].includes(admission.value.lane) || (run.event === 'schedule' && admission.value.lane !== 'nightly') || admission.value.workflowDefinitionSha !== c.workflow.definitionSha || !same(admission.value.workflowPins, c.projection.workflowPins) || !same(admission.value.jobs, c.workflow.jobs) || !same(admission.value.contexts, c.workflow.contexts)) fail('protected admission graph or fingerprints mismatch');
    const nativeJobs = await pages(`${PREFIX}/actions/runs/${runId}/attempts/${attempt}/jobs`, 'jobs', state, Math.min(3, settings.maxPages));
    const observedAt = now().getTime();
    const base = { schemaVersion: 1, ...Object.fromEntries(identityFields.filter(field => c.expected[field] !== undefined).map(field => [field, c.expected[field]])), workflow: c.workflow.path, workflowDefinitionSha: c.workflow.definitionSha, runId, attempt, lane: admission.value.lane, conclusion: run.conclusion, nativeEvent: run.event, nativeHeadSha: run.head_sha, nativeWorkflowBranch: run.head_branch, workflowRef: `${REPOSITORY}/${c.workflow.path}@refs/heads/${run.head_branch}`, testedCheckoutSha: c.expected.sourceSha, runUrl: run.html_url };
    const admissionMetadata = artifacts.rows.find(row => row.id === admission.id);
    const { step: uploadStep } = validateUploader(nativeJobs.rows, run, c.projection.admissionJob, c.projection.admissionStep, admissionMetadata, observedAt);
    const provenance = { admissionArtifactId: admission.id, admissionDigest: admission.digest };
    if (run.status !== 'completed') return { available: false, error: 'matching native suite in-progress', knownRunning: { ...base, kind: 'native-running-evidence', completedAt: uploadStep.completed_at, provenance }, provenance };
    const scan = applicationEvidence(nativeJobs.rows, run, c, observedAt);
    if (run.conclusion !== 'success' || scan.observedFailure) {
      const available = artifacts.complete && nativeJobs.complete && !scan.malformed && run.conclusion !== 'success';
      const error = artifacts.error ?? nativeJobs.error ?? (scan.malformed ? 'native application evidence malformed' : run.conclusion === 'success' ? 'native parent masked application failure' : undefined);
      return { available, ...(error ? { error } : {}), knownFailed: failureEvidence(base, run, scan, uploadStep, provenance), provenance };
    }
    if (!artifacts.complete) fail(artifacts.error);
    if (!nativeJobs.complete) fail(nativeJobs.error);
    const admissionTime = date(uploadStep.completed_at);
    const applicationStarts = nativeJobs.rows.flatMap(job => {
      const id = Object.keys(c.projection.jobs).find(key => c.projection.jobs[key] === job.name);
      return id ? (job.steps ?? []).filter(step => c.projection.steps[id].includes(step.name)).map(step => date(step.started_at)) : [];
    });
    if (!Number.isFinite(admissionTime) || !applicationStarts.length || applicationStarts.some(time => !Number.isFinite(time) || time < admissionTime)) fail('admission did not precede application work');
    const inventory = childInventory(nativeJobs.rows, run, c, observedAt);
    const measured = await artifactData(artifacts.rows, 'ci-cadence-measurement', 'measurement.json', run, state);
    evidenceIdentity(measured.value, 'ci-cadence-measurement', run, c);
    const measurementMetadata = artifacts.rows.find(row => row.id === measured.id);
    validateUploader(nativeJobs.rows, run, c.projection.measurementJob, c.projection.measurementStep, measurementMetadata, observedAt, inventory.completedAt);
    const appJobs = nativeJobs.rows.filter(job => Object.values(c.projection.jobs).includes(job.name));
    if (measured.value.failing !== 0 || !record(measured.value.checkouts) || !same(Object.keys(measured.value.checkouts).sort(), appJobs.map(job => String(job.id)).sort()) || appJobs.some(job => measured.value.checkouts[job.id] !== c.expected.sourceSha)) fail('actual application checkout proof unavailable');
    const contexts = Object.fromEntries(Object.keys(c.workflow.contexts).map(name => [name, nativeJobs.rows.find(job => job.name === name)?.conclusion]));
    const receipt = { ...base, ...inventory, contexts };
    if (!validateReceipt(receipt, c.expected, c.policy).valid) fail('frozen full receipt validation failed');
    return { available: true, receipt, measurement: structuredClone(measured.value), provenance: { admissionArtifactId: admission.id, admissionDigest: admission.digest, measurementArtifactId: measured.id, measurementDigest: measured.digest } };
  }
  return {
    async readRun(input) {
      try { return await inspect(input, session()); } catch (error) { return failure(safeError(error)); }
    },
    /** Standalone default coverage refresh is deliberately not a full receipt.
     * Protected exact uploader bytes and native original completion authorize
     * metrics; this result cannot enter collectHistory or nightly dedup. */
    async readStandaloneCoverage({runId,attempt,sourceSha,workflowPin,stepInventory}) {
      const state=session();
      try {
        if(!configured||!integer(runId)||!integer(attempt)||attempt>settings.maxAttempts||!SHA.test(sourceSha??'')||!SHA.test(workflowPin??'')||!Array.isArray(stepInventory)||!stepInventory.length||new Set(stepInventory.map(s=>s?.name)).size!==stepInventory.length||stepInventory.some(s=>!record(s)||typeof s.name!=='string'||!s.name||!Array.isArray(s.conclusions)||!s.conclusions.length||s.conclusions.some(c=>!['success','skipped'].includes(c))))fail('standalone coverage protected inventory invalid');
        const path='.github/workflows/coverage.yml';
        const {data:run}=await request(`${PREFIX}/actions/runs/${runId}/attempts/${attempt}`,state);
        if(!record(run)||run.id!==runId||run.run_attempt!==attempt||run.path!==path||!repositoryIdentity(run.repository)||!repositoryIdentity(run.head_repository)||!ownerAccount(run.actor)||(Object.hasOwn(run,'triggering_actor')&&!ownerAccount(run.triggering_actor))||!integer(run.check_suite_id)||!['push','schedule','workflow_dispatch'].includes(run.event)||run.status!=='completed'||run.conclusion!=='success'||run.head_branch!=='main'||run.head_sha!==sourceSha||!same(run.referenced_workflows??[],[])||run.html_url!==`https://github.com/${REPOSITORY}/actions/runs/${runId}`)fail('standalone coverage original completion invalid');
        const {data:definition}=await request(`${PREFIX}/contents/${path}?ref=${sourceSha}`,state);
        if(definition?.type!=='file'||definition.path!==path||definition.sha!==workflowPin)fail('standalone coverage executed root changed');
        const census=await pages(`${PREFIX}/actions/runs/${runId}/attempts/${attempt}/jobs`,'jobs',state,Math.min(3,settings.maxPages));
        if(!census.complete||census.rows.length!==1)fail('standalone coverage job census incomplete');
        const job=census.rows[0],observedAt=now().getTime();
        if(job.name!=='Coverage report'||job.run_id!==runId||job.run_attempt!==attempt||job.status!=='completed'||job.conclusion!=='success'||!nativeJobInterval(job,observedAt)||!Array.isArray(job.steps)||new Set(job.steps.map(s=>s?.name)).size!==job.steps.length)fail('standalone coverage job invalid');
        const transport=['Set up job','Complete job',...stepInventory.filter(s=>s.post).map(s=>'Post '+s.name)];
        for(const step of job.steps){const expected=stepInventory.find(s=>s.name===step.name);if(!expected&&!transport.includes(step.name)||step.status!=='completed'||!nativeStepWithin(step,nativeJobInterval(job,observedAt))||(expected?!expected.conclusions.includes(step.conclusion):step.conclusion!=='success'))fail('standalone coverage native step invalid');}
        if(stepInventory.some(s=>!job.steps.some(actual=>actual.name===s.name)))fail('standalone coverage required step missing');
        const measured=job.steps.find(s=>s.name==='Run authoritative coverage suite');
        if(measured.conclusion==='skipped'){
          const created=date(run.created_at);
          if(run.event!=='schedule'||!Number.isFinite(created)||new Date(created).getUTCDay()===1||job.steps.filter(s=>s.name!=='Decide weekly native coverage eligibility'&&!transport.includes(s.name)).some(s=>s.conclusion!=='skipped'))fail('standalone coverage unexplained app skip');
          const artifacts=await pages(`${PREFIX}/actions/runs/${runId}/artifacts`,'artifacts',state,Math.min(2,settings.maxPages));
          if(!artifacts.complete||artifacts.rows.some(a=>a.name==='ci-cadence-coverage'))fail('standalone skip carried measured artifact');
          return{available:true,scope:'coverage-only',reusable:false,publishCoverage:false,unchangedSkip:true,run};
        }
        physicalCheckoutGuards(job,['Run authoritative coverage suite'],observedAt);
        const artifacts=await pages(`${PREFIX}/actions/runs/${runId}/artifacts`,'artifacts',state,Math.min(2,settings.maxPages));
        if(!artifacts.complete)fail('standalone coverage artifact census incomplete');
        const artifact=await artifactData(artifacts.rows,'ci-cadence-coverage','application.json',run,state);
        validateUploader([job],run,'Coverage report','Upload measured standalone coverage',artifacts.rows.find(row=>row.id===artifact.id),observedAt,measured.completed_at);
        const value=artifact.value,m=value?.metrics,e=value?.evidence;
        if(!record(m)||!record(e)||!['testCount','testFiles','passed','failed'].every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)||m.testCount<1||m.testFiles<1||m.passed!==m.testCount||m.failed!==0||!Number.isFinite(m.coverage)||m.coverage<0||m.coverage>100||e.candidateSha!==sourceSha||!SHA.test(e.treeSha??'')||e.platform!=='linux'||e.architecture!=='x64'||!/^v24\./.test(e.nodeVersion??'')||['testsSha256','coverageSha256','exitSha256'].some(k=>!/^[a-f0-9]{64}$/.test(e[k]??'')))fail('standalone coverage measured metrics invalid');
        return{available:true,scope:'coverage-only',reusable:false,publishCoverage:true,run,application:value,coverage:{...m,sourceCommitSha:sourceSha,sourceReportedAt:new Date(date(measured.completed_at)).toISOString(),sourceTargetBranch:'main',coverageRunId:runId,coverageRunAttempt:attempt,coverageWorkflowRef:`${REPOSITORY}/${path}@refs/heads/main`}};
      }catch(error){return failure(safeError(error));}
    },
    async readAdmissionHint({ runId, attempt, workflow }) {
      const state = session();
      try {
        if (!configured || !integer(runId) || !integer(attempt) || attempt > settings.maxAttempts || !['.github/workflows/ci-cadence.yml','.github/workflows/ci-nightly.yml', '.github/workflows/ci.yml', '.github/workflows/coverage.yml'].includes(workflow)) fail('admission hint pointer invalid');
        const { data: run } = await request(`${PREFIX}/actions/runs/${runId}/attempts/${attempt}`, state);
        if (!record(run) || run.id !== runId || run.run_attempt !== attempt || run.path !== workflow || !repositoryIdentity(run.repository) || !repositoryIdentity(run.head_repository) || !ownerAccount(run.actor)
            || (Object.hasOwn(run, 'triggering_actor') && !ownerAccount(run.triggering_actor)) || !['push', 'schedule'].includes(run.event) || !SHA.test(run.head_sha ?? '') || !['main', 'develop'].includes(run.head_branch)) fail('admission hint native pointer mismatch');
        const artifacts = await pages(`${PREFIX}/actions/runs/${runId}/artifacts`, 'artifacts', state, Math.min(2, settings.maxPages));
        if (!artifacts.complete) fail('admission hint census incomplete');
        const admission = await artifactData(artifacts.rows, 'ci-cadence-admission', 'admission.json', run, state);
        // Artifact authenticity is not uploader/classification authority. The
        // protected caller MUST rebuild every expected fingerprint/projection
        // and run readRun before using this solely as an immutable lookup hint.
        return { available: true, trusted: false, kind: 'untrusted-admission-hint', run, value: admission.value,
          provenance: { admissionArtifactId: admission.id, admissionDigest: admission.digest } };
      } catch (error) { return failure(safeError(error)); }
    },
    async readMeasurementInputs(input) {
      const state = session();
      try {
        const c = context(input);
        const admitted = await inspect(input, state);
        if (!admitted.knownRunning) fail('measurement requires original in-progress admitted attempt');
        const { data: run } = await request(`${PREFIX}/actions/runs/${input.runId}/attempts/${input.attempt}`, state);
        runIdentity(run, input.runId, input.attempt, c);
        if (run.status !== 'in_progress' || run.conclusion !== null) fail('measurement original attempt no longer in-progress');
        const artifacts = await pages(`${PREFIX}/actions/runs/${run.id}/artifacts`, 'artifacts', state, Math.min(2, settings.maxPages));
        if (!artifacts.complete || artifacts.rows.filter(row => row.name === 'ci-cadence-admission').length !== 1
            || artifacts.rows.find(row => row.name === 'ci-cadence-admission')?.id !== admitted.provenance.admissionArtifactId) fail('measurement admission census incomplete or changed');
        const census = await pages(`${PREFIX}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs', state, Math.min(3, settings.maxPages));
        if (!census.complete || new Set(census.rows.map(job => job.name)).size !== census.rows.length) fail('measurement native jobs incomplete or duplicated');
        const names = Object.values(c.projection.jobs), rows = census.rows.filter(job => names.includes(job.name));
        if (rows.length !== names.length || rows.some(job => job.run_id !== run.id || job.run_attempt !== run.run_attempt || job.status !== 'completed' || job.conclusion !== 'success')) fail('measurement required app child did not succeed');
        const observedAt = now().getTime(), inventory = applicationInventory(rows, run, c, observedAt);
        for (const job of rows) {
          const id=Object.keys(c.projection.jobs).find(id=>c.projection.jobs[id]===job.name);
          physicalCheckoutGuards(job,c.projection.steps[id],observedAt);
        }
        return { available: true, scope: 'measurement-inputs', run, completedAt: inventory.completedAt,
          checkouts: Object.fromEntries(rows.map(job => [String(job.id), c.expected.sourceSha])), provenance: admitted.provenance };
      } catch (error) { return failure(safeError(error)); }
    },
    /** Resolve each real caller/BEFORE identity through protected controller
     * code. JSON hints never choose imports or rewrite a measuring workflow. */
    async collectCompatibleHistory({head,runId:currentId,attempt:currentAttempt,resolveState}) {
      const state=session(),entries=[],nonmeasuring=[];let complete=true,error;
      try{
        if(!configured||!record(head)||!SHA.test(head.sourceSha??'')||!SHA.test(head.definitionSha??'')||typeof resolveState!=='function')fail('compatible history control unavailable');
        for(const workflow of ['.github/workflows/ci-nightly.yml','.github/workflows/ci-cadence.yml']){
          const listing=await pages(`${PREFIX}/actions/workflows/${encodeURIComponent(workflow.split('/').at(-1))}/runs`,'workflow_runs',state,settings.maxPages,async rows=>{
            for(const listed of rows){
              if(!integer(listed.run_attempt)||listed.run_attempt>settings.maxAttempts){complete=false;error='compatible attempt history incomplete';continue;}
              for(let attempt=1;attempt<=listed.run_attempt;attempt++){
                try{
                  const {data:run}=await request(`${PREFIX}/actions/runs/${listed.id}/attempts/${attempt}`,state);
                  if(!record(run)||run.id!==listed.id||run.run_attempt!==attempt||run.path!==workflow||!repositoryIdentity(run.repository)||!repositoryIdentity(run.head_repository)||!ownerAccount(run.actor)||(Object.hasOwn(run,'triggering_actor')&&!ownerAccount(run.triggering_actor))||!integer(run.check_suite_id)||!SHA.test(run.head_sha??'')||!['push','schedule'].includes(run.event)||!['main','develop'].includes(run.head_branch)||!['completed','in_progress','queued'].includes(run.status)||run.html_url!==`https://github.com/${REPOSITORY}/actions/runs/${listed.id}`)fail('compatible original pointer invalid');
                  if(run.id===currentId&&attempt===currentAttempt){if(run.status!=='in_progress'||run.conclusion!==null)fail('current compatible invocation changed');continue;}
                  // A verified different push head is a different input; no
                  // matching failure or successful receipt is erased here.
                  if(run.event==='push'&&run.head_sha!==head.sourceSha)continue;
                  const artifacts=await pages(`${PREFIX}/actions/runs/${run.id}/artifacts`,'artifacts',state,Math.min(2,settings.maxPages));
                  if(!artifacts.complete)fail('compatible artifact census incomplete');
                  const admissions=artifacts.rows.filter(a=>a.name==='ci-cadence-admission');
                  if(admissions.length===0){
                    const reviewed=await resolveState({definitionSha:head.definitionSha,sourceSha:head.sourceSha,callerPath:workflow,runId:run.id,attempt});
                    const c=context(reviewed),{data:definition}=await request(`${PREFIX}/contents/${workflow}?ref=${run.head_sha}`,state);
                    if(definition?.type!=='file'||definition.path!==workflow||definition.sha!==c.workflow.definitionSha||run.status!=='completed'||run.conclusion!=='success')fail('nonmeasuring caller authority unavailable');
                    const jobs=await pages(`${PREFIX}/actions/runs/${run.id}/attempts/${attempt}/jobs`,'jobs',state,Math.min(3,settings.maxPages));
                    if(!jobs.complete||!jobs.rows.length||new Set(jobs.rows.map(j=>j.name)).size!==jobs.rows.length||jobs.rows.some(j=>j.run_id!==run.id||j.run_attempt!==attempt||j.status!=='completed'))fail('nonmeasuring original census unavailable');
                    const admission=jobs.rows.find(j=>j.name==='Cadence admission'),measurement=jobs.rows.find(j=>j.name==='Cadence measurement');
                    const disposition=jobs.rows.find(j=>j.name===(workflow.includes('nightly')?'Nightly disposition':'CI Fast'));
                    if(!admission||!measurement||!disposition||disposition.conclusion!=='success'||measurement.conclusion!=='skipped'||admission.conclusion!==(workflow.includes('nightly')?'success':'skipped')||jobs.rows.filter(j=>![admission,measurement,disposition].includes(j)&&!j.name.startsWith('entry / ')).some(j=>j.conclusion!=='skipped')||artifacts.rows.some(a=>a.name==='ci-cadence-measurement'))fail('unexplained missing measuring admission');
                    if(workflow.includes('ci-cadence')){const entry=jobs.rows.filter(j=>j.name==='CI Fast');if(entry.length!==1||entry[0].conclusion!=='success'||!entry[0].steps?.some(s=>s.name==='Acquire reviewed protected launcher'&&s.status==='completed'&&s.conclusion==='success'))fail('nonmeasuring Fast entry unavailable');}
                    nonmeasuring.push({runId:run.id,attempt,workflow});
                    continue; // authenticated original nonmeasuring disposition
                  }
                  if(admissions.length!==1)fail('compatible admission duplicated');
                  const hint=await artifactData(artifacts.rows,'ci-cadence-admission','admission.json',run,state);
                  if(!SHA.test(hint.value.definitionSha??'')||!SHA.test(hint.value.sourceSha??''))fail('compatible immutable lookup malformed');
                  const resolved=await resolveState({definitionSha:hint.value.definitionSha,sourceSha:hint.value.sourceSha,callerPath:workflow,runId:run.id,attempt});
                  const c=context(resolved);
                  if(c.expected.policyFingerprint!==head.policyFingerprint||c.expected.helperFingerprint!==head.helperFingerprint||c.expected.runtimeFingerprint!==head.runtimeFingerprint)fail('compatible protected input changed');
                  const result=await inspect({...resolved,runId:run.id,attempt},state);
                  if(!result.available&&!result.knownRunning&&!result.knownFailed)fail(result.error??'compatible original evidence incomplete');
                  if(result.receipt||result.knownFailed||result.knownRunning)entries.push({expected:c.expected,policy:c.policy,receipt:result.receipt??result.knownFailed??result.knownRunning});
                  if(!result.available&&!result.knownRunning){complete=false;error=result.error??'compatible original evidence partial';}
                }catch(caught){complete=false;error=safeError(caught);}
              }
            }
          });
          complete=complete&&listing.complete;if(listing.error)error=listing.error;
        }
        return{available:complete,complete,entries,nonmeasuring,...(error?{error}:{})};
      }catch(caught){return{available:false,complete:false,entries,nonmeasuring,error:safeError(caught)};}
    },
    async collectHistory(input) {
      const state = session(); const receipts = []; let complete = true; let error;
      try {
        const c = context(input);
        if (input.workflow !== c.workflow.path) fail('history workflow mismatch');
        const visitRuns = async rows => {
          for (const run of rows) {
            if (state.stopError) break;
            if (!integer(run.run_attempt) || run.run_attempt > settings.maxAttempts) { complete = false; error = 'attempt history incomplete'; continue; }
            let omitCurrent=false;
            if(run.id===input.runId){
              // The original caller has no admission artifact yet. Omit only
              // this independently authenticated current execution, not an
              // arbitrary ID or prior failed/completed attempt from history.
              try{
                if(!integer(input.attempt)||input.attempt!==run.run_attempt)fail('current history attempt mismatch');
                const {data:current}=await request(`${PREFIX}/actions/runs/${run.id}/attempts/${input.attempt}`,state);
                runIdentity(current,run.id,input.attempt,c);
                if(current.status!=='in_progress'||current.conclusion!==null)fail('current history execution not in-progress');
                omitCurrent=true;
              }catch(caught){complete=false;error=safeError(caught);}
            }
            for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
              if(omitCurrent&&attempt===input.attempt)continue;
              if (state.stopError) break;
              try {
                const result = await inspect({ ...input, runId: run.id, attempt }, state);
                if (!result.available) { complete = false; error = result.error ?? 'native child history incomplete'; }
                if (result.receipt) receipts.push(result.receipt);
                if (result.knownFailed) receipts.push(result.knownFailed);
                if (result.knownRunning) receipts.push(result.knownRunning);
              } catch (caught) { complete = false; error = safeError(caught); }
            }
          }
        };
        // Authenticate each observed page before any later history request can
        // exhaust the session. A subsequent page failure never erases this proof.
        const listing = await pages(`${PREFIX}/actions/workflows/${encodeURIComponent(c.workflow.path.split('/').at(-1))}/runs`, 'workflow_runs', state, settings.maxPages, visitRuns);
        complete = complete && listing.complete;
        if (listing.error) error = listing.error;
        return { available: complete, complete, receipts, ...(error ? { error } : {}) };
      } catch (caught) { return { available: false, complete: false, receipts, error: safeError(caught) }; }
    },
  };
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function parseJsonArchive(bytes, filename, cap) {
  try {
    if (bytes.length < 98) fail('artifact ZIP invalid');
    const end = bytes.length - 22;
    if (bytes.readUInt32LE(end) !== 0x06054b50 || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0 || bytes.readUInt16LE(end + 8) !== 1 || bytes.readUInt16LE(end + 10) !== 1 || bytes.readUInt16LE(end + 20) !== 0) fail('artifact ZIP entry inventory invalid');
    const central = bytes.readUInt32LE(end + 16); const centralSize = bytes.readUInt32LE(end + 12);
    if (central + centralSize !== end || bytes.readUInt32LE(central) !== 0x02014b50) fail('artifact ZIP central directory invalid');
    const flags = bytes.readUInt16LE(central + 8); const method = bytes.readUInt16LE(central + 10); const compressed = bytes.readUInt32LE(central + 20); const size = bytes.readUInt32LE(central + 24); const nameSize = bytes.readUInt16LE(central + 28); const extra = bytes.readUInt16LE(central + 30); const comment = bytes.readUInt16LE(central + 32);
    if ((flags & ~0x808) !== 0 || ![0, 8].includes(method) || size > cap || compressed > cap || bytes.readUInt32LE(central + 42) !== 0 || bytes.readUInt16LE(central + 34) !== 0 || 46 + nameSize + extra + comment !== centralSize || bytes.readUInt32LE(0) !== 0x04034b50) fail('artifact ZIP layout forbidden');
    const name = bytes.subarray(central + 46, central + 46 + nameSize).toString('utf8');
    const descriptor = Boolean(flags & 8); const crc = bytes.readUInt32LE(central + 16);
    if (name !== filename || bytes.readUInt16LE(6) !== flags || bytes.readUInt16LE(8) !== method) fail('artifact ZIP filename or header mismatch');
    if ([ [18, compressed], [22, size], [14, crc] ].some(([offset, expected]) => bytes.readUInt32LE(offset) !== expected && (!descriptor || bytes.readUInt32LE(offset) !== 0))) fail('artifact ZIP sizes or CRC mismatch');
    const localNameSize = bytes.readUInt16LE(26); const localExtra = bytes.readUInt16LE(28); const start = 30 + localNameSize + localExtra;
    const descriptorStart = start + compressed;
    if (bytes.subarray(30, 30 + localNameSize).toString('utf8') !== filename) fail('artifact ZIP filename mismatch');
    if (descriptor) {
      const signed = bytes.readUInt32LE(descriptorStart) === 0x08074b50; const offset = descriptorStart + (signed ? 4 : 0);
      if (offset + 12 !== central || bytes.readUInt32LE(offset) !== crc || bytes.readUInt32LE(offset + 4) !== compressed || bytes.readUInt32LE(offset + 8) !== size) fail('artifact ZIP descriptor invalid');
    } else if (descriptorStart !== central) fail('artifact ZIP hidden or overlapping content');
    const payload = bytes.subarray(start, start + compressed);
    const inflated = method === 8 ? inflateRawSync(payload, { maxOutputLength: cap, info: true }) : undefined;
    if (inflated && inflated.engine.bytesWritten !== compressed) fail('artifact ZIP trailing compressed content');
    const data = inflated ? inflated.buffer : payload;
    if (data.length !== size || crc32(data) !== bytes.readUInt32LE(central + 16)) fail('artifact ZIP payload invalid');
    const value = JSON.parse(data.toString('utf8')); if (!record(value)) fail('artifact JSON object missing'); return value;
  } catch { fail('artifact JSON archive invalid'); }
}
