import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fixture, repository, user } from './fixture.mjs';
export async function launchFixture() {
  const f = await fixture();
  try {
    const put = async (path, bytes) => { await mkdir(dirname(join(f.root, path)), { recursive: true }); await writeFile(join(f.root, path), bytes); };
    const project = new URL('../../../../', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('tests/fixtures/ci-cadence/contract.json', project)));
    f.git('checkout', '--quiet', '--force', '--detach', f.installed);
    for (const path of [...manifest.files, 'tests/fixtures/ci-cadence/contract.json', 'scripts/ci-cadence-native.mjs', 'scripts/ci-fast.mjs', 'scripts/ci-cadence-scanner.mjs', 'package.json', 'package-lock.json', '.nvmrc', '.github/gitleaks-ci-fast.toml']) await put(path, await readFile(new URL(path, project)));
    f.git('add', '.'); const definition = f.git('commit-tree', f.git('write-tree'), '-p', f.installed, '-m', 'reviewed protected modules');
    f.git('remote', 'add', 'origin', 'https://github.com/juan294/paisaxe.git');
    const requests = [];
    const prepare = async (kind = 'push', options = {}) => {
      const base = options.definition ?? definition; const sender = options.sender ?? user();
      const input = f.prepare(kind, 'develop', base, sender, options.fork ?? false);
      f.git('checkout', '--quiet', '--force', '--detach', base);
      await put('ordinary.ts', 'export const ordinary = true;\n');
      if (options.mutate) await options.mutate({ ...f, put });
      f.git('add', '.'); const source = f.git('commit-tree', f.git('write-tree'), '-p', base, '-m', 'candidate');
      const checkout = kind === 'pull_request' ? f.git('commit-tree', f.git('write-tree'), '-p', base, '-p', source, '-m', 'native PR merge') : source;
      f.git('update-ref', 'refs/heads/fixture-candidate', checkout);
      f.git('checkout', '--quiet', '--force', '--detach', kind === 'schedule' ? base : checkout);
      input.context.sha = kind === 'schedule' ? base : checkout;
      if (kind === 'push') input.event.after = source;
      if (kind === 'pull_request') input.event.pull_request.head.sha = source;
      const request = async (url, init) => {
        requests.push({ url, method: init.method, authorization: init.headers.Authorization });
        let data = repository;
        if (url.includes('/git/ref/heads/')) { const branch = url.split('/').at(-1); data = { ref: `refs/heads/${branch}`, object: { type: 'commit', sha: branch === 'main' ? base : kind === 'schedule' || kind === 'push' ? source : base } }; }
        else if (url.includes('/git/commits/')) data = { sha: url.split('/').at(-1) };
        return new Response(JSON.stringify(data), { status: 200, headers: { 'x-ratelimit-remaining': '950' } });
      };
      // Git objects are never transported: the launcher reads this checkout.
      return { input: { ...input, token: 'fixture-token', scanner: { executable: '/opt/homebrew/bin/gitleaks', sha256: 'f414bc2fb952be6c9072b75cb411e3368614ef4b16d48dbd9ad238034afd2302' } }, transports: { request }, source, checkout, base };
    };
    return { ...f, put, definition, requests, prepare };
  } catch (error) { await f.close(); throw error; }
}
