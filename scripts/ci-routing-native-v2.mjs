import { protectedLoaderScript, mandatoryFullExpression, gateRunScript } from './ci-routing-workflow-v2.mjs';

const requiredByName = {
  CI: ['lint-and-typecheck', 'coverage-shard', 'coverage-merge', 'test', 'build'],
  'E2E Tests': ['visual-regression'],
  'Lighthouse CI': ['lighthouse'],
  'Bundle Size Analysis': ['analyze'],
  'Dead Code Detection': ['knip'],
  'License Compliance': ['license-check'],
  'Security Scan': ['gitleaks', 'audit'],
};
const strip = value => typeof value === 'string' ? value.replace(/^\$\{\{\s*|\s*\}\}$/g, '') : value;
export function automaticOriginalWorkflow(value) {
  value.permissions??={contents:'read',actions:'read'};
  const required = requiredByName[value.name];
  if (!required || required.some(id => !value.jobs[id])) throw Error('Reviewed automatic application inventory changed: '+value.name);
  const callable = value.on?.workflow_call ? "inputs.profile != ''" : 'false';
  const mandatory=mandatoryFullExpression({ownerId:3944118,productionBranch:'main',extra:"(github.event_name == 'push' && github.event.head_commit.author.username != 'juan294')"});
  const refresh = "github.event_name == 'schedule' && needs.routing.result == 'success' && needs.routing.outputs.reason != 'installation-missing'";
  const full = `needs.routing.result != 'success' || needs.routing.outputs.full != 'false' || (${mandatory})`;
  if (value.on?.push?.['paths-ignore']) delete value.on.push['paths-ignore'];
  const jobs = value.jobs;
  if (jobs.develop_push_source) jobs.develop_push_source.if = "github.event_name == 'sutura-prior-proof-disabled'";
  for (const [id, job] of Object.entries(jobs)) {
    if (['develop_push_source','callable-source','callable-full'].includes(id)) continue;
    const previous = (strip(job.if) ?? '!failure() && !cancelled()').replaceAll("needs.develop_push_source.outputs.validated_by_pr != 'true'", 'true');
    job.needs = [...new Set([...(Array.isArray(job.needs)?job.needs:job.needs?[job.needs]:[]),'routing'])];
    job.if = `\${{ always() && ((${callable}) || (!(${refresh}) && (${full}))) && (${previous}) }}`;
  }
  const route = {name:'Sutura routing',if:`\${{ !(${callable}) }}`,'runs-on':'ubuntu-latest','timeout-minutes':6,permissions:{contents:'read'},outputs:{full:'${{ steps.plan.outputs.full }}',reason:'${{ steps.plan.outputs.reason }}'},steps:[{uses:'actions/checkout@v7',with:{'fetch-depth':0,'persist-credentials':false}},{uses:'actions/setup-node@v7',with:{'node-version':'24.21.0'}},{name:'Plan automatic verification',id:'plan',shell:'bash',run:protectedLoaderScript()}]};
  const gate = {name:`CI Verification (${value.name})`,needs:['routing',...required],if:`\${{ always() && !(${callable}) && !(${refresh}) && (${full}) }}`,'runs-on':'ubuntu-latest',permissions:{contents:'read'},steps:[{name:'Require actual application children',env:{NEEDS:'${{ toJSON(needs) }}',FORCE_FULL:`\${{ ${mandatory} }}`},run:gateRunScript(required)}]};
  if (value.name==='E2E Tests'||value.name==='Security Scan') gate.steps.push({name:'Disclose withheld owner/provider proof',run:"echo 'Application verification excludes authenticated E2E and provider configuration proof when credentials are withheld. Release retains those prerequisites.' >> \"$GITHUB_STEP_SUMMARY\""});
  if (!value.on?.workflow_call) delete route.if;
  value.jobs = {routing:route,...jobs,'ci-verification':gate};
  return value;
}
