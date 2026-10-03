import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { protectedGitEnvironment } from './ci-cadence-native.mjs';
import { projectFullGraph } from './ci-cadence-projection.mjs';
import { createGitHubCadenceReader } from './ci-cadence-github.mjs';
import { decideNightlyRun, decideCompatibleNightly, finalizeCompletedRun } from './ci-cadence-run.mjs';
import { writeNativeMeasurement } from './ci-cadence-producer.mjs';
import { publishVerifiedCoverage } from './ci-cadence-publish.mjs';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && value !== '0'.repeat(40);
const digest = value => createHash('sha256').update(value).digest('hex');
const need = condition => { if (!condition) throw Error('Protected B native control evidence unavailable'); };
const workflow = '.github/workflows/ci-nightly.yml';

/** Only the trusted pre-import loader may call this function. Catalogue and
 * every definition are actual immutable Git blobs, never artifact-authored
 * graphs. A hint can select a lookup commit; it cannot select executable code. */
export function buildFullState({ root, definitionSha, authoritySha = definitionSha, sourceSha, runId, attempt, callerPath = workflow, runtime = { node: process.version, platform: process.platform, architecture: process.arch } }) {
  need(sha(definitionSha) && sha(authoritySha) && sha(sourceSha) && Number.isSafeInteger(runId) && runId > 0 && Number.isSafeInteger(attempt) && attempt > 0);
  const git = (...args) => execFileSync('git', ['--no-replace-objects','-c','core.useReplaceRefs=false','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args], { cwd: root, env: protectedGitEnvironment(), timeout: 5000, maxBuffer: 2_000_000, stdio: ['ignore','pipe','pipe'] });
  const blob = (revision,path) => { need(/^100(?:644|755) blob [a-f0-9]{40}\t/.test(git('ls-tree',revision,'--',path).toString())); return git('show',`${revision}:${path}`); };
  const policyBytes = blob(authoritySha,'.github/ci-cadence.json');
  const catalogueBytes = blob(authoritySha,'.github/ci-cadence-native.json');
  need(policyBytes.equals(blob(definitionSha,'.github/ci-cadence.json')) && catalogueBytes.equals(blob(definitionSha,'.github/ci-cadence-native.json')));
  const policy = JSON.parse(policyBytes), catalogue = JSON.parse(catalogueBytes);
  const caller=catalogue.callers?.[callerPath]??(callerPath===workflow?catalogue.caller:null);
  need(catalogue.schemaVersion === 1 && catalogue.repository === 'juan294/paisaxe' && ['.github/workflows/ci-cadence.yml',workflow].includes(callerPath) && caller?.path===callerPath && /^v24\./.test(runtime.node) && runtime.platform === 'linux' && runtime.architecture === 'x64');
  for(const [path,pin] of Object.entries(catalogue.workflowPins)) need(git('rev-parse',`${definitionSha}:${path}`).toString().trim() === pin);
  const profile=callerPath===workflow?'nightly':'develop_push';
  const projected = projectFullGraph({ protectedPolicy:policy, profile, definitionSha, sourceSha, caller,
    callees:Object.fromEntries(Object.entries(catalogue.callees).map(([path,callee])=>[path,{...callee,definitionSha}])),
    auxiliaryJobs:catalogue.censusByCaller?.[callerPath]??catalogue.auxiliaryJobs, stepInventory:catalogue.stepInventory,
    admissionJob:'Cadence admission', admissionStep:'Upload Cadence admission', measurementJob:'Cadence measurement', measurementStep:'Upload Cadence measurement' });
  need(projected.available);
  const expected = { repository:'juan294/paisaxe', sourceSha, targetBranch:'develop', definitionSha,
    policyFingerprint:digest(policyBytes), helperFingerprint:digest(blob(definitionSha,'scripts/ci-cadence.mjs')),
    lockfileFingerprint:digest(blob(sourceSha,'package-lock.json')), runtimeFingerprint:digest(JSON.stringify(runtime)) };
  return { expected, policy:projected.policy, projection:projected.projection, workflow:callerPath, runId, attempt };
}

export async function admitNightly(state, options = {}) {
  const decision = options.resolveState?await decideCompatibleNightly(state,options):await decideNightlyRun(state,options);
  if(decision.action !== 'full') return { decision, admission:null };
  return { decision, admission:{ schemaVersion:1, kind:'ci-cadence-admission', ...state.expected,
    runId:state.runId, attempt:state.attempt, workflow:state.workflow, lane:'nightly', testedCheckoutSha:state.expected.sourceSha,
    workflowDefinitionSha:state.policy.workflows[0].definitionSha, workflowPins:state.projection.workflowPins,
    jobs:state.policy.workflows[0].jobs, contexts:state.policy.workflows[0].contexts } };
}

/** Expose only original authenticated identity, never the raw history/artifacts.
 * The frozen failed chooser omits attempt; recover it from its validated row. */
export function admissionDisposition({decision}) {
  need(['full','skip','blocked'].includes(decision?.action) && (decision.reason === undefined || typeof decision.reason==='string' && decision.reason.length<=2000 && !/[\x00-\x1f\x7f]/.test(decision.reason)));
  const output={action:decision.action,reason:decision.reason,publishCoverage:false};
  if(decision.action==='full')return output;
  const rows=Array.isArray(decision.history?.entries)?decision.history.entries.map(row=>row.receipt):[...(decision.history?.receipts??[])];
  const matches=rows.filter(row=>row?.runId===decision.runId && (decision.attempt===undefined||row.attempt===decision.attempt) && (decision.completedAt===undefined||row.completedAt===decision.completedAt));
  need(matches.length<=1);const original=matches[0];
  if(!original){need(decision.action==='blocked' && decision.runId===undefined);return output;}
  need(Number.isSafeInteger(original.runId)&&original.runId>0&&Number.isSafeInteger(original.attempt)&&original.attempt>0&&sha(original.sourceSha)&&original.targetBranch==='develop'
    && original.runUrl===`https://github.com/juan294/paisaxe/actions/runs/${original.runId}`&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(original.completedAt??'')&&Number.isFinite(Date.parse(original.completedAt))
    && ['.github/workflows/ci-cadence.yml','.github/workflows/ci-nightly.yml'].includes(original.workflow));
  for(const key of ['sourceSha','targetBranch','runId','attempt','runUrl','workflow'])output[key]=original[key];
  if(original.kind==='native-running-evidence'){output.admissionCompletedAt=original.completedAt;output.evidenceKind=original.kind;}
  else output.completedAt=original.completedAt;
  return output;
}

/** Concrete CLI invoked exclusively by the reviewed builtins-only loader. */
export async function controlMain(purpose, { definitionSha, sourceSha, root = process.cwd() }) {
  need(process.env.CI_CADENCE_MODE === 'lean');
  const runId = Number(process.env.GITHUB_RUN_ID), attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const token = process.env.GITHUB_TOKEN;
  if(purpose === 'admit') {
    need(['push','schedule'].includes(process.env.GITHUB_EVENT_NAME) && process.env.GITHUB_REPOSITORY === 'juan294/paisaxe' && process.env.GITHUB_REPOSITORY_ID === '1141286326' && process.env.GITHUB_REPOSITORY_OWNER_ID === '3944118');
    const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
    const push=process.env.GITHUB_EVENT_NAME==='push';
    // Schedule payloads need not carry sender: schedule trust is repository/owner identity and the default ref.
    need(push?process.env.GITHUB_ACTOR_ID==='3944118'&&event.sender?.id===3944118&&event.sender.type==='User'&&event.before===definitionSha&&event.after===sourceSha&&event.ref==='refs/heads/develop'&&process.env.GITHUB_SHA===sourceSha:process.env.GITHUB_REF==='refs/heads/main'&&process.env.GITHUB_SHA===definitionSha);
    const state = buildFullState({root,definitionSha,sourceSha,runId,attempt,callerPath:push?'.github/workflows/ci-cadence.yml':workflow});
    const result = push?{decision:{action:'full'},admission:{schemaVersion:1,kind:'ci-cadence-admission',...state.expected,runId,attempt,workflow:state.workflow,lane:'full',testedCheckoutSha:sourceSha,workflowDefinitionSha:state.policy.workflows[0].definitionSha,workflowPins:state.projection.workflowPins,jobs:state.policy.workflows[0].jobs,contexts:state.policy.workflows[0].contexts}}:await admitNightly(state,{token,resolveState:values=>buildFullState({root,authoritySha:definitionSha,...values})});
    if(result.admission){need(process.env.CI_CADENCE_EVIDENCE_DIR?.startsWith('/'));await mkdir(process.env.CI_CADENCE_EVIDENCE_DIR,{mode:0o700});await writeFile(resolve(process.env.CI_CADENCE_EVIDENCE_DIR,'admission.json'),JSON.stringify(result.admission),{flag:'wx',mode:0o600});}
    const disposition=admissionDisposition(result);
    if(process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT,`decision=${disposition.action}\nsource_sha=${sourceSha}\ndefinition_sha=${definitionSha}\n`+Object.entries({original_run_id:disposition.runId,original_attempt:disposition.attempt,original_run_url:disposition.runUrl,original_completed_at:disposition.completedAt,original_admission_completed_at:disposition.admissionCompletedAt,original_evidence_kind:disposition.evidenceKind,original_source_sha:disposition.sourceSha,original_target_branch:disposition.targetBranch,original_workflow:disposition.workflow}).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}=${value}\n`).join(''),{flag:'a'});
    return disposition;
  }
  if(purpose === 'measure') {
    const state = buildFullState({root,definitionSha,sourceSha,runId,attempt,callerPath:process.env.GITHUB_EVENT_NAME==='push'?'.github/workflows/ci-cadence.yml':workflow});
    need(process.env.CI_CADENCE_EVIDENCE_DIR?.startsWith('/'));
    const application = JSON.parse(await readFile(resolve(process.env.CI_CADENCE_EVIDENCE_DIR,'application.json'),'utf8'));
    return writeNativeMeasurement({state,application,reader:createGitHubCadenceReader({token}),output:resolve(process.env.CI_CADENCE_EVIDENCE_DIR,'measurement.json')});
  }
  if(purpose === 'finalize') {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
    need(process.env.GITHUB_EVENT_NAME === 'workflow_run' && event.action === 'completed' && event.repository?.id === 1141286326 && event.repository.owner?.id === 3944118);
    const reader = createGitHubCadenceReader({token});
    if(event.workflow_run?.path==='.github/workflows/coverage.yml'){
      need(event.workflow_run.status==='completed'&&event.workflow_run.conclusion==='success'&&event.workflow_run.head_branch==='main'&&sha(event.workflow_run.head_sha));
      const git=(...args)=>execFileSync('git',['--no-replace-objects','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{cwd:root,env:protectedGitEnvironment(),timeout:5000,maxBuffer:2000000}).toString().trim();
      const catalogue=JSON.parse(git('show',definitionSha+':.github/ci-cadence-native.json'));
      need(catalogue.coverageOnly?.path===event.workflow_run.path);
      const result=await reader.readStandaloneCoverage({runId:event.workflow_run.id,attempt:event.workflow_run.run_attempt,sourceSha:event.workflow_run.head_sha,workflowPin:catalogue.coverageOnly.blobSha,stepInventory:catalogue.coverageOnly.steps});
      need(result.available&&result.scope==='coverage-only'&&result.reusable===false);
      if(result.unchangedSkip)return{published:false,scope:'coverage-only',unchangedSkip:true,reusable:false};
      need(result.application.evidence.treeSha===git('rev-parse',event.workflow_run.head_sha+'^{tree}'));
      const published=await publishVerifiedCoverage(result.coverage,{secret:process.env.COVERAGE_SECRET});
      return{...published,scope:'coverage-only',reusable:false};
    }
    const hint = await reader.readAdmissionHint({runId:event.workflow_run?.id,attempt:event.workflow_run?.run_attempt,workflow:event.workflow_run?.path});
    if(!hint.available){
      need(event.workflow_run.status==='completed'&&event.workflow_run.conclusion==='success');
      // This lookup authenticates every original no-admission disposition. A
      // missing or malformed measuring artifact cannot become publication.
      const state=buildFullState({root,definitionSha,sourceSha:event.workflow_run.event==='push'?event.workflow_run.head_sha:sourceSha??event.workflow_run.head_sha,runId:event.workflow_run.id,attempt:event.workflow_run.run_attempt,callerPath:event.workflow_run.path});
      const history=await reader.collectCompatibleHistory({head:state.expected,resolveState:values=>buildFullState({root,authoritySha:definitionSha,...values})});
      need(history.complete&&history.nonmeasuring.some(row=>row.runId===event.workflow_run.id&&row.attempt===event.workflow_run.run_attempt&&row.workflow===event.workflow_run.path));
      return{available:true,published:false,reusable:false,scope:'nonmeasuring-disposition'};
    }
    need(hint.available && hint.trusted === false && ['schedule','push'].includes(hint.run.event) && (hint.run.event==='schedule'?hint.run.head_sha===hint.value.definitionSha:hint.run.head_sha===hint.value.sourceSha) && sha(hint.value.sourceSha));
    // The finalized nightly is default-defined and runs develop. It can be
    // reusable after independent native authentication, but never publishes
    // B's main-only coverage. Push/main compatibility remains its legacy path.
    const state = buildFullState({root,authoritySha:definitionSha,definitionSha:hint.value.definitionSha,sourceSha:hint.value.sourceSha,runId:hint.run.id,attempt:hint.run.run_attempt,callerPath:hint.run.path});
    const result = await finalizeCompletedRun({...state,event,eventName:'workflow_run'},{token});
    need(result.available && result.receipt && result.publishCoverage === false);
    return {available:true,published:false,receipt:result.receipt};
  }
  throw Error('Unsupported native control purpose');
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try{const result=await controlMain(process.argv[2],{definitionSha:process.env.CI_CADENCE_DEFINITION_SHA,sourceSha:process.env.CI_CADENCE_SOURCE_SHA});console.log(JSON.stringify(result));if(result.action==='blocked')process.exitCode=1;}
  catch{console.error('Protected native control failed; no publication or retry');process.exitCode=1;}
}
