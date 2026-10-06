import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
function delivery(change={}){
 const root=mkdtempSync(join(tmpdir(),'B-coverage-transport-'));
 try{
  writeFileSync(join(root,'curl'),`#!/bin/sh
next=''
for argument in "$@"; do
 if [ "$next" = body ]; then printf '%s' "$argument" > "$CAPTURE_BODY"; fi
 if [ "$next" = header ]; then case "$argument" in X-Coverage-Signature-256:*) printf '%s' "$argument" > "$CAPTURE_SIGNATURE" ;; esac; fi
 next=''
 case "$argument" in --data-binary) next=body ;; -H) next=header ;; esac
done
printf 200
`,{mode:0o700});
  const result=spawnSync('/bin/bash',['scripts/report-coverage.sh'],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:5000,env:{PATH:root+':'+process.env.PATH,HOME:process.env.HOME,CAPTURE_BODY:join(root,'body'),CAPTURE_SIGNATURE:join(root,'signature'),COVERAGE_SECRET:'signing-fixture',REPO:'juan294/paisaxe',TEST_COUNT:'2',TEST_FILES:'1',TESTS_PASSED:'2',TESTS_FAILED:'0',COVERAGE_PERCENT:'99',SOURCE_COMMIT_SHA:'a'.repeat(40),COVERAGE_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'3',COVERAGE_WORKFLOW_REF:'juan294/paisaxe/.github/workflows/coverage.yml@refs/heads/main',SOURCE_TARGET_BRANCH:'main',COVERAGE_REPORTED_AT:'2026-10-03T00:00:00Z',COVERAGE_MAX_ATTEMPTS:'1',...change}});
  return{...result,body:existsSync(join(root,'body'))?readFileSync(join(root,'body'),'utf8'):null,signature:existsSync(join(root,'signature'))?readFileSync(join(root,'signature'),'utf8'):null};
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('actual legacy Bash publisher signs original numeric native measuring attempt',()=>{
 const result=delivery();assert.equal(result.status,0,result.stderr);const payload=JSON.parse(result.body);assert.equal(payload.source.attempt,3);assert.equal(payload.source.runId,'123');assert.equal(result.signature,'X-Coverage-Signature-256: sha256='+createHmac('sha256','signing-fixture').update(result.body).digest('hex'));assert.ok(!result.body.includes('signing-fixture'));
});
for(const attempt of ['0','02','bad','9007199254740992'])test('native legacy publisher refuses malformed measuring attempt '+attempt,()=>{
 const result=delivery({GITHUB_RUN_ATTEMPT:attempt});assert.notEqual(result.status,0);assert.equal(result.body,null);
});
test('explicit original native attempt wins over finalizer job attempt',()=>{
 const result=delivery({COVERAGE_RUN_ATTEMPT:'2'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.body).source.attempt,2);
});
test('local-batch delivery remains compatible without fabricating a native attempt',()=>{
 const result=delivery({COVERAGE_PROVIDER:'local-batch',GITHUB_RUN_ATTEMPT:''});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.body).source.attempt,undefined);
});
