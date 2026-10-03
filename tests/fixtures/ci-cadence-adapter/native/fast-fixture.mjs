import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fixture } from './fixture.mjs';

export const scanner = { executable: '/opt/homebrew/bin/gitleaks', sha256: 'f414bc2fb952be6c9072b75cb411e3368614ef4b16d48dbd9ad238034afd2302' };
export async function fastFixture() {
  const f = await fixture();
  try {
    f.git('checkout', '--quiet', '--force', '--detach', f.installed);
    const put = async (path, bytes) => { await mkdir(dirname(join(f.root, path)), { recursive: true }); await writeFile(join(f.root, path), bytes); };
    const root = new URL('../../../../', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('tests/fixtures/ci-cadence/contract.json', root)));
    for (const path of [...manifest.files, 'tests/fixtures/ci-cadence/contract.json', 'package.json', 'package-lock.json', '.nvmrc', '.gitleaks.toml']) await put(path, await readFile(new URL(path, root)));
    f.git('add', '.');
    const base = f.git('commit-tree', f.git('write-tree'), '-p', f.installed, '-m', 'Fast protected inputs');
    f.git('update-ref', `refs/ci-cadence/protected/${base}`, base);
    const commit = () => { f.git('add', '.'); const sha = f.git('commit-tree', f.git('write-tree'), '-p', f.git('rev-parse', 'HEAD'), '-m', 'candidate'); f.git('checkout', '--quiet', '--force', '--detach', sha); f.git('update-ref', 'refs/remotes/origin/develop', sha); return sha; };
    const prepare = async (mutate = async () => {}, kind = 'push') => {
      const input = f.prepare(kind, 'develop', base);
      f.git('checkout', '--quiet', '--force', '--detach', base);
      await put('ordinary.ts', 'export const ordinary = true;\n'); await mutate({ ...f, put });
      const source = commit();
      const checkout = kind === 'pull_request' ? f.git('commit-tree', f.git('rev-parse', `${source}^{tree}`), '-p', base, '-p', source, '-m', 'actual PR merge') : source;
      f.git('checkout', '--quiet', '--force', '--detach', checkout);
      f.git('update-ref', 'refs/remotes/origin/develop', kind === 'pull_request' ? base : source);
      input.context.sha = checkout;
      if (kind === 'pull_request') input.event.pull_request.head.sha = source;
      else input.event.after = source;
      return { ...input, scanner, source, checkout };
    };
    return { ...f, base, put, commit, prepare };
  } catch (error) { await f.close(); throw error; }
}
