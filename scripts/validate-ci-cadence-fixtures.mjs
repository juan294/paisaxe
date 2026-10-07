import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { contractChecksum, validateFixtures } from './ci-cadence.mjs';
import { measureCadence } from './measure-ci-cadence.mjs';

export const CONTRACT_FILES = [
  'scripts/ci-cadence.mjs', 'scripts/ci-cadence.test.mjs',
  'scripts/measure-ci-cadence.mjs', 'scripts/measure-ci-cadence.test.mjs',
  'scripts/validate-ci-cadence-fixtures.mjs', 'scripts/validate-ci-cadence-fixtures.test.mjs',
  ...['policy','events','history','graph','jobs'].map(name => `tests/fixtures/ci-cadence/${name}.json`),
].sort();

export async function validateFrozenContract(root = new URL('../', import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('tests/fixtures/ci-cadence/contract.json', root), 'utf8'));
  const validation = await validateFixtures(new URL('tests/fixtures/ci-cadence/', root));
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  const measurement = measureCadence(JSON.parse(await readFile(new URL('tests/fixtures/ci-cadence/jobs.json', root), 'utf8')));
  if (!measurement.scan_complete || measurement.netSavings !== null || measurement.hostedRoundedMinutes !== 5) throw new Error('measurement fixture contract mismatch');
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length !== CONTRACT_FILES.length || manifest.files.some((path,index) => path !== CONTRACT_FILES[index])) throw new Error('contract manifest inventory must contain the complete frozen file set');
  const checksum = await contractChecksum(CONTRACT_FILES, root);
  const helperSha256 = createHash('sha256').update(await readFile(new URL('scripts/ci-cadence.mjs', root))).digest('hex');
  if (checksum !== manifest.checksum || helperSha256 !== manifest.helperSha256) throw new Error('frozen contract checksum mismatch; review version changes before updating the manifest');
  return { valid: true, schemaVersion: 1, checksum, helperSha256, eventCases: validation.eventCases };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await validateFrozenContract(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
