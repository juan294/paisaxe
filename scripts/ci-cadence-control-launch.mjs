import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const PINS = {
  "scripts/ci-cadence-publish.mjs": "aa7bc0ddec18d73bc732f2cd30fe32d0b73d1c4ddee2d050f70ee30b99711f25",
  "scripts/ci-cadence-control.mjs": "b0dfdd16f6035e69a7797daad99d74dbc3ee6ed07bbd26796f5ad86ac41a128f",
  "scripts/ci-cadence-projection.mjs": "aaeea5200fe40d88942796a8187a12b1a0a8dde6b3a5491bbc2e27c87e545b31",
  "scripts/ci-cadence-run.mjs": "ef1b11904bba6fb5cd210a1ec060ac5314fe262f644535deb63a88860f847b84",
  "scripts/ci-cadence-github.mjs": "b58ff93639ffeaa15b7e63b9fb71069b1600731a588b5e37632361576d4730f4",
  "scripts/ci-cadence-producer.mjs": "7b21806e84b690deb6ca889d79f60c0fefae1f1ca53a8b6073022970932a0f3e",
  "scripts/ci-cadence-coverage.mjs": "f5a6fa57a388781c7d3714021f2196b83f1b54e59b611327956aa17e1b02bddf",
  "scripts/ci-cadence-native.mjs": "3d570d2624d653496c38c0430ea3d6b20bb8507e383f1cad9233def089ce44a5",
  "scripts/ci-cadence.mjs": "9f2da9ab55525a3ca4acc311feaf5426fc86d83258c5dda7754dc05405c9a7ab"
};
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && value !== '0'.repeat(40);
const origin = 'https://github.com/juan294/paisaxe.git';
const env = () => ({PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_GRAFT_FILE:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:`AUTHORIZATION: bearer ${process.env.GITHUB_TOKEN}`});

/** Trusted workflow acquires these builtins-only bytes before executing them.
 * This loader cannot authenticate a contributor-controlled copy of itself. */
export async function launchControl({purpose,root,definitionSha,sourceSha,originalSha}, {gitTransport} = {}) {
  let directory;
  const deadline = performance.now()+60000;
  const git=(...args)=>{const timeout=Math.min(10000,Math.floor(deadline-performance.now()));if(timeout<1)throw Error('Control acquisition deadline');return execFileSync('git',['--no-replace-objects','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.useReplaceRefs=false',...args],{cwd:root,env:env(),timeout,maxBuffer:2_000_000,stdio:['ignore','pipe','pipe']});};
  const check=()=>{if(!sha(originalSha)||git('rev-parse','HEAD').toString().trim()!==originalSha||![origin,origin.slice(0,-4)].includes(git('remote','get-url','origin').toString().trim())||git('rev-parse','--is-shallow-repository').toString().trim()!=='false')throw Error('Native control physical identity');};
  try{
    if(typeof process.env.GITHUB_TOKEN!=='string'||!process.env.GITHUB_TOKEN||/[\r\n]/.test(process.env.GITHUB_TOKEN)||process.env.NODE_OPTIONS?.trim()||process.execArgv.some(arg=>/^--(?:require|import|loader|experimental-loader)(?:=|$)/.test(arg)||arg==='-r')||!['admit','measure','finalize'].includes(purpose)||!sha(definitionSha))throw Error('Control identity');
    check();
    const acquire=async id=>{if(!sha(id))throw Error('Control immutable object');const ref=`refs/ci-cadence/control/${id}`;if(gitTransport){let timer;try{await Promise.race([gitTransport({root,url:origin,sha:id,ref}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Control transport deadline')),Math.min(10000,deadline-performance.now()));})]);}finally{clearTimeout(timer);}}else git('-c','protocol.file.allow=never','-c','protocol.ssh.allow=never','-c','credential.helper=','-c','http.followRedirects=false','fetch','--no-tags','--no-recurse-submodules','--force',origin,`${id}:${ref}`);if(git('rev-parse',`${ref}^{commit}`).toString().trim()!==id)throw Error('Control object acquisition failed');};
    await acquire(definitionSha);
    if(purpose==='finalize'){
      const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
      if(process.env.GITHUB_EVENT_NAME!=='workflow_run'||event.action!=='completed'||event.repository?.id!==1141286326||event.repository.owner?.id!==3944118||!(['push','schedule'].includes(event.workflow_run?.event)||(event.workflow_run?.path==='.github/workflows/coverage.yml'&&event.workflow_run?.event==='workflow_dispatch'))||!['.github/workflows/ci-cadence.yml','.github/workflows/ci-nightly.yml','.github/workflows/coverage.yml'].includes(event.workflow_run?.path)||!sha(event.workflow_run.head_sha))throw Error('Completed native identity');
      await acquire(event.workflow_run.head_sha);
    }else{if(!sha(sourceSha))throw Error('Control source identity');await acquire(sourceSha);}
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
  catch{console.error('Protected control acquisition failed; no retry or publication');process.exitCode=1;}
}
