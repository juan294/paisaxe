import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { canonicalSource } from './ci-cadence-route-originals.mjs';
import { SOURCE_GUARD, SOURCE_SHELL, SOURCE_ENV } from './ci-cadence-source-guard.mjs';

// Changes to these canonical definitions require a new reviewed baseline and pin.
const CATALOGUE = [
  { slug: 'bundle-size', id: 'analyze', name: 'Analyze Bundle Size', sha256: 'b549fe94581200d4361fb9645af1dff641c36e81c4c0f8c82a88b8ef24f03441' },
  { slug: 'knip', id: 'knip', name: 'Knip Dead Code Analysis', sha256: 'd65a5c9e4a3c6f025277e8884c8ca2e8591e731b21c3d53835214e45ea361af1' },
  { slug: 'license-check', id: 'license-check', name: 'License Compliance Check', sha256: '64a6f9497185c4e7f85eb45de0f97c2b87a1141f694a37032612b2d75b845be7' },
];
const BASELINE_PATH = 'tests/fixtures/ci-cadence-adapter/native/extra-workflow-baselines.json';
const SOURCE_VALIDATOR = `set -euo pipefail
test "$GITHUB_REPOSITORY" = juan294/paisaxe
test "$REPOSITORY_ID" = 1141286326
test "$OWNER_ID" = 3944118
test "$DEFAULT_BRANCH" = main
[[ "$SOURCE_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 1
test "$SOURCE_SHA" != 0000000000000000000000000000000000000000
[[ "$PROFILE" == full || "$PROFILE" == nightly ]] || exit 1
[[ "$INVOCATION_ID" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,63}$ ]] || exit 1
`;
const CHECKOUT_GUARD = SOURCE_GUARD;
const FULL_GUARD = `set -euo pipefail
for result in "$SOURCE_RESULT" "$APP_RESULT"; do
  test "$result" = success || { echo "::error::Required callable source or app job did not succeed."; exit 1; }
done
`;

function sourceFile(root, path) {
  const target = join(root, path);
  if (!lstatSync(target).isFile() || realpathSync(target) !== target) throw new Error(`Source is not an unaliased regular file: ${path}`);
  return readFileSync(target, 'utf8');
}
const digest = source => createHash('sha256').update(source).digest('hex');

function canonicalJobs(root) {
  const baseline = JSON.parse(sourceFile(root, BASELINE_PATH));
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.files) || baseline.files.length !== CATALOGUE.length || Object.keys(baseline).sort().join(',') !== 'files,schemaVersion') throw new Error('Reviewed baseline inventory is invalid');
  // Validate the whole source set before any CLI output is written.
  return CATALOGUE.map((definition, index) => {
    const path = `.github/workflows/${definition.slug}.yml`;
    const recorded = baseline.files[index];
    if (!recorded || Object.keys(recorded).sort().join(',') !== 'path,sha256,source' || recorded.path !== path || recorded.sha256 !== definition.sha256 || typeof recorded.source !== 'string' || digest(recorded.source) !== definition.sha256) throw new Error(`Reviewed baseline authority mismatch: ${path}`);
    sourceFile(root,path);
    const source = canonicalSource(root,path,recorded.source);
    if (digest(source) !== definition.sha256 || source !== recorded.source) throw new Error(`Canonical source drift: ${path}`);
    const workflow = parse(source);
    if (!workflow.jobs || Object.keys(workflow.jobs).join(',') !== definition.id || workflow.jobs[definition.id].name !== definition.name) throw new Error(`Canonical job inventory mismatch: ${path}`);
    return { definition, sourcePath: path, workflow };
  });
}

function callableWorkflow({ definition, workflow }) {
  const app = structuredClone(workflow.jobs[definition.id]);
  if (definition.slug === 'bundle-size') {
    // This is publication, not app validation. Canonical PR behavior is untouched.
    app.steps = app.steps.filter(step => step.name !== 'Comment on PR');
  }
  app.permissions = { contents: 'read' };
  app.needs = ['callable-source'];
  app.if = "${{ always() && needs.callable-source.result == 'success' }}";
  const checkout = app.steps[0];
  if (checkout.name !== 'Checkout code' || checkout.uses !== 'actions/checkout@v7') throw new Error('Reviewed checkout inventory mismatch');
  checkout.with = { 'fetch-depth': 0, ref: '${{ inputs.source_sha }}', 'persist-credentials': false };
  app.steps.splice(1, 0, { name: 'Verify callable source checkout', env: { ...SOURCE_ENV, SOURCE_SHA: '${{ inputs.source_sha }}' }, shell: SOURCE_SHELL, run: CHECKOUT_GUARD });
  app.steps.push({name:'Verify completed callable source checkout',env:{...SOURCE_ENV,SOURCE_SHA:'${{ inputs.source_sha }}'},shell:SOURCE_SHELL,run:CHECKOUT_GUARD});
  return {
    name: `${workflow.name} full`,
    on: {
      workflow_call: {
        inputs: {
          source_sha: { description: 'Exact admitted immutable app checkout.', required: true, type: 'string' },
          profile: { description: 'Complete full or nightly app validation.', required: true, type: 'string' },
          invocation_id: { description: 'Unique caller job ID: bounded ASCII, at most 64 characters.', required: true, type: 'string' },
        },
      },
    },
    permissions: { contents: 'read' },
    concurrency: {
      group: `\${{ format('paisaxe-${definition.slug}-full-{0}-{1}-{2}', github.run_id, github.run_attempt, inputs.invocation_id) }}`,
      'cancel-in-progress': false,
    },
    jobs: {
      'callable-source': {
        name: 'Callable source', 'runs-on': 'ubuntu-latest', 'timeout-minutes': 2, permissions: { contents: 'read' },
        steps: [{
          name: 'Validate callable inputs',
          env: {
            SOURCE_SHA: '${{ inputs.source_sha }}', PROFILE: '${{ inputs.profile }}', INVOCATION_ID: '${{ inputs.invocation_id }}',
            REPOSITORY_ID: '${{ github.repository_id }}', OWNER_ID: '${{ github.repository_owner_id }}', DEFAULT_BRANCH: '${{ github.event.repository.default_branch }}',
          },
          run: SOURCE_VALIDATOR,
        }],
      },
      [definition.id]: app,
      'callable-full': {
        name: 'Callable full', needs: ['callable-source', definition.id], if: '${{ always() }}',
        'runs-on': 'ubuntu-latest', 'timeout-minutes': 2, permissions: { contents: 'read' },
        steps: [{
          name: 'Require actual source and app success',
          env: { SOURCE_RESULT: '${{ needs.callable-source.result }}', APP_RESULT: `\${{ needs.${definition.id}.result }}` },
          run: FULL_GUARD,
        }],
      },
    },
  };
}

export function generateExtraWorkflows(root = fileURLToPath(new URL('../', import.meta.url))) {
  return canonicalJobs(realpathSync(resolve(root))).map(canonical => ({
    path: `.github/workflows/ci-cadence-${canonical.definition.slug}-full.yml`,
    source: `# Generated by scripts/ci-cadence-extra-workflows.mjs; do not edit app bodies.\n# Canonical: ${canonical.sourcePath}; SHA256: ${canonical.definition.sha256}\n${stringify(callableWorkflow(canonical), { lineWidth: 0 })}`,
  }));
}

export function runExtraWorkflowGenerator(args, root = process.cwd()) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Expected no arguments or --check');
  root = realpathSync(resolve(root));
  const generated = generateExtraWorkflows(root);
  if (args[0] === '--check') {
    for (const file of generated) if (sourceFile(root, file.path) !== file.source) throw new Error(`Generated workflow drift: ${file.path}`);
  } else {
    for (const file of generated) {
      const target = join(root, file.path);
      const status = lstatSync(target, { throwIfNoEntry: false });
      if (status && (!status.isFile() || status.nlink !== 1)) throw new Error(`Output is not an owned regular file: ${file.path}`);
    }
    for (const file of generated) { mkdirSync(dirname(join(root, file.path)), { recursive: true }); writeFileSync(join(root, file.path), file.source); }
  }
  return generated.map(file => file.path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runExtraWorkflowGenerator(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
