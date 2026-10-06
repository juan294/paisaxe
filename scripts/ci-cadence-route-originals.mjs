import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { resolve } from 'node:path';
const strip = value => typeof value==='string'?value.replace(/^\$\{\{\s*|\s*\}\}$/g,''):value;
const callable = "(inputs.profile == 'full' || inputs.profile == 'nightly') && inputs.source_sha != '' && inputs.invocation_id != ''";
// Schedule payloads need not carry sender: the schedule clause rests on repository/owner identity and ref only.
const reduced = "vars.CI_CADENCE_MODE == 'lean' && github.repository_id == '1141286326' && github.repository_owner_id == '3944118' && ((github.event_name == 'schedule' && github.ref == 'refs/heads/main') || (github.actor_id == '3944118' && github.event.sender.type == 'User' && ((github.event_name == 'push' && github.ref == 'refs/heads/develop') || (github.event_name == 'pull_request' && github.event.pull_request.base.ref == 'develop' && github.event.pull_request.user.id == 3944118 && github.event.pull_request.user.type == 'User' && github.event.pull_request.head.repo.id == 1141286326))))";
/** Routing is static: a skipped job starts no runner. Originals run unless the
 * event is a lean owner integration event; `!reduced` therefore keeps every
 * legacy, production and untrusted event on the complete original graph. */
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
    const previous=strip(job.if)??'!failure() && !cancelled()';
    job.if=`\${{ always() && (${ci&&id!=='develop_push_source'?'('+callable+') || ':''}!(${reduced})) && (${previous}) }}`;
  }
  return stringify(value,{lineWidth:0});
}

/** Approved original bytes are retained verbatim. Routing may change only the
 * reviewed gate/needs/additional routing job; arbitrary new work still rejects. */
export function canonicalSource(root,path,approved) {
  const current=readFileSync(resolve(root,path),'utf8');
  if(current===approved)return approved;
  if(current!==routeOriginalWorkflow(approved))throw Error('Canonical source drift: '+path);
  return approved;
}
