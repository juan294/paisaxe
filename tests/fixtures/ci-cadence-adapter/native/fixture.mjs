import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const repository = { id: 1141286326, full_name: 'juan294/paisaxe', default_branch: 'main', owner: { id: 3944118, login: 'juan294' } };
export const user = (login = 'juan294') => ({ login, id: login === 'juan294' ? 3944118 : 12345, type: login.endsWith('[bot]') ? 'Bot' : 'User' });
export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'paisaxe-native-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_GRAFT_FILE: '/dev/null' });
  const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--quiet');
  await writeFile(join(root, 'initial'), root); git('add', '.');
  const absent = git('commit-tree', git('write-tree'), '-m', 'absent');
  await mkdir(join(root, 'scripts')); await mkdir(join(root, '.github/workflows'), { recursive: true });
  const base = new URL('../../../../', import.meta.url);
  const policyBytes = await readFile(new URL('.github/ci-cadence.json', base));
  const helperBytes = await readFile(new URL('scripts/ci-cadence.mjs', base));
  await writeFile(join(root, '.github/ci-cadence.json'), policyBytes);
  await writeFile(join(root, 'scripts/ci-cadence.mjs'), helperBytes);
  for (const workflow of JSON.parse(policyBytes).workflows) await writeFile(join(root, workflow.path), await readFile(new URL(workflow.path, base)));
  git('add', '.'); const installed = git('commit-tree', git('write-tree'), '-p', absent, '-m', 'installed');
  await writeFile(join(root, '.github/ci-cadence.json'), '{broken'); git('add', '.');
  const invalid = git('commit-tree', git('write-tree'), '-p', installed, '-m', 'invalid');
  await writeFile(join(root, '.github/ci-cadence.json'), policyBytes);
  await writeFile(join(root, 'scripts/ci-cadence.mjs'), `${helperBytes}\n`); git('add', '.');
  const alteredHelper = git('commit-tree', git('write-tree'), '-p', installed, '-m', 'altered');
  git('rm', '--quiet', '--force', 'scripts/ci-cadence.mjs');
  const partial = git('commit-tree', git('write-tree'), '-p', installed, '-m', 'partial');
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(join(root, 'scripts/ci-cadence.mjs'), 'throw new Error("candidate helper executed")');
  await writeFile(join(root, '.github/ci-cadence.json'), '{"productionBranch":"develop","owners":["outsider"]}'); git('add', '.');
  const hostileTree = git('write-tree');
  const context = (sender, sha, ref) => ({ repository: repository.full_name, repositoryId: repository.id, ownerId: repository.owner.id, actorId: sender.id, actorType: sender.type, sha, ref });
  const pin = sha => git('update-ref', `refs/ci-cadence/protected/${sha}`, sha);
  const prepare = (kind = 'pull_request', branch = 'develop', definition = installed, sender = user(), fork = false) => {
    const source = git('commit-tree', hostileTree, '-p', definition, '-m', 'hostile checked-out candidate');
    const checkout = kind === 'pull_request' ? git('commit-tree', hostileTree, '-p', definition, '-p', source, '-m', 'native test merge') : source;
    git('update-ref', `refs/remotes/origin/${branch}`, kind === 'pull_request' ? definition : source);
    git('update-ref', 'refs/remotes/origin/main', kind === 'push' && branch === 'main' ? source : definition);
    pin(definition); git('checkout', '--quiet', '--force', '--detach', checkout);
    const ref = kind === 'pull_request' ? 'refs/pull/7/merge' : `refs/heads/${kind === 'schedule' ? 'main' : branch}`;
    const event = { repository: structuredClone(repository), sender, ...(kind === 'pull_request' ? { number: 7, pull_request: { number: 7, user: sender, base: { ref: branch, sha: definition, repo: structuredClone(repository) }, head: { sha: source, repo: fork ? { id: 333, full_name: 'outsider/paisaxe', owner: { id: 12345, login: 'outsider' } } : structuredClone(repository) } } } : kind === 'push' ? { before: definition, after: source, ref, deleted: false } : { schedule: '0 2 * * *' }) };
    return { root, event, eventName: kind, actor: sender.login, mode: 'lean', trustedRevision: definition, defaultSha: definition, context: context(sender, kind === 'schedule' ? definition : checkout, ref), resolveIntegrationHead: async () => ({ repository: structuredClone(repository), ref: 'refs/heads/develop', sha: source }), source, checkout };
  };
  return { root, git, installed, absent, invalid, alteredHelper, partial, prepare, close: () => rm(root, { recursive: true, force: true }) };
}
