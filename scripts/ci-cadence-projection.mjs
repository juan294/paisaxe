import { validatePolicy } from './ci-cadence.mjs';

const REPOSITORY = 'juan294/paisaxe';
const OMITTED = ['coverage-coverage','e2e-stripe-integration-e2e-stripe','preview-smoke-preview-smoke'];
const REQUIRED = {
  'ci-lint-and-typecheck': ['Run typecheck','Check verification coverage wiring','Run lint','Check env vars documented','Validate migrations','Check circular dependencies'],
  ...Object.fromEntries([1,2,3,4].map(n=>['ci-coverage-shard-'+n,['Run tests with coverage (sharded)']])),
  'ci-coverage-merge': ['Merge reports and enforce coverage thresholds'],
  'ci-test': ['Verify callable test/coverage suite'],
  'ci-build': ['Build'],
  'e2e-e2e': ['Run E2E tests with authenticated journey'],
  'e2e-visual-regression': ['Run visual regression tests'],
  'lighthouse-lighthouse': ['Run Lighthouse CI (desktop)','Run Lighthouse CI (mobile)'],
  'bundle-size-analyze': ['Build','Enforce per-route bundle budget'],
  'knip-knip': ['Run Knip (dead code detection)'],
  'license-check-license-check': ['Check production licenses (blocking allowlist)'],
  'security-gitleaks': ['Run Gitleaks'],
  'security-audit': ['Run security audit (production deps)'],
  'security-vercel-env-safety': ['Assert legacy agent override is absent from Vercel env'],
};
const record = v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const path=v=>typeof v==='string'&&/^\.github\/workflows\/[A-Za-z0-9_.-]+\.yml$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const names=values=>Array.isArray(values)&&values.length>0&&new Set(values).size===values.length&&values.every(v=>['success','skipped'].includes(v));

/** This is protected definition data, not caller authentication or proof of
 * GitHub's actual reusable job names. Before native acceptance, acquire the
 * named definitions and confirm their blob bytes and qualified names. Nightly
 * requires all 17 app leaves; unavailable provider/Auth proof must block rather
 * than reclassify those leaves as optional. Release uses original full graph. */
export function projectFullGraph(input) {
  try {
    const {protectedPolicy,profile,definitionSha,caller,callees,auxiliaryJobs,admissionJob,admissionStep,measurementJob,measurementStep}=input??{};
    if(!['nightly','develop_push'].includes(profile)||!validatePolicy(protectedPolicy).valid||protectedPolicy.repository!==REPOSITORY||protectedPolicy.defaultBranch!=='main'||protectedPolicy.integrationBranch!=='develop'||protectedPolicy.productionBranch!=='main'||!same(protectedPolicy.owners,['juan294'])||!sha(definitionSha)||!record(caller)||!path(caller.path)||!sha(caller.blobSha)||!record(callees))throw Error('identity');
    const all=protectedPolicy.workflows.flatMap(w=>w.jobs.map(j=>({ ...j, path:w.path, display:Object.entries(w.contexts).find(([,ids])=>ids.length===1&&ids[0]===j.id)?.[0] })));
    if(!same(all.map(j=>j.id).sort(),Object.keys(REQUIRED).concat(OMITTED).sort()))throw Error('inventory');
    const applications=all.filter(j=>!OMITTED.includes(j.id));
    const paths=[...new Set(applications.map(j=>j.path))];
    if(!same(Object.keys(callees).sort(),paths.sort()))throw Error('callees');
    const values=Object.values(callees);
    if(values.some(c=>!record(c)||!path(c.path)||!sha(c.blobSha)||c.definitionSha!==definitionSha||typeof c.prefix!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(c.prefix)||c.path===caller.path)||new Set(values.map(c=>c.path)).size!==values.length||new Set(values.map(c=>c.prefix)).size!==values.length)throw Error('callee identity');
    const jobs=applications.map(j=>({id:j.id,needs:[...j.needs]}));
    for(const j of jobs){const required=j.id==='ci-coverage-merge'?[1,2,3,4].map(n=>'ci-coverage-shard-'+n):j.id==='ci-test'?[1,2,3,4].map(n=>'ci-coverage-shard-'+n).concat('ci-coverage-merge'):[];if(!same(j.needs,required))throw Error('dependencies');}
    const bindings=Object.fromEntries(applications.map(j=>{if(!j.display)throw Error('context');return[j.id,`${callees[j.path].prefix} / ${j.display}`];}));
    const known=Object.values(bindings).concat(admissionJob,measurementJob);
    if(new Set(known).size!==known.length||![admissionJob,admissionStep,measurementJob,measurementStep].every(v=>typeof v==='string'&&v.length>0))throw Error('producers');
    if(!Array.isArray(auxiliaryJobs)||auxiliaryJobs.length>32||new Set(auxiliaryJobs.map(j=>j?.name)).size!==auxiliaryJobs.length||auxiliaryJobs.some(j=>!record(j)||typeof j.name!=='string'||!j.name||known.includes(j.name)||!names(j.conclusions)||!Array.isArray(j.steps)||new Set(j.steps.map(s=>s?.name)).size!==j.steps.length||j.steps.some(s=>!record(s)||typeof s.name!=='string'||!s.name||!names(s.conclusions))))throw Error('auxiliary census');
    const contexts=Object.fromEntries(applications.map(j=>[bindings[j.id],[j.id]]));
    const policy={...protectedPolicy,workflows:[{path:caller.path,definitionSha:caller.blobSha,jobs,contexts}]};
    if(!validatePolicy(policy).valid)throw Error('projected policy');
    const workflowPins=Object.fromEntries(values.map(c=>[c.path,c.blobSha]));workflowPins[caller.path]=caller.blobSha;
    const extra=input.auxiliaryWorkflows??[];
    if(!Array.isArray(extra)||extra.length>1||extra.some(c=>profile!=='develop_push'||!record(c)||c.path!=='.github/workflows/ci-fast.yml'||!sha(c.blobSha)||workflowPins[c.path]))throw Error('auxiliary workflow');
    for(const c of extra)workflowPins[c.path]=c.blobSha;
    const ignoredSteps=Object.fromEntries(applications.map(j=>[j.id,[]]));
    if(input.stepInventory!==undefined){
      if(!record(input.stepInventory)||!same(Object.keys(input.stepInventory).sort(),applications.map(j=>j.id).sort()))throw Error('step census');
      for(const j of applications){const inventory=input.stepInventory[j.id];if(!Array.isArray(inventory)||new Set(inventory).size!==inventory.length||inventory.some(name=>typeof name!=='string'||!name)||REQUIRED[j.id].some(name=>!inventory.includes(name))||!inventory.includes('Verify callable source checkout'))throw Error('step census');ignoredSteps[j.id]=inventory.filter(name=>!REQUIRED[j.id].includes(name));}
    }
    const calleeSha=profile==='develop_push'?input.sourceSha:definitionSha;if(!sha(calleeSha))throw Error('native callee source');
    return {available:true,nativeNamesVerified:false,policy,projection:{kind:'full',jobs:bindings,steps:structuredClone(REQUIRED),ignoredSteps,workflowPins,workflowSources:Object.fromEntries(Object.keys(workflowPins).map(p=>[p,p===caller.path?definitionSha:calleeSha])),referencedWorkflows:values.concat(extra).map(c=>({path:`${REPOSITORY}/${c.path}@refs/heads/${profile==='nightly'?'main':'develop'}`,sha:calleeSha,ref:`refs/heads/${profile==='nightly'?'main':'develop'}`})),admissionJob,admissionStep,measurementJob,measurementStep,census:{schemaVersion:1,profile,auxiliaryJobs:structuredClone(auxiliaryJobs)}}};
  }catch{return{available:false,error:'protected complete B projection unavailable'};}
}
