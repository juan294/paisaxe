// Generate reviewed literal workflow glue. No candidate routing module is run.
export function mandatoryFullExpression({ ownerId, productionBranch, extra = '' }) {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || typeof productionBranch !== 'string' || !/^[\w./-]+$/.test(productionBranch)) throw new Error('invalid native identity constants');
  return [`github.event_name == 'schedule'`, `github.event_name == 'workflow_dispatch'`,
    `github.ref == 'refs/heads/${productionBranch}'`, `github.base_ref == '${productionBranch}'`,
    `github.actor_id != '${ownerId}'`, `(github.event_name == 'pull_request' && (github.event.pull_request.user.id != ${ownerId} || github.event.pull_request.head.repo.id != github.event.repository.id))`,
    ...(extra ? [`(${extra})`] : [])].join(' || ');
}

export function gateRunScript(requiredJobs) {
  if (!Array.isArray(requiredJobs) || !requiredJobs.length || requiredJobs.some(job => !/^[\w-]+$/.test(job))) throw new Error('nonempty native application job inventory required');
  return `node --input-type=module <<'SUTURA_GATE'
const needs = JSON.parse(process.env.NEEDS);
const route = needs.routing;
if (route?.result !== 'success' || !['true', 'false'].includes(route?.outputs?.full)) {
  console.error('Sutura routing failed or is missing; repair the protected routing installation. Full verification remains required.');
  process.exit(1);
}
if (route.outputs.full === 'false' && process.env.FORCE_FULL !== 'true') process.exit(0);
const required = ${JSON.stringify(requiredJobs)};
const failed = required.filter(job => needs[job]?.result !== 'success');
for (const job of failed) console.error(job + ': expected actual application success, received ' + (needs[job]?.result ?? 'missing'));
if (failed.length) process.exit(1);
console.log('Sutura application verification passed. Release/provider proof remains separate.');
SUTURA_GATE`;
}

export function protectedLoaderScript({ policyChecks = false } = {}) {
  const bridge = policyChecks ? `
for file in ci-fast.mjs ci-cadence.mjs ci-cadence-routing.mjs; do
  git_read show "$base:scripts/$file" > "$protected/$file"
done
git_read show "$base:.github/ci-cadence.json" > "$protected/policy.json"
SUTURA_PROTECTED="$protected" SUTURA_BASE="$base" node --input-type=module <<'SUTURA_POLICY'
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const directory = process.env.SUTURA_PROTECTED;
const load = name => import(pathToFileURL(directory + '/' + name).href);
const { defaultChecks } = await load('ci-fast.mjs');
const { loadPolicy, blobAt } = await load('ci-cadence-routing.mjs');
const { validatePolicy } = await load('ci-cadence.mjs');
const root = process.cwd(), base = process.env.SUTURA_BASE;
const trusted = loadPolicy(readFileSync(directory + '/policy.json', 'utf8'), blobAt(root, base));
const validation = validatePolicy(trusted);
if (!validation.valid) throw new Error('protected policy invalid: ' + validation.errors.join('; '));
let failed = false;
for (const name of ['policyValidation', 'lockfileValidation', 'cadenceContracts']) {
  if (typeof defaultChecks?.[name] !== 'function') throw new Error('protected policy check missing: ' + name);
  const errors = defaultChecks[name]({ root, base, trusted });
  if (!Array.isArray(errors)) throw new Error(name + ': protected check must return an error array');
  for (const error of errors) { console.error(name + ': ' + error); failed = true; }
}
if (failed) process.exit(1);
console.log('Protected policy, lockfile and frozen contracts passed. Application proof is supplied by required CI Verification gates.');
SUTURA_POLICY
` : '';
  return `set -euo pipefail
# Ignore ambient Git redirection and never execute a candidate routing helper.
for name in \${!GIT_@}; do unset "$name"; done
git_read() { git --no-replace-objects -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"; }
printf 'full=true\\n' >> "$GITHUB_OUTPUT"
base=""
case "$GITHUB_EVENT_NAME" in
  push) base=$(jq -r '.before' "$GITHUB_EVENT_PATH") ;;
  pull_request)
    head=$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")
    test "$(git_read rev-parse HEAD^2)" = "$head" || { echo 'Sutura: PR head/merge parent mismatch' >&2; exit 1; }
    base=$(git_read rev-parse HEAD^1)
    ;;
  *) base=$(git_read rev-parse HEAD) ;;
esac
[[ "$base" =~ ^[0-9a-f]{40}$ && "$base" != 0000000000000000000000000000000000000000 ]] || { echo 'Sutura: protected base unavailable; full verification remains required. Bring this run to Sutura.' >&2; exit 1; }
protected=$(mktemp -d)
trap 'status=$?; if [ "$status" -ne 0 ]; then printf "full=true\\n" >> "$GITHUB_OUTPUT"; fi; rm -rf "$protected"; exit "$status"' EXIT
if git_read cat-file -e "$base:scripts/ci-routing-v2.mjs" 2>/dev/null; then
  git_read show "$base:scripts/ci-routing-v2.mjs" > "$protected/ci-routing-v2.mjs"
  node "$protected/ci-routing-v2.mjs" --base "$base"
else
  printf 'reason=installation-missing\\n' >> "$GITHUB_OUTPUT"
  echo 'Sutura protected routing v2 is not installed yet. Running full verification automatically; no mode change is needed.'
fi${bridge}`;
}
