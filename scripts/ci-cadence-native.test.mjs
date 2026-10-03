import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, user } from '../tests/fixtures/ci-cadence-adapter/native/fixture.mjs';
import { classifyNativeEvent } from './ci-cadence-native.mjs';
import { validatePolicy, validateExecutionGraph } from './ci-cadence.mjs';

const repository = 'juan294/paisaxe';
let nativeFixture, installed, absent, invalid, alteredHelper;
const pr = (base = 'develop', author = 'juan294', fork = false) => nativeFixture.prepare('pull_request', base, installed, user(author), fork).event;
const classify = (event, options = {}) => {
  const prepared = nativeFixture.prepare('pull_request', event.pull_request.base.ref, event.pull_request.base.sha, event.sender, event.pull_request.head.repo.full_name !== repository);
  return classifyNativeEvent({ ...prepared, ...options });
};
before(async () => { nativeFixture = await fixture(); ({ installed, absent, invalid, alteredHelper } = nativeFixture); });
after(async () => nativeFixture.close());
test('actual policy validates a unique complete multi-workflow inventory', async () => {
  const policy = JSON.parse(await readFile(new URL('../.github/ci-cadence.json', import.meta.url)));
  assert.equal(validatePolicy(policy).valid, true);
  assert.equal(policy.workflows.length, 10);
  assert.ok(policy.workflows.find(w => w.path.endsWith('/ci.yml')).contexts.Test.includes('ci-test'));
  const contexts = policy.workflows.find(w => w.path.endsWith('/ci.yml')).contexts;
  for (const shard of [1, 2, 3, 4]) assert.deepEqual(contexts[`Coverage (shard ${shard}/4)`], [`ci-coverage-shard-${shard}`]);
});
test('immutable protected base selects fast despite malicious candidate helper and policy', async () => assert.equal((await classify(pr())).lane, 'fast'));
for (const mode of [undefined, 'legacy', 'invalid']) test(`mode ${mode} retains full validation`, async () => assert.equal((await classify(pr(), { mode })).lane, 'full'));
test('production is independently full even in lean mode', async () => assert.equal((await classify(pr('main'))).lane, 'release'));
for (const [author, fork] of [['outsider', false], ['dependabot[bot]', false], ['juan294', true]]) test(`untrusted ${author}/${fork} is hosted read-only without privileges`, async () => {
  assert.deepEqual(Object.fromEntries(Object.entries(await classify(pr('main', author, fork))).filter(([key]) => ['lane', 'runner', 'token', 'allowPrivileged', 'allowDeploy', 'acceptanceBlocked', 'releaseRequired'].includes(key))), { allowDeploy: false, allowPrivileged: false, lane: 'untrusted', releaseRequired: true, acceptanceBlocked: true, runner: 'standard-hosted', token: 'read-only' });
});
test('moving base cannot load evidence from another revision', async () => assert.equal((await classify(pr(), { trustedRevision: absent })).lane, 'blocked'));
test('missing first-install protected helper retains full', async () => { const event = pr(); event.pull_request.base.sha = absent; assert.equal((await classify(event)).lane, 'full'); });
test('malformed installed policy blocks rather than skipping', async () => { const event = pr(); event.pull_request.base.sha = invalid; assert.match((await classify(event)).reason, /policy/); assert.equal((await classify(event)).lane, 'blocked'); });
test('immutable frozen helper check detects changed bytes even trailing whitespace', async () => { const event = pr(); event.pull_request.base.sha = alteredHelper; assert.equal((await classify(event)).lane, 'blocked'); });
test('owner integration push uses immutable native before and actual after', async () => {
  const prepared = nativeFixture.prepare('push');
  const result = await classifyNativeEvent(prepared);
  assert.equal(result.lane, 'fast'); assert.equal(result.sourceSha, prepared.source);
});
test('sender and native actor conflict blocks push authorization', async () => {
  const prepared = nativeFixture.prepare('push', 'develop', installed, user('outsider'));
  assert.equal((await classifyNativeEvent({ ...prepared, actor: 'juan294' })).lane, 'blocked');
});
test('repair defaults off and excludes nonowner source events independently', async () => {
  const workflow = await readFile(new URL('../.github/workflows/sutura.yml', import.meta.url), 'utf8');
  assert.match(workflow, /vars\.CI_CADENCE_REPAIR_ENABLED == 'true'/);
  assert.match(workflow, /workflow_run\.actor\.login == 'juan294'/);
  assert.match(workflow, /workflow_run\.head_repository\.full_name == github\.repository/);
});
test('actual repair predicate denies default, untrusted, production, PR and nonfailed sources', async () => {
  const workflow = await readFile(new URL('../.github/workflows/sutura.yml', import.meta.url), 'utf8');
  const expression = workflow.match(/    if: >-\n\s+\$\{\{([\s\S]*?)\}\}/)?.[1];
  assert.ok(expression);
  const allowed = new Function('github', 'vars', `return Boolean(${expression});`);
  const github = { repository, event: { workflow_run: { actor: { login: 'juan294' }, head_repository: { full_name: repository }, event: 'push', head_branch: 'develop', conclusion: 'failure' } } };
  assert.equal(allowed(github, {}), false);
  assert.equal(allowed(github, { CI_CADENCE_REPAIR_ENABLED: 'true' }), true);
  for (const delta of [{ actor: { login: 'outsider' } }, { head_repository: { full_name: 'outsider/paisaxe' } }, { event: 'pull_request' }, { head_branch: 'main' }, { conclusion: 'cancelled' }, { conclusion: 'success' }]) assert.equal(allowed({ ...github, event: { workflow_run: { ...github.event.workflow_run, ...delta } } }, { CI_CADENCE_REPAIR_ENABLED: 'true' }), false);
});
test('all inventoried full application children must succeed, never skip/cancel/fail', async () => {
  const policy = JSON.parse(await readFile(new URL('../.github/ci-cadence.json', import.meta.url)));
  const classification = await classify(pr('main'));
  const jobs = Object.fromEntries(policy.workflows.flatMap(w => w.jobs).map(job => [job.id, { result: 'success', needs: job.needs }]));
  const contexts = Object.fromEntries(policy.workflows.flatMap(w => Object.keys(w.contexts)).map(context => [context, 'success']));
  const graph = { schemaVersion: 1, sourceSha: classification.sourceSha, targetBranch: classification.targetBranch, baseSha: classification.baseSha, definitionSha: classification.definitionSha, jobs, contexts, privileged: false, deploy: false };
  assert.equal(validateExecutionGraph(graph, classification, policy).valid, true);
  for (const id of Object.keys(jobs)) for (const result of ['skipped', 'cancelled', 'failure']) assert.equal(validateExecutionGraph({ ...graph, jobs: { ...jobs, [id]: { ...jobs[id], result } } }, classification, policy).valid, false, `${id}/${result}`);
});

const realCase = (name, run) => test(name, async () => { const f = await fixture(); try { await run(f); } finally { await f.close(); } });
realCase('push binds BEFORE protected pin while origin names AFTER', async f => {
  const input = f.prepare('push'); const result = await classifyNativeEvent(input);
  assert.equal(result.lane, 'fast'); assert.equal(result.definitionSha, f.installed);
  assert.equal(result.testedCheckoutSha, input.source);
});
for (const change of [i => { i.event.repository.id = 1; }, i => { i.event.repository.owner.id = 1; }, i => { i.event.sender.id = 1; }, i => { i.context.actorType = 'Bot'; }, i => { i.context.repositoryId = '1141286326'; }, i => { i.context.sha = fakedSha; }]) realCase('numeric/context spoof fails closed', async f => {
  const input = f.prepare('push'); change(input); assert.equal((await classifyNativeEvent(input)).lane, 'blocked');
});
const fakedSha = 'a'.repeat(40);
realCase('actual HEAD mismatch blocks native push', async f => { const i = f.prepare('push'); f.git('checkout', '--quiet', '--force', '--detach', f.installed); assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('missing isolated BEFORE pin blocks push', async f => { const i = f.prepare('push'); f.git('update-ref', '-d', `refs/ci-cadence/protected/${f.installed}`); assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('moving actual origin AFTER blocks push', async f => { const i = f.prepare('push'); f.git('update-ref', 'refs/remotes/origin/develop', f.installed); assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('nonancestor force push blocks Fast and reuse', async f => { const i = f.prepare('push'); const head = f.git('commit-tree', f.git('rev-parse', `${i.source}^{tree}`), '-m', 'unrelated force push'); f.git('checkout', '--quiet', '--force', '--detach', head); f.git('update-ref', 'refs/remotes/origin/develop', head); i.event.after = i.context.sha = head; assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('partial policy installation never first-install full', async f => { assert.equal((await classifyNativeEvent(f.prepare('push', 'develop', f.partial))).lane, 'blocked'); });
realCase('PR retains actual merge checkout separately and cannot reuse it', async f => { const i = f.prepare(); const r = await classifyNativeEvent(i); assert.equal(r.lane, 'fast'); assert.equal(r.sourceSha, i.source); assert.equal(r.testedCheckoutSha, i.checkout); assert.equal(r.reusable, false); });
realCase('forged native PR merge parents block', async f => { const i = f.prepare(); i.event.pull_request.head.sha = f.absent; assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('scheduled default definition resolves integration once', async f => { const i = f.prepare('schedule'); let calls = 0; const resolver = i.resolveIntegrationHead; i.resolveIntegrationHead = async () => { calls++; return resolver(); }; const r = await classifyNativeEvent(i); assert.equal(r.lane, 'nightly'); assert.equal(calls, 1); assert.equal(r.sourceSha, i.source); assert.equal(r.definitionSha, f.installed); assert.equal(r.targetBranch, 'develop'); });
realCase('schedule legacy disabled without resolving', async f => { const i = f.prepare('schedule'); i.mode = 'legacy'; let calls = 0; i.resolveIntegrationHead = async () => { calls++; throw Error('must not resolve'); }; const r = await classifyNativeEvent(i); assert.equal(r.lane, 'disabled'); assert.equal(calls, 0); });
realCase('schedule first installation disabled', async f => { assert.equal((await classifyNativeEvent(f.prepare('schedule', 'develop', f.absent))).lane, 'disabled'); });
for (const change of [i => { i.context.ref = 'refs/heads/develop'; }, i => { i.defaultSha = fakedSha; }, i => { delete i.resolveIntegrationHead; }, i => { i.resolveIntegrationHead = async () => ({ repository: { id: 1 }, ref: 'refs/heads/develop', sha: i.source }); }]) realCase('invalid scheduled native identity blocks', async f => { const i = f.prepare('schedule'); change(i); assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('forged workflow-call callee identity blocks', async f => { const i = f.prepare('schedule'); i.eventName = 'workflow_call'; assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('ambient Git repository redirects cannot change protected identity', async f => { const other = await fixture(); const i = f.prepare('push'); const old = process.env.GIT_DIR; process.env.GIT_DIR = join(other.root, '.git'); try { assert.equal((await classifyNativeEvent(i)).lane, 'fast'); } finally { if (old === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = old; await other.close(); } });
realCase('replacement and legacy grafts cannot fake physical PR parents', async f => { const i = f.prepare(); const wrong = f.git('commit-tree', f.git('rev-parse', `${i.checkout}^{tree}`), '-p', f.absent, '-p', i.source, '-m', 'physical wrong base'); f.git('checkout', '--quiet', '--force', '--detach', wrong); i.context.sha = wrong; f.git('replace', wrong, i.checkout); await writeFile(join(f.root, '.git/info/grafts'), `${wrong} ${f.installed} ${i.source}\n`); assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); });
realCase('legacy graft alone cannot manufacture expected merge parents', async f => {
  const i = f.prepare(); const wrong = f.git('commit-tree', f.git('rev-parse', `${i.checkout}^{tree}`), '-p', f.absent, '-p', i.source, '-m', 'wrong physical parents');
  f.git('checkout', '--quiet', '--force', '--detach', wrong); i.context.sha = wrong;
  await writeFile(join(f.root, '.git/info/grafts'), `${wrong} ${f.installed} ${i.source}\n`);
  assert.equal((await classifyNativeEvent(i)).lane, 'blocked');
});
realCase('replacement alone cannot manufacture expected merge parents', async f => {
  const i = f.prepare(); const wrong = f.git('commit-tree', f.git('rev-parse', `${i.checkout}^{tree}`), '-p', f.absent, '-p', i.source, '-m', 'wrong physical parents');
  f.git('checkout', '--quiet', '--force', '--detach', wrong); i.context.sha = wrong; f.git('replace', wrong, i.checkout);
  assert.equal((await classifyNativeEvent(i)).lane, 'blocked');
});
realCase('graft cannot make force push an actual BEFORE descendant', async f => {
  const i = f.prepare('push'); const wrong = f.git('commit-tree', f.git('rev-parse', `${i.source}^{tree}`), '-m', 'physical nonancestor');
  f.git('checkout', '--quiet', '--force', '--detach', wrong); f.git('update-ref', 'refs/remotes/origin/develop', wrong); i.event.after = i.context.sha = wrong;
  await writeFile(join(f.root, '.git/info/grafts'), `${wrong} ${f.installed}\n`);
  assert.equal((await classifyNativeEvent(i)).lane, 'blocked');
});
realCase('shallow history cannot authenticate Fast admission', async f => {
  const i = f.prepare('push'); await writeFile(join(f.root, '.git/shallow'), `${f.installed}\n`);
  assert.equal((await classifyNativeEvent(i)).lane, 'blocked');
});
realCase('Git inspection failure blocks without disclosing external errors', async f => {
  const i = f.prepare('push'); i.root = join(f.root, 'does-not-exist-sensitive-fixture'); const r = await classifyNativeEvent(i);
  assert.equal(r.lane, 'blocked'); assert.doesNotMatch(r.reason, /sensitive-fixture|ENOENT|Command failed/);
});
realCase('helper-only partial install also blocks', async f => {
  f.git('checkout', '--quiet', '--force', '--detach', f.installed); f.git('rm', '--quiet', '--force', '.github/ci-cadence.json');
  const partial = f.git('commit-tree', f.git('write-tree'), '-p', f.installed, '-m', 'helper-only');
  assert.equal((await classifyNativeEvent(f.prepare('push', 'develop', partial))).lane, 'blocked');
});
realCase('moving scheduled integration origin blocks after exactly one resolve', async f => {
  const i = f.prepare('schedule'); let calls = 0; const original = i.resolveIntegrationHead;
  i.resolveIntegrationHead = async () => { calls++; f.git('update-ref', 'refs/remotes/origin/develop', f.installed); return original(); };
  assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); assert.equal(calls, 1);
});
realCase('scheduled resolver failure withholds without leaking provider detail', async f => {
  const i = f.prepare('schedule'); let calls = 0; i.resolveIntegrationHead = async () => { calls++; throw Error('secret-token-fixture'); };
  const r = await classifyNativeEvent(i); assert.equal(r.lane, 'blocked'); assert.equal(calls, 1); assert.doesNotMatch(r.reason, /secret-token/);
});
realCase('production owner push cannot reduce its graph', async f => { const i = f.prepare('push', 'main'); const r = await classifyNativeEvent(i); assert.equal(r.lane, 'release'); assert.equal(r.allowDeploy, true); assert.equal(r.allowPrivileged, true); assert.equal(r.releaseRequired, true); });
realCase('nonowner production push withholds privileged/provider acceptance', async f => { const i = f.prepare('push', 'main', f.installed, user('outsider')); const r = await classifyNativeEvent(i); assert.equal(r.lane, 'untrusted'); assert.equal(r.allowDeploy, false); assert.equal(r.allowPrivileged, false); assert.equal(r.acceptanceBlocked, true); assert.equal(r.runner, 'standard-hosted'); assert.equal(r.token, 'read-only'); });
// A schedule payload is not guaranteed to carry sender or repository, and its
// actor is whoever last touched the default branch. Schedule trust is the native
// repository/owner identity and the default-branch definition.
for (const [label, change] of [['sender-less', i => { delete i.event.sender; }], ['payload with only the cron', i => { i.event = { schedule: i.event.schedule }; }], ['foreign last committer as actor', i => { const other = user('web-flow'); i.event.sender = other; i.actor = other.login; i.context.actorId = other.id; i.context.actorType = other.type; }], ['missing actor context', i => { delete i.event.sender; i.actor = undefined; i.context.actorId = NaN; i.context.actorType = undefined; }]]) realCase(`${label} schedule still reaches the nightly decision`, async f => { const i = f.prepare('schedule'); change(i); const r = await classifyNativeEvent(i); assert.equal(r.lane, 'nightly'); assert.equal(r.sourceSha, i.source); assert.equal(r.targetBranch, 'develop'); assert.equal(r.allowDeploy, false); assert.equal(r.allowPrivileged, false); });
for (const [label, change] of [['foreign repository id', i => { i.context.repositoryId = 333; }], ['foreign owner id', i => { i.context.ownerId = 12345; }], ['foreign repository name', i => { i.context.repository = 'outsider/paisaxe'; }], ['non-default ref', i => { i.context.ref = 'refs/heads/develop'; }]]) realCase(`sender-less schedule with ${label} blocks without resolving`, async f => { const i = f.prepare('schedule'); delete i.event.sender; change(i); let calls = 0; i.resolveIntegrationHead = async () => { calls++; throw Error('unexpected'); }; assert.equal((await classifyNativeEvent(i)).lane, 'blocked'); assert.equal(calls, 0); });
realCase('sender-less push or pull request still blocks: only schedule may omit sender', async f => { for (const kind of ['push', 'pull_request']) { const i = f.prepare(kind); delete i.event.sender; assert.equal((await classifyNativeEvent(i)).lane, 'blocked', kind); } });
realCase('known owner numeric identity cannot be relabeled as outsider', async f => {
  const i = f.prepare('push', 'develop', f.installed, user('outsider'));
  i.event.sender.id = i.context.actorId = 3944118;
  assert.equal((await classifyNativeEvent(i)).lane, 'blocked');
});

test('shared expired native deadline rejects before physical classification',async()=>{
 const f=await fixture();try{const input=f.prepare('push');input.deadline=performance.now()-1;const r=await classifyNativeEvent(input);assert.equal(r.lane,'blocked');}finally{await f.close();}
});
