import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'yaml';

// Evaluates the installed workflow YAML the way the Actions scheduler selects
// jobs: trigger filters, job-level `if`, skipped-dependency propagation and
// reusable-workflow expansion. A "started" job is one that occupies a runner
// and is therefore billed (rounded up to a minute each).
const directory = new URL('../../../../.github/workflows/', import.meta.url);
const STATUS = /\b(?:always|failure|cancelled|success)\(\)/;

const lower = value => typeof value === 'string' ? value.toLowerCase() : Array.isArray(value) ? value.map(lower) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, lower(entry)])) : value;
/** GitHub expression semantics needed here: missing properties are null, not
 * errors, and string comparison ignores case (both sides are lower-cased, so a
 * string result comes back lower-cased too). */
export function evaluate(expression, context) {
  if (expression === undefined || expression === null) return true;
  const body = String(expression).replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  context = lower(context);
  const source = body.split(/('(?:[^']|'')*')/).map((part, index) => index % 2 ? part.toLowerCase() : part.replace(/\b(needs|steps)\.([A-Za-z_][A-Za-z0-9_-]*)/g, (_, scope, id) => `${scope}?.[${JSON.stringify(id)}]`).replace(/\.(?=[A-Za-z_])/g, '?.')).join('');
  const failed = Object.values(context.needs ?? {}).some(need => ['failure', 'cancelled'].includes(need.result));
  return vm.runInNewContext(source, { ...context, always: () => true, success: () => !failed, failure: () => failed, cancelled: () => false, format: (pattern, ...args) => pattern.replace(/\{(\d+)\}/g, (_, n) => args[Number(n)]), contains: (value, item) => String(value ?? '').includes(item), startsWith: (value, prefix) => String(value ?? '').startsWith(prefix), fromJSON: JSON.parse }, { timeout: 100 });
}
/** Resolves a string that embeds `${{ }}` expressions, e.g. a concurrency group. */
export const interpolate = (text, context) => String(text).replace(/\$\{\{([\s\S]*?)\}\}/g, (_, body) => String(evaluate(body, context) ?? ''));
export const workflow = (name, sources = {}) => parse(sources[name] ?? readFileSync(new URL(name, directory), 'utf8'));
const branchOf = context => context.github.event_name === 'pull_request' ? context.github.event.pull_request.base.ref : context.github.ref.replace(/^refs\/heads\//, '');
function triggered(definition, context) {
  const kind = context.github.event_name;
  if (!definition.on || !(kind in definition.on)) return false;
  const filter = definition.on[kind];
  if (kind === 'schedule' || !filter) return true;
  // Path-scoped triggers need a matching diff; a generic event has none.
  if (filter.paths) return false;
  if (filter.types && !filter.types.includes(context.github.event.action)) return false;
  return !filter.branches || filter.branches.includes(branchOf(context));
}
/** Runs one workflow's job graph; `outputs` supplies outputs of jobs that start. */
function run(name, context, outputs, prefix, started, sources) {
  const definition = workflow(name, sources), needs = {}, pending = new Set(Object.keys(definition.jobs));
  while (pending.size) {
    const id = [...pending].find(candidate => [definition.jobs[candidate].needs ?? []].flat().every(need => need in needs));
    if (!id) throw Error('workflow dependency cycle: ' + name);
    pending.delete(id);
    const job = definition.jobs[id], own = Object.fromEntries([job.needs ?? []].flat().map(need => [need, needs[need]]));
    const blocked = Object.values(own).some(need => need.result !== 'success') && !STATUS.test(String(job.if ?? ''));
    const scope = { ...context, needs: own };
    const label = prefix + (job.name && !String(job.name).includes('${{') ? job.name : id);
    let result = 'skipped';
    if (!blocked && Boolean(evaluate(job.if, scope))) {
      if (job.uses) {
        const inputs = Object.fromEntries(Object.entries(job.with ?? {}).map(([key, value]) => [key, typeof value === 'string' && value.includes('${{') ? evaluate(value, scope) : value]));
        const before = started.length;
        run(job.uses.split('/').at(-1), { ...context, inputs }, outputs, label + ' / ', started, sources);
        result = started.length > before ? 'success' : 'skipped';
      } else { started.push(label); result = 'success'; }
    }
    needs[id] = { result, outputs: result === 'success' ? outputs[`${name}:${id}`] ?? {} : {} };
  }
  return needs;
}
/** Every job, across all installed workflows, that starts a runner for this event.
 * `sources` substitutes workflow text by file name (e.g. the pre-cadence originals). */
export function startedJobs(context, outputs = {}, sources = {}) {
  const started = [], completed = [], files = readdirSync(directory).filter(file => /\.ya?ml$/.test(file)).sort();
  for (const name of files) {
    const definition = workflow(name, sources);
    if (!triggered(definition, context)) continue;
    const before = started.length;
    run(name, { ...context, inputs: Object.fromEntries(Object.keys(definition.on.workflow_call?.inputs ?? {}).map(key => [key, ''])), github: { ...context.github, workflow: definition.name, workflow_ref: `juan294/paisaxe/.github/workflows/${name}@${context.github.ref}` } }, outputs, `${name}: `, started, sources);
    completed.push({ name: definition.name, path: `.github/workflows/${name}`, ran: started.length > before });
  }
  // Every triggered workflow completes as a run, even when all its jobs were
  // skipped, and that completion triggers its `workflow_run` listeners.
  for (const run of completed) for (const name of files) {
    const listener = workflow(name, sources), filter = listener.on?.workflow_run;
    if (!filter?.workflows?.includes(run.name)) continue;
    const github = { ...context.github, event_name: 'workflow_run', ref: 'refs/heads/main', workflow: listener.name, event: { ...context.github.event, action: 'completed', workflow_run: { name: run.name, path: run.path, event: context.github.event_name, status: 'completed', conclusion: 'success', head_branch: context.github.event_name === 'pull_request' ? 'feature' : context.github.ref.replace(/^refs\/heads\//, ''), actor: { login: context.github.actor }, head_repository: { full_name: 'juan294/paisaxe' } } } };
    for (const [id, job] of Object.entries(listener.jobs)) if (!job.needs && Boolean(evaluate(job.if, { ...context, github, needs: {} }))) started.push(`${name}: ${job.name ?? id} (after ${run.name})`);
  }
  return started.sort();
}
const OWNER = { id: 3944118, type: 'User', login: 'juan294' };
export const account = login => login === 'juan294' ? OWNER : { id: 49699333, type: login.endsWith('[bot]') ? 'Bot' : 'User', login };
/** Native contexts for a frozen phase-1 style event (kind/actor/author/ref/baseBranch/headRepository). */
export function nativeContext({ kind, actor = 'juan294', author = actor, ref, baseBranch, headRepository = 'juan294/paisaxe', senderless = false }, mode) {
  const sender = account(actor), same = headRepository === 'juan294/paisaxe';
  return { vars: mode === undefined || mode === null ? {} : { CI_CADENCE_MODE: mode }, inputs: {}, secrets: {}, matrix: {}, env: {},
    github: { repository: 'juan294/paisaxe', repository_id: '1141286326', repository_owner_id: '3944118', actor: sender.login, actor_id: String(sender.id), event_name: kind, ref, sha: 'a'.repeat(40), run_id: '42', run_attempt: '1',
      event: { ...(senderless ? {} : { sender }), ...(kind === 'schedule' ? { schedule: '0 3 * * *' } : {}), ...(kind === 'pull_request' ? { action: 'synchronize', pull_request: { user: account(author), base: { ref: baseBranch }, head: { repo: { id: same ? 1141286326 : 999, full_name: headRepository, fork: !same } } } } : {}) } } };
}
