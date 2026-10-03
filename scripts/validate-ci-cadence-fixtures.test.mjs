import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateFrozenContract } from './validate-ci-cadence-fixtures.mjs';

test('frozen validator rejects a manifest that omits the contract and detects changed bytes', async () => {
  const root=await mkdtemp(join(tmpdir(),'cadence-contract-'));
  const source=new URL('../',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('tests/fixtures/ci-cadence/contract.json',source),'utf8'));
  for(const file of [...manifest.files,'tests/fixtures/ci-cadence/contract.json']) {
    await mkdir(dirname(join(root,file)),{recursive:true});
    await writeFile(join(root,file),await readFile(new URL(file,source)));
  }
  const url=pathToFileURL(root+'/');
  assert.equal((await validateFrozenContract(url)).valid,true);
  const path=join(root,'tests/fixtures/ci-cadence/contract.json');
  await writeFile(path,JSON.stringify({...manifest,files:[],checksum:createHash('sha256').digest('hex')}));
  await assert.rejects(()=>validateFrozenContract(url),/inventory/);
  await writeFile(path,JSON.stringify(manifest));
  await writeFile(join(root,'scripts/ci-cadence.mjs'),'changed helper');
  await assert.rejects(()=>validateFrozenContract(url),/checksum/);
});
