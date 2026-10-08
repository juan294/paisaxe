import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareStack } from './prepare-contract-stack.mjs';
import { inspectStack, localDockerEnvironment, runContracts } from './run-contracts.mjs';
import { stopTransport } from './contract-transport.mjs';

// Only fixed fields cross the artifact boundary. Runner diagnostics remain private.
export function publicContractReceipt(receipt, failure) {
  const result = { version: 1, status: !failure && receipt?.status === 'passed' ? 'passed' : 'failed',
    failure: failure || (receipt?.status === 'passed' ? null : 'contracts'),
    suiteCount: Array.isArray(receipt?.suites) ? receipt.suites.length : 0,
    caseCount: Array.isArray(receipt?.cases) ? receipt.cases.reduce((sum, file) => sum + (Array.isArray(file.cases) ? file.cases.length : 0), 0) : 0,
    providerFixturesQualified: receipt?.providerFixtures?.exitCode === 0 };
  for (const key of ['candidateDigest', 'migrationDigest']) if (/^[a-f0-9]{64}$/.test(receipt?.[key] || '')) result[key] = receipt[key];
  if (/^paisaxe-contracts-[a-f0-9]{12}$/.test(receipt?.projectId || '')) result.projectId = receipt.projectId;
  return result;
}

export async function stopOwnedStack(manifest, env, { inspect = inspectStack, command = execFileSync, stop = stopTransport } = {}) {
  await inspect(manifest, env);
  const options = { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 };
  const [network] = JSON.parse(command('docker', ['network', 'inspect', manifest.projectId], options));
  if (!network?.Internal || network.Labels?.['com.paisaxe.contracts.nonce'] !== manifest.nonce) throw Error('CI cleanup ownership rejected');
  const ids = Object.keys(network.Containers || {});
  if (!ids.length || !ids.every(id => /^[a-f0-9]{64}$/.test(id))) throw Error('CI cleanup inventory rejected');
  for (const id of ids) {
    const [container] = JSON.parse(command('docker', ['container', 'inspect', id], options));
    if (container.Id !== id || container.Name !== '/' + network.Containers[id].Name ||
      !container.Name.startsWith('/supabase_') || !container.Name.endsWith('_' + manifest.projectId) ||
      container.Config?.Labels?.['com.supabase.cli.project'] !== manifest.projectId ||
      JSON.stringify(Object.keys(container.NetworkSettings?.Networks || {})) !== JSON.stringify([manifest.projectId])) throw Error('CI cleanup container rejected');
  }
  // Immutable IDs avoid stopping a replacement with a reused container name.
  try { await stop(manifest, env); }
  finally { command('docker', ['stop', '--time', '10', ...ids], { ...options, timeout: 90000 }); }
}

export async function runCIContracts({ prepare = prepareStack, run = runContracts, cleanup = stopOwnedStack,
  dockerEnvironment = localDockerEnvironment, runnerTemp: temporary = process.env.RUNNER_TEMP,
  directory: output = process.env.CI_CONTRACT_RECEIPT_DIR } = {}) {
  if (!temporary || !output) throw Error('CI receipt directory rejected');
  const runnerTemp = realpathSync(temporary);
  const directory = resolve(output);
  const inside = relative(runnerTemp, directory);
  if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw Error('CI receipt directory rejected');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const physical = relative(runnerTemp, realpathSync(directory));
  if (!physical || physical.startsWith('..') || isAbsolute(physical)) throw Error('CI receipt directory rejected');
  let manifest; let receipt; let failure = 'preparation'; let env;
  try {
    env = dockerEnvironment();
    manifest = await prepare();
    failure = 'contracts';
    receipt = await run({ taskDir: manifest.taskDir, outputDir: join(directory, 'private') });
    if (receipt.status === 'passed') failure = undefined;
  } catch { /* Fixed public reason only; private runner diagnostics are never logged. */ }
  finally {
    if (manifest) {
      try { await cleanup(manifest, env); } catch { failure = 'cleanup'; }
    }
    writeFileSync(join(directory, 'receipt.json'), JSON.stringify(publicContractReceipt(receipt, failure), null, 2) + '\n', { mode: 0o600 });
  }
  return !failure && receipt?.status === 'passed';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await runCIContracts() ? 0 : 1; }
  catch { console.error('Database contract CI setup failed'); process.exitCode = 1; }
}
