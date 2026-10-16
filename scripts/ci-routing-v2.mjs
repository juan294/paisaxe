// Sutura automatic routing v2. Execute only the copy extracted from the
// protected base. Verification amount never grants credentials or deployment.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && value !== '0'.repeat(40);
const numericId = value => Number.isSafeInteger(value) && value > 0;

/** Conservative closure: include every workflow/action, rather than trying to
 * parse candidate YAML to decide which newly added call can be skipped. */
export function controlPath(path) {
  return /(?:^|\/)[^/]+\.config\.[^/]+$/.test(path) || /(?:^|\/)(?:\.npmrc|vercel.json|turbo.json|nx.json|next-env.d.ts|action.yml|action.yaml)$/.test(path) || /^\.github\//.test(path) || /(?:^|\/)(?:scripts|supabase)\//.test(path)
    || /(?:^|\/)(?:package(?:-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lockb?|pyproject\.toml|uv\.lock|poetry\.lock|requirements[^/]*\.txt|\.nvmrc|\.node-version|\.python-version|\.tool-versions|Dockerfile[^/]*|docker-compose[^/]*|tsconfig[^/]*\.json|vitest\.config\.[^/]+|pytest\.ini)$/.test(path);
}

export function planVerification({ policy, context, identity, changedPaths, installed = true }) {
  if (!policy || ![1, 2].includes(policy.schemaVersion) || typeof policy.repository !== 'string'
    || !/^[\w.-]+\/[\w.-]+$/.test(policy.repository) || !numericId(policy.ownerId)
    || !Array.isArray(policy.owners) || !policy.owners.length || policy.owners.some(owner => typeof owner !== 'string' || !owner)
    || typeof policy.integrationBranch !== 'string' || !policy.integrationBranch
    || typeof policy.productionBranch !== 'string' || !policy.productionBranch
    || policy.productionBranch === policy.integrationBranch) throw new Error('invalid protected routing policy');
  if (!context || context.repository !== policy.repository || !numericId(context.repositoryId)) throw new Error('native repository identity does not match protected policy');
  if (!identity || !['sourceSha', 'baseSha', 'testedSha', 'definitionSha'].every(key => sha(identity[key]))
    || identity.definitionSha !== identity.baseSha) throw new Error('invalid protected base/source/checkout identity');
  if (!Array.isArray(changedPaths) || changedPaths.some(path => typeof path !== 'string' || !path)) throw new Error('complete changed-path inventory required');
  const owner = policy.owners.includes(context.actor) && String(context.actorId) === String(policy.ownerId)
    && (context.eventName !== 'pull_request' || (policy.owners.includes(context.author) && context.authorId === policy.ownerId
      && context.headRepository === policy.repository && context.headRepositoryId === context.repositoryId));
  const production = context.ref === `refs/heads/${policy.productionBranch}` || context.baseRef === policy.productionBranch;
  const integration = context.eventName === 'push' ? context.ref === `refs/heads/${policy.integrationBranch}` : context.baseRef === policy.integrationBranch;
  const reason = !installed ? 'installation-missing' : production ? 'production' : !owner ? 'untrusted'
    : !['push', 'pull_request'].includes(context.eventName) ? 'explicit-full'
      : !integration ? 'other-branch' : changedPaths.some(controlPath) ? 'control-change' : 'owner-integration';
  return { schemaVersion: 2, full: reason !== 'owner-integration', reason, trust: owner ? 'owner' : 'untrusted',
    identity: { ...identity }, allowPrivileged: false, allowDeploy: false };
}

function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, env, encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Native payload and physical Git checkout agree before any cheap route. */
export function inspectCheckout({ root, native, base }) {
  if (!sha(base)) throw new Error('protected base commit required');
  const testedSha = git(root, ['rev-parse', '--verify', 'HEAD']);
  if (!sha(native.sha) || native.sha !== testedSha) throw new Error('native checkout SHA mismatch');
  git(root, ['cat-file', '-e', `${base}^{commit}`]);
  const payload = native.payload ?? {};
  let sourceSha = testedSha;
  if (native.eventName === 'pull_request') {
    const pull = payload.pull_request ?? {};
    sourceSha = pull.head?.sha;
    const parents = git(root, ['show', '-s', '--format=%P', testedSha]).split(' ');
    if (parents.length !== 2 || parents[1] !== sourceSha) throw new Error('PR checkout second parent does not match native head');
    if (parents[0] !== base) throw new Error('PR physical protected base mismatch');
    if (!sha(pull.base?.sha)) throw new Error('PR native base missing');
    git(root, ['merge-base', '--is-ancestor', pull.base.sha, base]);
  } else if (native.eventName === 'push') {
    sourceSha = payload.after;
    if (sourceSha !== testedSha) throw new Error('push source does not match checkout');
    if (payload.before !== base) throw new Error('push protected base mismatch');
    git(root, ['merge-base', '--is-ancestor', base, testedSha]);
  } else if (base !== testedSha) {
    throw new Error('explicit full event must use its checked-out definition as base');
  }
  const pull = payload.pull_request ?? {};
  const context = { eventName: native.eventName, repository: payload.repository?.full_name, repositoryId: payload.repository?.id,
    actor: native.actor, actorId: native.actorId, ref: native.ref, baseRef: pull.base?.ref ?? native.baseRef,
    author: pull.user?.login, authorId: pull.user?.id, headRepository: pull.head?.repo?.full_name, headRepositoryId: pull.head?.repo?.id };
  const changedPaths = git(root, ['diff', '--name-only', '--no-renames', '-z', base, testedSha]).split('\0').filter(Boolean);
  return { context, identity: { sourceSha, baseSha: base, testedSha, definitionSha: base }, changedPaths };
}

/** Integration application proof only. Release/provider proof has its own
 * immutable contract and cannot consume this result as authorization. */
export function applicationGate({ route, required, needs, mandatoryFull = false }) {
  if (route?.result !== 'success' || !['true', 'false'].includes(route?.outputs?.full)) return ['routing failed or missing; Sutura must repair the protected routing installation'];
  if (route.outputs.full === 'false' && !mandatoryFull) return [];
  if (!Array.isArray(required) || !required.length) return ['full verification requires a nonempty application job inventory'];
  return required.filter(job => needs[job]?.result !== 'success').map(job => `${job}: expected actual success, received ${needs[job]?.result ?? 'missing'}`);
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  const output = (key, value) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); };
  // This output remains full on every failure; dependent jobs must also use
  // always() and a final gate must reject the failed routing job.
  output('full', 'true');
  try {
    const env = process.env, baseIndex = process.argv.indexOf('--base'), base = process.argv[baseIndex + 1];
    const root = process.cwd();
    const policy = JSON.parse(git(root, ['show', `${base}:.github/ci-cadence.json`]));
    const native = { eventName: env.GITHUB_EVENT_NAME, payload: JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')),
      sha: env.GITHUB_SHA, ref: env.GITHUB_REF, baseRef: env.GITHUB_BASE_REF, actor: env.GITHUB_ACTOR, actorId: env.GITHUB_ACTOR_ID };
    const plan = planVerification({ policy, ...inspectCheckout({ root, native, base }) });
    output('full', String(plan.full)); output('reason', plan.reason);
    console.log(JSON.stringify(plan));
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `Sutura routing: ${plan.full ? 'full' : 'fast'} (${plan.reason}). Application verification grants no release/provider authority.\n`);
  } catch (error) {
    console.error(`Sutura routing failed: ${error.message}. Full verification remains required; bring this repository and run to Sutura for repair. No mode change is needed.`);
    process.exitCode = 1;
  }
}
