import { readFileSync, writeFileSync, lstatSync, realpathSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { generateRemainingWorkflows } from './ci-cadence-remaining-workflows.mjs';
import { generateExtraWorkflows } from './ci-cadence-extra-workflows.mjs';
import { routeOriginalWorkflow } from './ci-cadence-route-originals.mjs';
const canonical = '.github/workflows/';
const fastJobPath = '.github/ci-cadence-fast-job.yml';
const calls = { ci:'ci.yml', e2e:'ci-cadence-e2e-full.yml', lighthouse:'ci-cadence-lighthouse-full.yml', 'bundle-size':'ci-cadence-bundle-size-full.yml', knip:'ci-cadence-knip-full.yml', 'license-check':'ci-cadence-license-check-full.yml', security:'ci-cadence-security-full.yml' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
const permission = {contents:'read',actions:'read',checks:'read','pull-requests':'read'};
const acquired = (file,purpose,root) => {
  const pin = sha256(readFileSync(resolve(root,'scripts/'+file)));
  return `set -euo pipefail
unset NODE_OPTIONS NODE_PATH
while IFS= read -r name; do unset "$name"; done < <(compgen -v | sed -n '/^GIT_/p')
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1 GIT_GRAFT_FILE=/dev/null
[[ "$CI_CADENCE_DEFINITION_SHA" =~ ^[a-f0-9]{40}$ ]]
private="$(mktemp -d "$RUNNER_TEMP/B-control.XXXXXXXX")"
chmod 700 "$private"
trap 'rm -rf "$private"' EXIT
git --no-replace-objects -c core.hooksPath=/dev/null -c core.fsmonitor=false show "$CI_CADENCE_DEFINITION_SHA:scripts/${file}" > "$private/${file}"
printf '%s  %s\n' '${pin}' "$private/${file}" | sha256sum --check --status
node "$private/${file}" ${purpose}
`;
};
function standaloneCoverage(root) {
  const retainedPath='tests/fixtures/ci-cadence-adapter/native/coverage-original.json';
  const bytes=readFileSync(resolve(root,retainedPath));
  if(sha256(bytes)!=='37edfd50e06893729b41042dfe295ec46761d0937f062df645bee7ed5bd179c5')throw Error('Original standalone coverage source changed');
  const original=JSON.parse(bytes).source,value=parse(original),job=value.jobs.coverage;
  // Coverage runs on main push, schedule and dispatch; a schedule payload need not carry sender.
  const owner="github.repository_id == '1141286326' && github.repository_owner_id == '3944118' && (github.event_name == 'schedule' || (github.actor_id == '3944118' && github.event.sender.type == 'User'))";
  const lean="vars.CI_CADENCE_MODE == 'lean' && "+owner;
  job.permissions={contents:'read'};
  job.steps[0].name='Checkout measured main source';job.steps[0].with={'fetch-depth':0,'persist-credentials':false};
  job.steps[1].name='Setup reviewed Node runtime';job.steps[1].with['node-version']='24.21.0';
  job.steps[2].name='Install dependencies';
  const retained=JSON.parse(readFileSync(resolve(root,'tests/fixtures/ci-cadence-adapter/native/routing-originals.json')));
  const ci=parse(routeOriginalWorkflow(retained.files.find(f=>f.path===canonical+'ci.yml').source));
  const before=structuredClone(ci.jobs['coverage-merge'].steps.find(step=>step.name==='Verify callable source checkout'));
  const after=structuredClone(ci.jobs['coverage-merge'].steps.find(step=>step.name==='Verify completed callable source checkout'));
  for(const guard of [before,after]){guard.if='${{ '+lean+' }}';guard.env={...guard.env,SOURCE_SHA:'${{ github.sha }}'};}
  job.steps.splice(1,0,before);
  const suite=job.steps.find(step=>step.name==='Run authoritative coverage suite');
  const previous=suite.run;
  const eligibility={name:'Decide weekly native coverage eligibility',id:'cadence-calendar',env:{CI_CADENCE_MODE:'${{ vars.CI_CADENCE_MODE }}',NATIVE_OWNER:'${{ '+owner+' }}'},run:`set -euo pipefail
if test "$CI_CADENCE_MODE" = lean && test "$NATIVE_OWNER" = true && test "$GITHUB_EVENT_NAME" = schedule && test "$(date -u +%u)" != 1; then
  echo 'eligible=false' >> "$GITHUB_OUTPUT"
else
  echo 'eligible=true' >> "$GITHUB_OUTPUT"
fi
`};
  job.steps.unshift(eligibility);
  for(const step of job.steps)if(step!==eligibility)step.if='${{ steps.cadence-calendar.outputs.eligible == \'true\' }}';
  before.if='${{ steps.cadence-calendar.outputs.eligible == \'true\' && '+lean+' }}';
  after.if=before.if;
  suite.env={CI_CADENCE_MODE:'${{ vars.CI_CADENCE_MODE }}',NATIVE_OWNER:'${{ '+owner+' }}'};
  suite.run=`set -euo pipefail
if test "$CI_CADENCE_MODE" = lean && test "$NATIVE_OWNER" = true; then
node --input-type=module <<'NODE'
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const directory=join(process.env.RUNNER_TEMP,'ci-cadence-app-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
await mkdir(directory,{mode:0o700});
const result=spawnSync('npm',['run','test:coverage','--','--reporter=default','--reporter=json','--outputFile='+join(directory,'vitest.json')],{stdio:'inherit',timeout:900000});
await writeFile(join(directory,'exit.json'),JSON.stringify({code:result.status,signal:result.signal,expired:result.error?.code==='ETIMEDOUT',overflow:false,spawnError:Boolean(result.error)}),{flag:'wx',mode:0o600});
if(result.status!==0||result.signal||result.error)throw Error('Actual standalone coverage failed');
NODE
else
${previous}
fi
`;
  const producer=structuredClone(ci.jobs['coverage-merge'].steps.find(step=>step.name==='Produce actual callable coverage JSON'));
  producer.name='Produce measured standalone coverage';producer.if='${{ steps.cadence-calendar.outputs.eligible == \'true\' && '+lean+' }}';producer.env.SOURCE_SHA='${{ github.sha }}';
  const closure=producer.run.slice(producer.run.indexOf('          const env=')>=0?producer.run.indexOf('          const env='):producer.run.indexOf('const env='));
  producer.run=`node --input-type=module <<'NODE'
import {execFileSync} from 'node:child_process';
import {writeFile,rm,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const directory=join(process.env.RUNNER_TEMP,'ci-cadence-app-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
${closure}`;
  const report=job.steps.find(step=>step.name==='Report coverage to Portfolio');
  report.if='${{ steps.cadence-calendar.outputs.eligible == \'true\' && !('+lean+') && '+owner+' }}';
  const reportIndex=job.steps.indexOf(report);job.steps.splice(reportIndex,0,after,producer,{name:'Upload measured standalone coverage',if:'${{ steps.cadence-calendar.outputs.eligible == \'true\' && '+lean+' }}',uses:'actions/upload-artifact@v7',with:{name:'ci-cadence-coverage',path:'${{ runner.temp }}/ci-cadence-app-${{ github.run_id }}-${{ github.run_attempt }}/application.json','if-no-files-found':'error','retention-days':90}});
  return {path:canonical+'coverage.yml',source:stringify(value,{lineWidth:0})};
}
function nativeWorkflows(root) {
  const enabled = "vars.CI_CADENCE_MODE == 'lean' && github.repository_id == '1141286326' && github.repository_owner_id == '3944118'";
  const native = [ {name:'Checkout native definition',uses:'actions/checkout@v7',with:{ref:'${{ github.sha }}','fetch-depth':0,'persist-credentials':false}}, {name:'Setup reviewed Node runtime',uses:'actions/setup-node@v7',with:{'node-version':'24.21.0'}} ];
  const evidence = '${{ runner.temp }}/B-cadence-evidence-${{ github.run_id }}-${{ github.run_attempt }}';
  const environment = { GITHUB_TOKEN:'${{ github.token }}', CI_CADENCE_MODE:'${{ vars.CI_CADENCE_MODE }}', CI_CADENCE_DEFINITION_SHA:'${{ github.sha }}', CI_CADENCE_EVIDENCE_DIR:evidence, NODE_OPTIONS:'',NODE_PATH:'' };
  const launch = acquired('ci-cadence-launch.mjs','',root).replace(/node "\$private\/ci-cadence-launch.mjs" \n$/,`node "$private/ci-cadence-launch.mjs" > "$RUNNER_TEMP/B-native.json"
python3 - <<'PY' >> "$GITHUB_ENV"
import json,os,re
with open(os.path.join(os.environ['RUNNER_TEMP'],'B-native.json')) as f: result=json.load(f)
assert result.get('lane')=='nightly' and result.get('protectedImported') is True and result.get('allowDeploy') is False
source=result.get('sourceSha','')
assert re.fullmatch('[a-f0-9]{40}',source)
print('CI_CADENCE_SOURCE_SHA='+source)
PY
`);
  const jobs = { admission: {name:'Cadence admission',if:enabled,'runs-on':'ubuntu-latest','timeout-minutes':6,permissions:permission,
    outputs:Object.fromEntries(['decision','source_sha','definition_sha','original_run_id','original_attempt','original_run_url','original_completed_at','original_admission_completed_at','original_evidence_kind','original_source_sha','original_target_branch','original_workflow'].map(key=>[key,'${{ steps.admit.outputs.'+key+' }}'])),
    steps:[...native,{name:'Resolve once and authenticate native source',env:environment,run:launch},{name:'Admit actual complete nightly graph',id:'admit',env:environment,run:acquired('ci-cadence-control-launch.mjs','admit',root)},{name:'Upload Cadence admission',if:"steps.admit.outputs.decision == 'full'",uses:'actions/upload-artifact@v7',with:{name:'ci-cadence-admission',path:evidence+'/admission.json','if-no-files-found':'error','retention-days':90}}] } };
  for(const [slug,path]of Object.entries(calls)) jobs[slug]={needs:['admission'],if:"needs.admission.outputs.decision == 'full'",uses:'./'+canonical+path,permissions:permission,with:{source_sha:'${{ needs.admission.outputs.source_sha }}',profile:'nightly',invocation_id:slug},...(slug==='e2e'?{secrets:Object.fromEntries(['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_KEY','QA_TEST_USER_EMAIL','QA_TEST_USER_PASSWORD'].map(k=>[k,'${{ secrets.'+k+' }}']))}:slug==='security'?{secrets:{VERCEL_TOKEN:'${{ secrets.VERCEL_TOKEN }}'}}:{})};
  jobs.measurement={name:'Cadence measurement',needs:['admission',...Object.keys(calls)],if:"always() && needs.admission.outputs.decision == 'full' && "+Object.keys(calls).map(id=>`needs.${id}.result == 'success'`).join(' && '),'runs-on':'ubuntu-latest',permissions:permission,'timeout-minutes':6,
    steps:[...native,{name:'Download actual callable application metrics',uses:'actions/download-artifact@v8',with:{name:'ci.artifact-ci-cadence-app',path:evidence}},{name:'Produce authenticated native measurement',env:{...environment,CI_CADENCE_DEFINITION_SHA:'${{ needs.admission.outputs.definition_sha }}',CI_CADENCE_SOURCE_SHA:'${{ needs.admission.outputs.source_sha }}'},run:acquired('ci-cadence-control-launch.mjs','measure',root)},{name:'Upload Cadence measurement',uses:'actions/upload-artifact@v7',with:{name:'ci-cadence-measurement',path:evidence+'/measurement.json','if-no-files-found':'error','retention-days':90}}]};
  jobs.complete={name:'Nightly disposition',needs:['admission',...Object.keys(calls),'measurement'],if:'${{ always() && '+enabled+' }}','runs-on':'ubuntu-latest',permissions:permission,steps:[{name:'Require real full proof or unchanged skip',env:{ADMISSION:'${{ needs.admission.result }}',DECISION:'${{ needs.admission.outputs.decision }}',...Object.fromEntries(['original_run_id','original_attempt','original_run_url','original_completed_at','original_admission_completed_at','original_evidence_kind','original_source_sha','original_target_branch','original_workflow'].map(key=>[key.toUpperCase(),'${{ needs.admission.outputs.'+key+' }}'])),MEASURED:'${{ needs.measurement.result }}',...Object.fromEntries(Object.keys(calls).map((id,i)=>['CHILD_'+i,'${{ needs.'+id+'.result }}']))},run:`set -euo pipefail\nif test "$DECISION" = skip || test "$DECISION" = blocked; then\n  node --input-type=module <<'NODE'\nconst result={action:process.env.DECISION};\nfor(const key of ['RUN_ID','ATTEMPT','RUN_URL','COMPLETED_AT','ADMISSION_COMPLETED_AT','EVIDENCE_KIND','SOURCE_SHA','TARGET_BRANCH','WORKFLOW']){const value=process.env['ORIGINAL_'+key];if(value)result[key.toLowerCase()]=value;}\nconsole.log(JSON.stringify(result));\nif(process.env.GITHUB_STEP_SUMMARY)await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY,JSON.stringify(result)+'\\n');\nNODE\nfi\ntest "$ADMISSION" = success\ncase "$DECISION" in\nfull) test "$MEASURED" = success; for result in ${Object.keys(calls).map((_,i)=>'"$CHILD_'+i+'"').join(' ')}; do test "$result" = success; done ;;\nskip) test "$MEASURED" = skipped; for result in ${Object.keys(calls).map((_,i)=>'"$CHILD_'+i+'"').join(' ')}; do test "$result" = skipped; done ;;\n*) exit 1 ;;\nesac\n`}]};
  const nightly={name:'CI nightly',on:{schedule:[{cron:'0 3 * * *'}]},permissions:permission,concurrency:{group:'B-nightly-${{ github.run_id }}-${{ github.run_attempt }}','cancel-in-progress':false},jobs};
  const fastRoot=structuredClone(nightly);
  fastRoot.name='CI cadence';fastRoot.on={push:{branches:['develop']},pull_request:{branches:['develop']}};
  fastRoot.concurrency={group:'B-cadence-${{ github.ref }}','cancel-in-progress':true};
  // The inlined job IS the `CI Fast` context and the only routine runner. It has
  // no mode term, so it is produced under legacy too; recovery children start
  // only on a lean "full" decision, and legacy keeps its original workflows.
  const fastJob=parse(readFileSync(resolve(root,fastJobPath),'utf8'));
  const rootGuard=fastJob.if.replace(/\s+/g,' ').trim();
  fastRoot.jobs.entry={...fastJob,if:rootGuard,permissions:{contents:'read'}};
  fastRoot.jobs.admission.needs=['entry'];
  fastRoot.jobs.admission.if="needs.entry.outputs.decision == 'full' && github.event_name == 'push'";
  fastRoot.jobs.admission.steps=fastRoot.jobs.admission.steps.filter(s=>s.name!=='Resolve once and authenticate native source');
  for(const step of fastRoot.jobs.admission.steps)if(step.env)step.env={...step.env,CI_CADENCE_DEFINITION_SHA:'${{ needs.entry.outputs.definition_sha }}',CI_CADENCE_SOURCE_SHA:'${{ needs.entry.outputs.source_sha }}'};
  for(const slug of Object.keys(calls)){const j=fastRoot.jobs[slug];j.needs=['entry','admission'];j.if="always() && needs.entry.result == 'success' && needs.entry.outputs.decision == 'full' && (github.event_name == 'pull_request' || needs.admission.result == 'success')";j.with.profile='full';j.with.source_sha='${{ needs.entry.outputs.checkout_sha }}';}
  fastRoot.jobs.measurement.needs=['entry','admission',...Object.keys(calls)];
  fastRoot.jobs.measurement.if="always() && github.event_name == 'push' && needs.entry.outputs.decision == 'full' && needs.admission.result == 'success' && "+Object.keys(calls).map(id=>`needs.${id}.result == 'success'`).join(' && ');
  for(const step of fastRoot.jobs.measurement.steps)if(step.env)step.env={...step.env,CI_CADENCE_DEFINITION_SHA:'${{ needs.entry.outputs.definition_sha }}',CI_CADENCE_SOURCE_SHA:'${{ needs.entry.outputs.source_sha }}'};
  // Starts a runner only when recovery children ran; otherwise skipped at no cost.
  fastRoot.jobs.complete.name='CI Fast recovery';fastRoot.jobs.complete.needs=['entry','admission',...Object.keys(calls),'measurement'];fastRoot.jobs.complete.if="${{ always() && "+rootGuard+" && needs.entry.outputs.decision == 'full' }}";
  fastRoot.jobs.complete.steps=[{name:'Require every full recovery child',env:{ENTRY:'${{ needs.entry.result }}',ADMISSION:'${{ needs.admission.result }}',EVENT:'${{ github.event_name }}',MEASURED:'${{ needs.measurement.result }}',...Object.fromEntries(Object.keys(calls).map((id,i)=>['CHILD_'+i,'${{ needs.'+id+'.result }}']))},run:`set -euo pipefail
test "$ENTRY" = success
for result in ${Object.keys(calls).map((_,i)=>'"$CHILD_'+i+'"').join(' ')}; do test "$result" = success; done
if test "$EVENT" = push; then test "$ADMISSION" = success; test "$MEASURED" = success; else test "$ADMISSION" = skipped; test "$MEASURED" = skipped; fi
`}];
  return [{path:canonical+'ci-nightly.yml',source:stringify(nightly,{lineWidth:0})}, {path:canonical+'ci-cadence.yml',source:stringify(fastRoot,{lineWidth:0})},
    {path:canonical+'ci-cadence-finalize.yml',source:stringify({name:'CI cadence completed evidence',on:{workflow_run:{workflows:['CI nightly','CI cadence','Coverage'],types:['completed']}},permissions:permission,concurrency:{group:'B-finalize-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}','cancel-in-progress':false},jobs:{finalize:{if:enabled,'runs-on':'ubuntu-latest',permissions:permission,'timeout-minutes':6,steps:[...native,{name:'Authenticate original completed attempt',env:{...environment,COVERAGE_SECRET:"${{ github.event.workflow_run.path == '.github/workflows/coverage.yml' && secrets.COVERAGE_SECRET || '' }}"},run:acquired('ci-cadence-control-launch.mjs','finalize',root)}]}}},{lineWidth:0})}];
}
export function generateNativeWorkflows(root=process.cwd()) {
  root=resolve(root);
  if(realpathSync(root)!==root)throw Error('Canonical native generator root required');
  const retainedPath='tests/fixtures/ci-cadence-adapter/native/routing-originals.json';
  const retained=readFileSync(resolve(root,retainedPath));
  if(sha256(retained)!=='aa7076ca3ac3563de5447d5c3ed1b315b7dcba496e4f61d7ce6c48794ffdee90')throw Error('Retained routing source authority changed');
  const originals=JSON.parse(retained).files;
  const routed=originals.map(file=>({path:file.path,source:routeOriginalWorkflow(file.source)}));
  const files=[...routed,...generateRemainingWorkflows(root),...generateExtraWorkflows(root),...nativeWorkflows(root),standaloneCoverage(root)];
  const byPath=Object.fromEntries(files.map(file=>[file.path,file.source]));
  const source=path=>byPath[path]??readFileSync(resolve(root,path),'utf8');
  const policy=JSON.parse(readFileSync(resolve(root,'.github/ci-cadence.json')));
  const callees={},stepInventory={},auxiliaryJobs=[];
  for(const[slug,path]of Object.entries(calls)) {
    const fullPath=canonical+path,definition=parse(source(fullPath));
    callees[canonical+slug+'.yml']={path:fullPath,prefix:slug,blobSha:blob(source(fullPath))};
    const original=policy.workflows.find(w=>w.path===canonical+slug+'.yml');if(!original)throw Error('Canonical app catalogue changed');
    for(const app of original.jobs){const id=app.id.startsWith('ci-coverage-shard-')?'coverage-shard':app.id.slice(slug.length+1);const job=definition.jobs[id];if(!job)throw Error('Callable app disappeared');const steps=job.steps.map(step=>step.name);if(steps.some(name=>typeof name!=='string'||!name)||new Set(steps).size!==steps.length)throw Error('Explicit step census required');stepInventory[app.id]=[...steps,'Set up job','Complete job',...job.steps.filter(step=>step.uses).map(step=>'Post '+step.name)];}
    for(const id of ['callable-source','callable-full']){const job=definition.jobs[id];if(!job)throw Error('Callable auxiliary disappeared');auxiliaryJobs.push({name:slug+' / '+job.name,conclusions:['success'],steps:[...job.steps.map(step=>({name:step.name,conclusions:['success']})),{name:'Set up job',conclusions:['success']},{name:'Complete job',conclusions:['success']}]});}
    if(slug==='ci')auxiliaryJobs.push({name:'ci / develop_push_source',conclusions:['skipped'],steps:[]});
  }
  auxiliaryJobs.push({name:'Nightly disposition',conclusions:['success'],steps:[{name:'Require real full proof or unchanged skip',conclusions:['success']},{name:'Set up job',conclusions:['success']},{name:'Complete job',conclusions:['success']}]});
  const pins=Object.fromEntries([canonical+'ci-nightly.yml',canonical+'ci-cadence.yml',...Object.values(callees).map(c=>c.path)].map(path=>[path,blob(source(path))]));
  const pushAuxiliary=auxiliaryJobs.filter(j=>j.name!=='Nightly disposition');
  const fast=parse(readFileSync(resolve(root,fastJobPath),'utf8'));
  pushAuxiliary.push({name:fast.name,conclusions:['success'],steps:fast.steps.map(s=>({name:s.name,conclusions:['success']})).concat([{name:'Set up job',conclusions:['success']},{name:'Complete job',conclusions:['success']}])});
  pushAuxiliary.push({name:'CI Fast recovery',conclusions:['success'],steps:[{name:'Require every full recovery child',conclusions:['success']},{name:'Set up job',conclusions:['success']},{name:'Complete job',conclusions:['success']}]});
  const coverageDefinition=parse(source(canonical+'coverage.yml'));
  const coverageOnly={path:canonical+'coverage.yml',blobSha:blob(source(canonical+'coverage.yml')),steps:coverageDefinition.jobs.coverage.steps.map(step=>({name:step.name,conclusions:step.name==='Decide weekly native coverage eligibility'?['success']:step.name==='Report coverage to Portfolio'?['skipped']:['success','skipped'],post:Boolean(step.uses)}))};
  const callers=Object.fromEntries(['ci-nightly.yml','ci-cadence.yml'].map(path=>[canonical+path,{path:canonical+path,blobSha:pins[canonical+path]}]));
  files.push({path:'.github/ci-cadence-native.json',source:JSON.stringify({schemaVersion:1,repository:'juan294/paisaxe',caller:callers[canonical+'ci-nightly.yml'],callers,callees,coverageOnly,workflowPins:pins,stepInventory,auxiliaryJobs,censusByCaller:{[canonical+'ci-nightly.yml']:auxiliaryJobs,[canonical+'ci-cadence.yml']:pushAuxiliary}},null,2)+'\n'});
  const updatedPolicy=structuredClone(policy);for(const w of updatedPolicy.workflows)w.definitionSha=blob(source(w.path));
  files.push({path:'.github/ci-cadence.json',source:JSON.stringify(updatedPolicy,null,2)+'\n'});
  return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const files=generateNativeWorkflows();for(const file of files){const target=resolve(file.path);if(existsSync(target)){const info=lstatSync(target);if(!info.isFile()||info.nlink!==1||realpathSync(target)!==target)throw Error('Owned regular native output required');}}if(process.argv[2]==='--check'){for(const file of files)if(readFileSync(file.path,'utf8')!==file.source)throw Error('Native workflow drift');}else if(process.argv.length===2){for(const file of files)writeFileSync(file.path,file.source);}else throw Error('Expected --check or no argument');console.log(JSON.stringify(files.map(f=>f.path)));}catch(error){console.error(error.message);process.exitCode=1;}
}
