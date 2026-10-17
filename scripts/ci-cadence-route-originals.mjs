import { automaticOriginalWorkflow } from './ci-routing-native-v2.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { resolve } from 'node:path';
const LEGACY_ROUTED_SHA256 = {".github/workflows/ci.yml":"69a645b1d027704c4973206481cf7f18ef91b45b73b92229fc8dd0e5f2acc84f",".github/workflows/e2e.yml":"8d2326646adc32011865dbf96ea061564a14621c6dc0263094365c66f29e1f8c",".github/workflows/lighthouse.yml":"784117d878c37405363cbca5f3a989bdb3fe45de3b47983ed68e128f8611b650",".github/workflows/bundle-size.yml":"151662136f47983ed7e1758e9c2b287ffaacfbee735d727e63e4bfdc1d2c9d08",".github/workflows/knip.yml":"0657dade5e1c8308f659c1924f49f91063bda45ea74c399c525ff60e2b22c91c",".github/workflows/license-check.yml":"66564c12cb576a7c96e86dbf8e2353f8544d7a35b873e5c86cd49dc7c271a6db",".github/workflows/security.yml":"f778a1f0a5f4f019db4e644e820bf15a148cd84a023a92775a0b12d309576786"};
const strip = value => typeof value==='string'?value.replace(/^\$\{\{\s*|\s*\}\}$/g,''):value;
const callable = "(inputs.profile == 'full' || inputs.profile == 'nightly') && inputs.source_sha != '' && inputs.invocation_id != ''";
// Schedule payloads need not carry sender: the schedule clause rests on repository/owner identity and ref only.

/** Protected Sutura planning selects the original application graphs.
 * Every applicable full child is enforced by its stable workflow gate. */
export function routeOriginalWorkflow(source) {
  const value=parse(source),ci=value.name==='CI';
  const trusted="github.repository_id == '1141286326' && github.repository_owner_id == '3944118' && (github.event_name == 'schedule' || (github.actor_id == '3944118' && github.event.sender.type == 'User' && (github.event_name != 'pull_request' || (github.event.pull_request.user.id == 3944118 && github.event.pull_request.user.type == 'User' && github.event.pull_request.head.repo.id == 1141286326))))";
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
    const test=value.jobs.test;
    const ordinary=test.steps.find(step=>step.name==='Verify test/coverage suite succeeded')?.if;
    const checkoutGuard=test.steps.findIndex(step=>step.name==='Verify callable source checkout');
    const completed=test.steps.findIndex(step=>step.name==='Verify completed callable source checkout');
    if(!ordinary||checkoutGuard<0||completed<0)throw Error('Reviewed Test source guards disappeared');
    const receipt="${{ runner.temp }}/database-contracts-${{ github.run_id }}-${{ github.run_attempt }}-${{ inputs.invocation_id || 'ordinary' }}";
    test['timeout-minutes']=50;
    test.steps.splice(completed,0,
      {name:'Setup database contract Node',uses:'actions/setup-node@v7',with:{'node-version':'24.21.0'}},
      {name:'Install database contract dependencies',run:'npm ci'},
      {name:'Setup database contract Supabase',uses:'supabase/setup-cli@v3',with:{version:'2.120.0'}},
      {name:'Check database contract PostgreSQL client',run:'command -v psql\npsql --version'},
      {name:'Run required database contracts',run:'node scripts/ci-contracts.mjs','timeout-minutes':43,env:{CI_CONTRACT_RECEIPT_DIR:receipt}},
      {name:'Upload sanitized database contract receipt',if:'${{ always() }}',uses:'actions/upload-artifact@v7',with:{name:"database-contracts-${{ github.run_id }}-${{ github.run_attempt }}-${{ inputs.invocation_id || 'ordinary' }}",path:receipt+'/receipt.json','if-no-files-found':'error','retention-days':7}});
    test.steps.splice(checkoutGuard+1,0,{name:'Checkout database contract source',if:ordinary,uses:'actions/checkout@v7',with:{ref:'${{ github.sha }}','fetch-depth':0,'persist-credentials':false}});
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
  if(!value.jobs||value.jobs['cadence-route'])throw Error('Original routing inventory changed');
  for(const[id,job]of Object.entries(value.jobs)) {
    if(ci&&['callable-source','callable-full'].includes(id))continue;
    const previous=strip(job.if)??'true';
    job.if=`\${{ always() && (${previous}) }}`;
  }
  return stringify(automaticOriginalWorkflow(value),{lineWidth:0});
}

/** Approved original bytes are retained verbatim. Routing may change only the
 * reviewed gate/needs/additional routing job; arbitrary new work still rejects. */
export function canonicalSource(root,path,approved) {
  const current=readFileSync(resolve(root,path),'utf8');
  if(current===approved)return approved;
  if(current!==routeOriginalWorkflow(approved) && LEGACY_ROUTED_SHA256[path]!==createHash('sha256').update(current).digest('hex'))throw Error('Canonical source drift: '+path);
  return approved;
}
