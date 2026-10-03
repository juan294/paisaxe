import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { resolve } from 'node:path';
const strip = value => typeof value==='string'?value.replace(/^\$\{\{\s*|\s*\}\}$/g,''):value;
const callable = "(inputs.profile == 'full' || inputs.profile == 'nightly') && inputs.source_sha != '' && inputs.invocation_id != ''";
const reduced = "vars.CI_CADENCE_MODE == 'lean' && github.repository_id == '1141286326' && github.repository_owner_id == '3944118' && github.actor_id == '3944118' && github.event.sender.type == 'User' && ((github.event_name == 'push' && github.ref == 'refs/heads/develop') || (github.event_name == 'pull_request' && github.event.pull_request.base.ref == 'develop' && github.event.pull_request.user.id == 3944118 && github.event.pull_request.user.type == 'User' && github.event.pull_request.head.repo.id == 1141286326) || (github.event_name == 'schedule' && github.ref == 'refs/heads/main'))";
export function routeOriginalWorkflow(source,nativePin) {
  const launcherPin=createHash('sha256').update(readFileSync(new URL('./ci-cadence-launch.mjs',import.meta.url))).digest('hex');
  const value=parse(source),ci=value.name==='CI';
  const trusted="github.repository_id == '1141286326' && github.repository_owner_id == '3944118' && github.actor_id == '3944118' && github.event.sender.type == 'User' && (github.event_name != 'pull_request' || (github.event.pull_request.user.id == 3944118 && github.event.pull_request.user.type == 'User' && github.event.pull_request.head.repo.id == 1141286326))";
  // Secret authority is independent of cadence routing and contributor policy.
  const protect=value=>{
    if(Array.isArray(value))return value.map(protect);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,protect(v)]));
    if(typeof value==='string'&&/^\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}$/.test(value))return '${{ '+trusted+' && '+strip(value)+" || '' }}";
    return value;
  };
  for(const job of Object.values(value.jobs))if(job.steps){
    job.permissions={contents:'read'};
    job.env=job.env?protect(job.env):undefined;
    if(job.env?.SECRETS_WITHHELD_PR)job.env.SECRETS_WITHHELD_PR='${{ !('+trusted+') || ('+strip(job.env.SECRETS_WITHHELD_PR)+') }}';
    job.steps=protect(job.steps);
  }
  if(ci){
    const producer=value.jobs['coverage-merge']?.steps.find(step=>step.name==='Produce actual callable coverage JSON');
    if(!producer)throw Error('Reviewed callable producer disappeared');
    const pins=Object.fromEntries(['ci-cadence-producer.mjs','ci-cadence-coverage.mjs','ci-cadence-native.mjs'].map(name=>['scripts/'+name,createHash('sha256').update(readFileSync(new URL('./'+name,import.meta.url))).digest('hex')]));
    const expected=/Object\.entries\(\{"scripts\/ci-cadence-producer\.mjs":"[a-f0-9]{64}","scripts\/ci-cadence-coverage\.mjs":"[a-f0-9]{64}","scripts\/ci-cadence-native\.mjs":"[a-f0-9]{64}"\}\)/;
    if(!expected.test(producer.run))throw Error('Reviewed producer closure inventory changed');
    producer.run=producer.run.replace(expected,'Object.entries('+JSON.stringify(pins)+')');
  }
  const analyze=value.jobs.analyze;
  if(analyze?.steps?.some(step=>step.name==='Comment on PR')){
    const comment=analyze.steps.find(step=>step.name==='Comment on PR');
    analyze.steps=analyze.steps.filter(step=>step!==comment);
    analyze.outputs=Object.fromEntries(['static_size','server_size','total_size'].map(key=>[key,'${{ steps.bundle.outputs.'+key+' }}']));
    analyze.outputs.budget_outcome='${{ steps.budget.outcome }}';
    comment.with.script=comment.with.script.replaceAll('steps.bundle.outputs.','needs.analyze.outputs.').replaceAll('steps.budget.outcome','needs.analyze.outputs.budget_outcome');
    value.jobs['bundle-comment']={name:'Publish owner bundle comment',needs:['analyze'],if:'${{ always() && github.event_name == \'pull_request\' && '+trusted+' }}','runs-on':'ubuntu-latest',permissions:{contents:'read','pull-requests':'write'},steps:[comment]};
  }
  if(!/^[a-f0-9]{64}$/.test(nativePin)||!value.jobs||value.jobs['cadence-route'])throw Error('Original routing inventory changed');
  for(const[id,job]of Object.entries(value.jobs)) {
    if(ci&&['callable-source','callable-full'].includes(id))continue;
    job.needs=[...new Set([...(Array.isArray(job.needs)?job.needs:job.needs?[job.needs]:[]),'cadence-route'])];
    const previous=strip(job.if)??'!failure() && !cancelled()';
    job.if=`\${{ always() && (${ci&&id!=='develop_push_source'?'('+callable+') || ':''}!(${reduced}) || needs.cadence-route.outputs.run_legacy == 'true') && (${previous}) }}`;
  }
  value.jobs['cadence-route']={name:'Protected cadence routing',if:'${{ '+(ci?'!('+callable+') && ':'')+reduced+' }}','runs-on':'ubuntu-latest','timeout-minutes':2,permissions:{contents:'read'},outputs:{run_legacy:'${{ steps.route.outputs.run_legacy }}'},steps:[
    {name:'Checkout actual native event',uses:'actions/checkout@v7',with:{'fetch-depth':0,'persist-credentials':false}},
    {name:'Setup reviewed Node runtime',uses:'actions/setup-node@v7',with:{'node-version':'24.21.0'}},
    {name:'Classify protected native routing',id:'route',env:{CI_CADENCE_MODE:'${{ vars.CI_CADENCE_MODE }}',NODE_OPTIONS:'',NODE_PATH:'',GITHUB_TOKEN:'${{ github.token }}'},run:`set -euo pipefail
unset NODE_OPTIONS NODE_PATH
node --input-type=module <<'NODE'
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
let runLegacy=true,temporary;
try{
const kind=process.env.GITHUB_EVENT_NAME;
if(process.env.CI_CADENCE_MODE==='lean'&&['push','pull_request','schedule'].includes(kind)){
const revision=kind==='push'?event.before:kind==='schedule'?process.env.GITHUB_SHA:event.pull_request?.base?.sha;
if(!/^[a-f0-9]{40}$/.test(revision??'')||revision==='0'.repeat(40))throw Error('Native routing revision');
const env={PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_GRAFT_FILE:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1'};
const git=(...args)=>execFileSync('/usr/bin/git',['--no-replace-objects','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{env,timeout:5000,maxBuffer:2000000});
if(!['https://github.com/juan294/paisaxe.git','https://github.com/juan294/paisaxe'].includes(git('remote','get-url','origin').toString().trim()))throw Error('Routing origin');
if(kind==='push')git('update-ref','refs/ci-cadence/protected/'+revision,revision);
const entry=git('ls-tree',revision,'--','scripts/ci-cadence-native.mjs').toString();
const present=git('ls-tree','--name-only','-z',revision,'--','scripts/ci-cadence.mjs','.github/ci-cadence.json').toString().split('\\0').filter(Boolean);
// Genuine first installation retains the original context graph, with no
// candidate import. Partial/unknown installation also retains full work.
if(present.length===2){
if(!/^100(?:644|755) blob [a-f0-9]{40}\\t/.test(entry))throw Error('Routing module mode');
const bytes=git('show',revision+':scripts/ci-cadence-native.mjs');
if(createHash('sha256').update(bytes).digest('hex')!=='${nativePin}')throw Error('Routing reviewed bytes');
temporary=await mkdtemp(join(tmpdir(),'B-protected-route-'));
if(kind==='schedule'){
if(!/^100(?:644|755) blob [a-f0-9]{40}\\t/.test(git('ls-tree',revision,'--','scripts/ci-cadence-launch.mjs').toString()))throw Error('Routing launcher mode');
const launch=git('show',revision+':scripts/ci-cadence-launch.mjs');
if(createHash('sha256').update(launch).digest('hex')!=='${launcherPin}')throw Error('Routing launcher reviewed bytes');
await writeFile(join(temporary,'launch.mjs'),launch,{flag:'wx',mode:0o600});
const result=JSON.parse(execFileSync(process.execPath,[join(temporary,'launch.mjs')],{env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''},timeout:65000,maxBuffer:2000000,stdio:['ignore','pipe','pipe']}).toString());
runLegacy=!(result.lane==='nightly'&&result.protectedImported===true&&result.allowDeploy===false);
}else{
await writeFile(join(temporary,'native.mjs'),bytes,{flag:'wx',mode:0o600});
const native=await import(pathToFileURL(join(temporary,'native.mjs')).href);
const integer=value=>/^[1-9][0-9]*$/.test(value??'')?Number(value):NaN;
const result=await native.classifyNativeEvent({root:process.cwd(),event,eventName:kind,actor:process.env.GITHUB_ACTOR,mode:process.env.CI_CADENCE_MODE,trustedRevision:revision,context:{repository:process.env.GITHUB_REPOSITORY,repositoryId:integer(process.env.GITHUB_REPOSITORY_ID),ownerId:integer(process.env.GITHUB_REPOSITORY_OWNER_ID),actorId:integer(process.env.GITHUB_ACTOR_ID),actorType:event.sender?.type,sha:process.env.GITHUB_SHA,ref:process.env.GITHUB_REF}});
runLegacy=result.lane!=='fast';
}}}
}catch{runLegacy=true;}finally{if(temporary)await rm(temporary,{recursive:true,force:true});}
await writeFile(process.env.GITHUB_OUTPUT,'run_legacy='+String(runLegacy)+'\\n',{flag:'a'});
NODE
`}]};
  return stringify(value,{lineWidth:0});
}

/** Approved original bytes are retained verbatim. Routing may change only the
 * reviewed gate/needs/additional routing job; arbitrary new work still rejects. */
export function canonicalSource(root,path,approved) {
  const current=readFileSync(resolve(root,path),'utf8');
  if(current===approved)return approved;
  const nativePin=createHash('sha256').update(readFileSync(resolve(root,'scripts/ci-cadence-native.mjs'))).digest('hex');
  if(current!==routeOriginalWorkflow(approved,nativePin))throw Error('Canonical source drift: '+path);
  return approved;
}
