import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { canonicalSource } from './ci-cadence-route-originals.mjs';
import { SOURCE_GUARD, SOURCE_SHELL, SOURCE_ENV } from './ci-cadence-source-guard.mjs';

const CATALOGUE = [
  { slug: 'e2e', sha256: '1f3cd010204ec27d8ac2d12f832dcd80613cbef0217a2b2ff7705993156e2218', jobs: ['e2e', 'visual-regression'] },
  { slug: 'lighthouse', sha256: '7da4649d9eab412e5f580ba19fa5d92238db2ae32d2b2e9aa1197a78000c408b', jobs: ['lighthouse'] },
  { slug: 'security', sha256: 'c0df88dff2d618a7ab575281cbcc568f742c0d02cc7a867e7029477d1d403097', jobs: ['gitleaks', 'audit', 'vercel-env-safety'] },
];
const BASELINE = 'tests/fixtures/ci-cadence-adapter/native/remaining-workflow-baselines.json';
const SOURCE = `set -euo pipefail
test "$GITHUB_REPOSITORY" = juan294/paisaxe
test "$REPOSITORY_ID" = 1141286326
test "$OWNER_ID" = 3944118
test "$DEFAULT_BRANCH" = main
[[ "$SOURCE_SHA" =~ ^[a-f0-9]{40}$ ]] && test "$SOURCE_SHA" != 0000000000000000000000000000000000000000
[[ "$PROFILE" == full || "$PROFILE" == nightly ]]
[[ "$INVOCATION_ID" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,63}$ ]]
`;
const CHECKOUT = SOURCE_GUARD;
const trusted = "github.repository_id == '1141286326' && github.repository_owner_id == '3944118' && github.actor_id == '3944118' && github.event.sender.type == 'User' && (github.event_name != 'pull_request' || (github.event.pull_request.user.id == 3944118 && github.event.pull_request.user.type == 'User' && github.event.pull_request.head.repo.id == 1141286326))";
const digest = source => createHash('sha256').update(source).digest('hex');
function source(root, path) {
  const file = join(root, path), metadata = lstatSync(file);
  if (!metadata.isFile() || metadata.nlink !== 1 || realpathSync(file) !== file) throw Error('Unaliased regular source required: ' + path);
  return readFileSync(file, 'utf8');
}
function workflow(definition, original) {
  const jobs = {};
  const inputs = Object.fromEntries(['source_sha', 'profile', 'invocation_id'].map(key => [key, { required: true, type: 'string' }]));
  const secrets = definition.slug === 'e2e'
    ? Object.fromEntries(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'QA_TEST_USER_EMAIL', 'QA_TEST_USER_PASSWORD'].map(key => [key, { required: false }]))
    : definition.slug === 'security' ? { VERCEL_TOKEN: { required: false } } : {};
  jobs['callable-source'] = {
    name: 'Callable source', 'runs-on': 'ubuntu-latest', 'timeout-minutes': 2, permissions: { contents: 'read' },
    steps: [{ name: 'Validate callable inputs', run: SOURCE, env: {
      SOURCE_SHA: '${{ inputs.source_sha }}', PROFILE: '${{ inputs.profile }}', INVOCATION_ID: '${{ inputs.invocation_id }}',
      REPOSITORY_ID: '${{ github.repository_id }}', OWNER_ID: '${{ github.repository_owner_id }}', DEFAULT_BRANCH: '${{ github.event.repository.default_branch }}',
    } }],
  };
  for (const id of definition.jobs) {
    const app = structuredClone(original.jobs[id]);
    // Provider/Auth leaves cannot become anonymous full acceptance. No call
    // inherits secrets; callers must explicitly pass only the declared values.
    const privileged = definition.slug === 'e2e' && id === 'e2e' || definition.slug === 'security' && id === 'vercel-env-safety';
    app.needs = ['callable-source'];
    app.if = '${{ always() && needs.callable-source.result == \'success\'' + (privileged ? ` && (${trusted})` : '') + ' }}';
    app.permissions = { contents: 'read' };
    app['runs-on'] = 'ubuntu-latest';
    let checkout = app.steps.find(step => step.name === 'Checkout code');
    if (!checkout && definition.slug === 'security' && id === 'vercel-env-safety') {
      // The original inline provider validator executes no candidate code. A
      // callable provider leaf still needs an actual immutable checkout bind.
      checkout = { name: 'Checkout code', uses: 'actions/checkout@v7' };
      app.steps.unshift(checkout);
    }
    if (!checkout || checkout.uses !== 'actions/checkout@v7') throw Error('Canonical checkout changed');
    checkout.with = { 'fetch-depth': 0, ref: '${{ inputs.source_sha }}', 'persist-credentials': false };
    app.steps.splice(app.steps.indexOf(checkout) + 1, 0, { name: 'Verify callable source checkout', run: CHECKOUT, shell: SOURCE_SHELL, env: { ...SOURCE_ENV, SOURCE_SHA: '${{ inputs.source_sha }}' } });
    if (definition.slug === 'e2e' && id === 'e2e') {
      app.env.SECRETS_WITHHELD_PR = 'false';
      // The genuine original secret precondition and authenticated command
      // remain present. An outsider never executes this credentialed job.
    }
    for (const step of app.steps) {
      if (step.uses?.startsWith('actions/upload-artifact@')) step.with.name = `\${{ inputs.invocation_id }}.artifact-${step.with.name}`;
      if (step.uses === 'treosh/lighthouse-ci-action@v12') step.with.artifactName = `\${{ inputs.invocation_id }}.artifact-${step.with.artifactName}`;
    }
    app.steps.push({name:'Verify completed callable source checkout',run:CHECKOUT,shell:SOURCE_SHELL,env:{...SOURCE_ENV,SOURCE_SHA:'${{ inputs.source_sha }}'}});
    jobs[id] = app;
  }
  jobs['callable-full'] = {
    name: 'Callable full', needs: ['callable-source', ...definition.jobs], if: '${{ always() }}',
    'runs-on': 'ubuntu-latest', 'timeout-minutes': 2, permissions: { contents: 'read' },
    steps: [{ name: 'Require every actual callable child', env: Object.fromEntries(['callable-source', ...definition.jobs].map((id, index) => ['RESULT_' + index, `\${{ needs.${id}.result }}`])),
      run: `set -euo pipefail\nfor result in ${['callable-source', ...definition.jobs].map((_, index) => '"$RESULT_' + index + '"').join(' ')}; do\n  test "$result" = success || { echo "::error::Required callable child did not succeed."; exit 1; }\ndone\n` }],
  };
  return { name: original.name + ' full', on: { workflow_call: { inputs, ...(Object.keys(secrets).length ? { secrets } : {}) } }, permissions: { contents: 'read' },
    concurrency: { group: `\${{ format('paisaxe-${definition.slug}-full-{0}-{1}-{2}', github.run_id, github.run_attempt, inputs.invocation_id) }}`, 'cancel-in-progress': false }, jobs };
}
export function generateRemainingWorkflows(root = fileURLToPath(new URL('../', import.meta.url))) {
  root = realpathSync(resolve(root));
  const baseline = JSON.parse(source(root, BASELINE));
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.files) || baseline.files.length !== 3) throw Error('Exact baseline required');
  return CATALOGUE.map((definition, index) => {
    const path = `.github/workflows/${definition.slug}.yml`, entry = baseline.files[index];source(root,path);
    const bytes = canonicalSource(root,path,entry?.source);
    if (entry?.path !== path || typeof entry.source !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || entry.sha256 !== definition.sha256 || digest(bytes) !== definition.sha256 || bytes !== entry.source) throw Error('Canonical source drift: ' + path);
    const original = parse(bytes);
    if (JSON.stringify(Object.keys(original.jobs)) !== JSON.stringify(['develop_push_source', ...definition.jobs])) throw Error('Canonical complete inventory drift');
    return { path: `.github/workflows/ci-cadence-${definition.slug}-full.yml`, source: `# Generated by scripts/ci-cadence-remaining-workflows.mjs; canonical SHA256 ${entry.sha256}.\n${stringify(workflow(definition, original), { lineWidth: 0 })}` };
  });
}
export function runRemainingWorkflowGenerator(args, root = process.cwd()) {
  if (args.length > 1 || args.length && args[0] !== '--check') throw Error('Expected no arguments or --check');
  root = realpathSync(resolve(root)); const files = generateRemainingWorkflows(root);
  // Validate every output before writing any one of them.
  for (const file of files) {
    const target = join(root, file.path), metadata = lstatSync(target, { throwIfNoEntry: false });
    if (metadata && (!metadata.isFile() || metadata.nlink !== 1 || realpathSync(target) !== target)) throw Error('Owned regular output required');
    if (args[0] === '--check' && source(root, file.path) !== file.source) throw Error('Generated workflow drift');
  }
  if (args[0] !== '--check') for (const file of files) writeFileSync(join(root, file.path), file.source);
  return files.map(file => file.path);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runRemainingWorkflowGenerator(process.argv.slice(2)))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
