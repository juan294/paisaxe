import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {artifactDigest} from './run-paid-voice-local.mjs';

function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'paid-voice-artifact-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const write=(path,value)=>{const file=join(root,'.next',path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);};
 write('BUILD_ID','original-build');
 write('server/app/page.js','compiled-server');
 write('static/chunks/page.js','compiled-client');
 return {root,write};
}

test('production seal ignores only the Next server runtime route cache',t=>{
 const {root,write}=fixture(t),before=artifactDigest(root);
 write('server/route-cache/APP_PAGE/runtime/pricing.html','runtime-render');
 assert.equal(artifactDigest(root),before);
 write('server/route-cache/APP_PAGE/runtime/pricing.html','updated-runtime-render');
 assert.equal(artifactDigest(root),before);
});

for(const path of ['BUILD_ID','server/app/page.js','static/chunks/page.js','static/route-cache/page.js','server/chunks/route-cache/page.js']){
 test('production seal detects changed compiled artifact '+path,t=>{
  const {root,write}=fixture(t);write(path,'before');const before=artifactDigest(root);
  write(path,'after');assert.notEqual(artifactDigest(root),before);
 });
}

test('production seal rejects a missing BUILD_ID',t=>{
 const {root}=fixture(t);rmSync(join(root,'.next/BUILD_ID'));
 assert.throws(()=>artifactDigest(root),{code:'ENOENT'});
});
