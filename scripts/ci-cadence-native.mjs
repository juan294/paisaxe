import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// This module must itself be acquired from the protected Git object before import.
const REPOSITORY = 'juan294/paisaxe';
const REPOSITORY_ID = 1141286326;
const OWNER = 'juan294';
const OWNER_ID = 3944118;
const SHA = /^[a-f0-9]{40}$/;
const HELPER_SHA256 = '9f2da9ab55525a3ca4acc311feaf5426fc86d83258c5dda7754dc05405c9a7ab';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && SHA.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const account = value => record(value) && typeof value.login === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*(?:\[bot\])?$/.test(value.login)
  && positive(value.id) && ['User', 'Bot'].includes(value.type)
  && (value.type === 'Bot') === value.login.endsWith('[bot]')
  && (value.login === OWNER) === (value.id === OWNER_ID);
const repository = value => record(value) && value.full_name === REPOSITORY && value.id === REPOSITORY_ID && value.default_branch === 'main' && value.owner?.login === OWNER && value.owner?.id === OWNER_ID;
const blocked = reason => ({ lane: 'blocked', reason, allowDeploy: false, allowPrivileged: false, reusable: false });

/** Physical object inspection must not inherit redirects, replacement refs or grafts. */
export function protectedGitEnvironment(environment = process.env) {
  return { ...Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith('GIT_'))), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null' };
}

/** The event and context come from native GitHub inputs, never contributor outputs. */
export async function classifyNativeEvent({ root, event, eventName, actor, mode, trustedRevision, context, defaultSha, resolveIntegrationHead, deadline: inheritedDeadline }) {
  const deadline = inheritedDeadline === undefined ? performance.now() + 60000 : Math.min(performance.now() + 60000, inheritedDeadline);
  const remaining = () => { const milliseconds = Math.min(5000, Math.floor(deadline - performance.now())); if (!Number.isFinite(milliseconds) || milliseconds < 1) throw Error('native deadline'); return milliseconds; };
  if (!Number.isFinite(deadline) || deadline <= performance.now()) return blocked('native deadline expired');
  if (!record(event) || !repository(event.repository) || !account(event.sender) || actor !== event.sender.login || !record(context) || context.repository !== REPOSITORY || context.repositoryId !== REPOSITORY_ID || context.ownerId !== OWNER_ID || context.actorId !== event.sender.id || context.actorType !== event.sender.type || !sha(context.sha) || !sha(trustedRevision)) return blocked('native repository/account/context identity mismatch');
  const git = (...args) => execFileSync('git', ['--no-replace-objects', '-c', 'core.useReplaceRefs=false', ...args], { cwd: root, env: protectedGitEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: remaining(), maxBuffer: 2_000_000 });
  const oid = (...args) => git(...args).trim();
  let normalized, branch, author, sourceSha, testedCheckoutSha;
  try {
    if (oid('rev-parse', '--verify', `${trustedRevision}^{commit}`) !== trustedRevision) return blocked('protected revision is not an immutable commit');
    if (oid('rev-parse', '--is-shallow-repository') !== 'false') return blocked('shallow physical history cannot authenticate native admission');
    if (eventName === 'pull_request') {
      const pr = event.pull_request;
      if (!record(pr) || !positive(event.number) || pr.number !== event.number || !repository(pr.base?.repo) || !['develop', 'main'].includes(pr.base?.ref) || pr.base.sha !== trustedRevision || !sha(pr.head?.sha) || !account(pr.user) || !record(pr.head.repo) || !positive(pr.head.repo.id) || typeof pr.head.repo.full_name !== 'string' || (pr.head.repo.full_name === REPOSITORY && !repository(pr.head.repo)) || context.ref !== `refs/pull/${event.number}/merge`) return blocked('native PR candidate/base identity mismatch');
      branch = pr.base.ref; sourceSha = pr.head.sha; author = pr.user;
      testedCheckoutSha = context.sha;
      if (oid('rev-parse', '--verify', 'HEAD') !== testedCheckoutSha || oid('rev-parse', '--verify', `refs/remotes/origin/${branch}`) !== trustedRevision || oid('rev-list', '--parents', '-n', '1', testedCheckoutSha) !== `${testedCheckoutSha} ${trustedRevision} ${sourceSha}`) return blocked('native PR physical merge/base/checkout mismatch');
      normalized = { kind: eventName, repository: REPOSITORY, actor, author: author.login, headRepository: pr.head.repo.full_name, headSha: sourceSha, baseSha: trustedRevision, baseBranch: branch };
    } else if (eventName === 'push') {
      if (!['refs/heads/develop', 'refs/heads/main'].includes(event.ref) || event.before !== trustedRevision || !sha(event.after) || event.deleted !== false || context.ref !== event.ref || context.sha !== event.after) return blocked('native push ref/before/after context mismatch');
      branch = event.ref.slice('refs/heads/'.length); sourceSha = event.after; author = event.sender; testedCheckoutSha = sourceSha;
      if (oid('rev-parse', '--verify', `refs/ci-cadence/protected/${trustedRevision}`) !== trustedRevision || oid('rev-parse', '--verify', `refs/remotes/origin/${branch}`) !== sourceSha || oid('rev-parse', '--verify', 'HEAD') !== sourceSha) return blocked('native push protected pin/origin AFTER/checkout mismatch');
      git('merge-base', '--is-ancestor', trustedRevision, sourceSha);
      normalized = { kind: eventName, repository: REPOSITORY, actor, author: author.login, sourceSha, ref: event.ref };
    } else if (eventName === 'schedule') {
      if (context.ref !== 'refs/heads/main' || context.sha !== trustedRevision || defaultSha !== trustedRevision || typeof event.schedule !== 'string' || event.schedule.length === 0 || oid('rev-parse', '--verify', 'refs/remotes/origin/main') !== trustedRevision) return blocked('scheduled native default definition identity mismatch');
      branch = 'main'; author = event.sender;
    } else return blocked('unsupported native event; callee identities cannot manufacture admission');

    const owner = actor === OWNER && event.sender.id === OWNER_ID && event.sender.type === 'User' && author.login === OWNER && author.id === OWNER_ID && author.type === 'User' && (eventName !== 'pull_request' || normalized.headRepository === REPOSITORY);
    const identity = () => ({ sourceSha, testedCheckoutSha, targetBranch: eventName === 'schedule' ? 'develop' : branch, ...(eventName === 'pull_request' ? { baseSha: trustedRevision } : {}), definitionSha: trustedRevision, nativeHeadSha: context.sha, allowDeploy: false, allowPrivileged: false, reusable: testedCheckoutSha === sourceSha && owner });
    const mandatory = classification => {
      remaining();
      if (classification.lane === 'blocked') return { ...classification, ...identity(), reusable: false };
      if (!owner) return { ...identity(), lane: 'untrusted', reason: 'full hosted isolated suite; authenticated/provider acceptance withheld until vetted integration', releaseRequired: branch === 'main' && eventName !== 'schedule', acceptanceBlocked: true, runner: 'standard-hosted', token: 'read-only', reusable: false };
      if (branch === 'main' && eventName !== 'schedule') return { ...identity(), lane: 'release', reason: 'production always executes exact candidate/base full suite', releaseRequired: true, allowDeploy: eventName === 'push', allowPrivileged: true };
      return { ...classification, ...identity() };
    };
    // One successful tree inspection distinguishes genuine absence from Git failure.
    const present = new Set(git('ls-tree', '--name-only', '-z', trustedRevision, '--', '.github/ci-cadence.json', 'scripts/ci-cadence.mjs').split('\0').filter(Boolean));
    if (present.size === 0) return eventName === 'schedule' ? { ...blocked('new nightly disabled until protected installation'), lane: 'disabled' } : mandatory({ lane: 'full', reason: 'protected helper absent; first installation preserves legacy full' });
    if (present.size !== 2) return blocked('partial protected policy/helper installation; repair installation');
    const policyBytes = git('show', `${trustedRevision}:.github/ci-cadence.json`);
    const helperBytes = git('show', `${trustedRevision}:scripts/ci-cadence.mjs`);
    let policy;
    try { policy = JSON.parse(policyBytes); } catch { return blocked('installed policy JSON invalid; repair protected policy'); }
    if (policy.repository !== REPOSITORY || policy.defaultBranch !== 'main' || policy.productionBranch !== 'main' || policy.integrationBranch !== 'develop' || !Array.isArray(policy.owners) || policy.owners.length !== 1 || policy.owners[0] !== OWNER) return blocked('protected policy conflicts with independently reviewed topology/owner');
    if (createHash('sha256').update(helperBytes).digest('hex') !== HELPER_SHA256) return blocked('protected helper differs from frozen reviewed contract');
    const directory = await mkdtemp(join(tmpdir(), 'paisaxe-protected-classifier-'));
    try {
      const path = join(directory, 'ci-cadence.mjs'); await writeFile(path, helperBytes);
      const { classifyEvent, validatePolicy } = await import(pathToFileURL(path).href);
      remaining();
      const validation = validatePolicy(policy);
      if (!validation.valid) return blocked('installed policy invalid; repair protected policy');
      for (const workflow of policy.workflows) if (oid('rev-parse', '--verify', `${trustedRevision}:${workflow.path}`) !== workflow.definitionSha) return blocked(`protected workflow inventory differs: ${workflow.path}`);
      if (eventName === 'schedule') {
        if (mode !== 'lean') return { ...blocked('new nightly disabled under legacy mode'), lane: 'disabled' };
        if (!owner || typeof resolveIntegrationHead !== 'function') return blocked('scheduled integration resolution requires independently authenticated owner/native resolver');
        // The trusted native caller supplies the GET-only authenticated resolver.
        // API/pre-import acquisition is a separate installation prerequisite.
        let resolverTimer;
        const resolved = await Promise.race([Promise.resolve().then(resolveIntegrationHead), new Promise((_, reject) => { resolverTimer = setTimeout(() => reject(Error('native resolver deadline')), remaining()); })]).finally(() => clearTimeout(resolverTimer));
        remaining();
        if (!record(resolved) || !repository(resolved.repository) || resolved.ref !== 'refs/heads/develop' || !sha(resolved.sha)) return blocked('scheduled integration resolution identity mismatch');
        sourceSha = resolved.sha; testedCheckoutSha = sourceSha;
        if (oid('rev-parse', '--verify', 'HEAD') !== sourceSha || oid('rev-parse', '--verify', 'refs/remotes/origin/develop') !== sourceSha) return blocked('scheduled resolved integration checkout/origin mismatch');
        normalized = { kind: eventName, repository: REPOSITORY, actor, author: author.login, resolvedBranch: 'develop', resolvedHeadSha: sourceSha };
      }
      return { ...mandatory(classifyEvent(normalized, policy, mode, { repository: REPOSITORY, branch, sha: trustedRevision, helperInstalled: true })), policyBlobSha: oid('rev-parse', `${trustedRevision}:.github/ci-cadence.json`), helperBlobSha: oid('rev-parse', `${trustedRevision}:scripts/ci-cadence.mjs`) };
    } finally { await rm(directory, { recursive: true, force: true }); }
  } catch { return blocked('native physical/protected definition inspection or authenticated resolution unavailable'); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const integer = value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
    const result = await classifyNativeEvent({ root: process.cwd(), event, eventName: process.env.GITHUB_EVENT_NAME, actor: process.env.GITHUB_ACTOR, mode: process.env.CI_CADENCE_MODE, trustedRevision: process.env.CI_CADENCE_TRUSTED_REVISION, defaultSha: process.env.CI_CADENCE_DEFAULT_SHA, context: { repository: process.env.GITHUB_REPOSITORY, repositoryId: integer(process.env.GITHUB_REPOSITORY_ID), ownerId: integer(process.env.GITHUB_REPOSITORY_OWNER_ID), actorId: integer(process.env.GITHUB_ACTOR_ID), actorType: event.sender?.type, sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF } });
    console.log(JSON.stringify(result, null, 2));
    if (result.lane === 'blocked') process.exitCode = 1;
  } catch { console.error('native event acquisition failed'); process.exitCode = 1; }
}
