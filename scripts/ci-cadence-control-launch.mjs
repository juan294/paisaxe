import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const PINS = {
  "scripts/ci-cadence-publish.mjs": "aa7bc0ddec18d73bc732f2cd30fe32d0b73d1c4ddee2d050f70ee30b99711f25",
  "scripts/ci-cadence-control.mjs": "49d3b7b0c81b7220d004b238d80a0feae8f75b9f70fd2a139189cd6bcbb68fca",
  "scripts/ci-cadence-projection.mjs": "6fa7715ef08772937f668e3d2fc9bba27a01414a9118f9b5dfecf620fb8e0319",
  "scripts/ci-cadence-run.mjs": "ef1b11904bba6fb5cd210a1ec060ac5314fe262f644535deb63a88860f847b84",
  "scripts/ci-cadence-github.mjs": "8fd9db069e1cef6b2ed191acac2e4877d27ba781a5bac1de118d3e99566e63d8",
  "scripts/ci-cadence-producer.mjs": "4d74ebfe878bce9477151313d376d04d830c75a7314cfab09272eb53102e7a78",
  "scripts/ci-cadence-coverage.mjs": "a32f5a65db83b73ad517131520c1be4ac011921e7b2c98131e7d5fc34b125f58",
  "scripts/ci-cadence-native.mjs": "a3003983077830deae27ba692c15533edc12a9e987d96d98f8951607bb49563d",
  "scripts/ci-cadence.mjs": "9f2da9ab55525a3ca4acc311feaf5426fc86d83258c5dda7754dc05405c9a7ab"
};
// A failure is reported only from this fixed vocabulary, never a git or module
// message that could carry stderr, paths or tokens.
export const CONTROL_REASONS = Object.freeze(['Control acquisition deadline','Native control physical identity','Control identity','Control immutable object','Control object absent from checkout','Control object acquisition failed','Completed native identity','Control source identity','Control module mode','Control reviewed closure mismatch']);
export const controlFailure = error => error instanceof Error && CONTROL_REASONS.includes(error.message) ? error.message : 'unclassified';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && value !== '0'.repeat(40);
const origin = 'https://github.com/juan294/paisaxe.git';
const env = () => ({PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_GRAFT_FILE:'/dev/null',GIT_TERMINAL_PROMPT:'0'});

/** Trusted workflow acquires these builtins-only bytes before executing them.
 * This loader cannot authenticate a contributor-controlled copy of itself.
 * Every object comes from the job's own fetch-depth 0 checkout: nothing is fetched. */
export async function launchControl({purpose,root,definitionSha,sourceSha,originalSha}) {
  let directory;
  const deadline = performance.now()+60000;
  const git=(...args)=>{const timeout=Math.min(10000,Math.floor(deadline-performance.now()));if(timeout<1)throw Error('Control acquisition deadline');return execFileSync('git',['--no-replace-objects','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.useReplaceRefs=false',...args],{cwd:root,env:env(),timeout,maxBuffer:2_000_000,stdio:['ignore','pipe','pipe']});};
  const check=()=>{if(!sha(originalSha)||git('rev-parse','HEAD').toString().trim()!==originalSha||![origin,origin.slice(0,-4)].includes(git('remote','get-url','origin').toString().trim())||git('rev-parse','--is-shallow-repository').toString().trim()!=='false')throw Error('Native control physical identity');};
  try{
    if(typeof process.env.GITHUB_TOKEN!=='string'||!process.env.GITHUB_TOKEN||/[\r\n]/.test(process.env.GITHUB_TOKEN)||process.env.NODE_OPTIONS?.trim()||process.execArgv.some(arg=>/^--(?:require|import|loader|experimental-loader)(?:=|$)/.test(arg)||arg==='-r')||!['admit','measure','finalize'].includes(purpose)||!sha(definitionSha))throw Error('Control identity');
    check();
    const acquire=id=>{if(!sha(id))throw Error('Control immutable object');let type;try{type=git('cat-file','-t',id).toString().trim();}catch{throw Error('Control object absent from checkout');}if(type!=='commit')throw Error('Control object absent from checkout');const ref=`refs/ci-cadence/control/${id}`;git('update-ref',ref,id);if(git('rev-parse',`${ref}^{commit}`).toString().trim()!==id)throw Error('Control object acquisition failed');};
    acquire(definitionSha);
    if(purpose==='finalize'){
      const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
      if(process.env.GITHUB_EVENT_NAME!=='workflow_run'||event.action!=='completed'||event.repository?.id!==1141286326||event.repository.owner?.id!==3944118||!(['push','schedule'].includes(event.workflow_run?.event)||(event.workflow_run?.path==='.github/workflows/coverage.yml'&&event.workflow_run?.event==='workflow_dispatch'))||!['.github/workflows/ci-cadence.yml','.github/workflows/ci-nightly.yml','.github/workflows/coverage.yml'].includes(event.workflow_run?.path)||!sha(event.workflow_run.head_sha))throw Error('Completed native identity');
      acquire(event.workflow_run.head_sha);
    }else{if(!sha(sourceSha))throw Error('Control source identity');acquire(sourceSha);}
    directory=await mkdtemp(join(tmpdir(),'paisaxe-protected-control-'));
    for(const[path,pin]of Object.entries(PINS)){
      if(!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(git('ls-tree',definitionSha,'--',path).toString()))throw Error('Control module mode');
      const bytes=git('show',`${definitionSha}:${path}`);if(createHash('sha256').update(bytes).digest('hex')!==pin)throw Error('Control reviewed closure mismatch');
      const target=join(directory,path);await mkdir(dirname(target),{recursive:true,mode:0o700});await writeFile(target,bytes,{flag:'wx',mode:0o600});
    }
    check();
    const control=await import(pathToFileURL(join(directory,'scripts/ci-cadence-control.mjs')).href);
    const result=await control.controlMain(purpose,{root,definitionSha,sourceSha});check();return result;
  }finally{if(directory)await rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=await launchControl({purpose:process.argv[2],root:process.cwd(),definitionSha:process.env.CI_CADENCE_DEFINITION_SHA,sourceSha:process.env.CI_CADENCE_SOURCE_SHA,originalSha:process.env.GITHUB_SHA});console.log(JSON.stringify(result));if(result.action==='blocked')process.exitCode=1;}
  catch(error){console.error(`Protected control acquisition failed (${controlFailure(error)}); no retry or publication`);process.exitCode=1;}
}
