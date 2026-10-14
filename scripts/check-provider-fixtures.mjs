import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const timestamp = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19) ? parsed : NaN;
};
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

/** Offline provenance and freshness only. Never contacts a provider. */
export function inspectProviderFixtures(manifest, root, now = new Date()) {
  const report = { status: 'unverified', evidence_scope: 'Recorded fixture metadata freshness only; adapter execution is separate.', live_availability: 'unverified', fixtures: [], errors: [] };
  if (!Number.isFinite(now.getTime())) {
    report.errors.push('Invalid observation clock; fixture freshness is unverified.');
    return report;
  }
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.fixtures) || manifest.fixtures.length === 0) {
    report.errors.push('A nonempty schema_version 1 provider fixture inventory is required. Review and register sanitized adapter recordings.');
    return report;
  }
  const ids = new Set();
  for (const entry of manifest.fixtures) {
    const reasons = [];
    const item = entry && typeof entry === 'object' ? entry : {};
    for (const field of ['id', 'provider', 'refresh_owner', 'refresh_action']) {
      if (!nonempty(item[field])) reasons.push(`missing ${field}`);
    }
    if (ids.has(item.id)) reasons.push('duplicate fixture id');
    ids.add(item.id);
    if (item.kind !== 'recorded') reasons.push('synthetic or unclassified fixture has no recorded compatibility evidence');
    if (!nonempty(item.api_version)) reasons.push('missing provider API version');
    if (item.sanitized !== true) reasons.push('sanitized capture review is not recorded');
    const captured = timestamp(item.captured_at);
    const expires = timestamp(item.expires_at);
    if (!Number.isFinite(captured) || captured > now.getTime()) reasons.push('missing, invalid or future capture time');
    if (item.expires_at !== undefined) {
      if (!Number.isFinite(expires) || expires <= captured) reasons.push('invalid expiry');
      else if (expires <= now.getTime()) reasons.push('fixture expired; compatibility is unverified');
    } else if (!nonempty(item.upstream_change)) reasons.push('missing expiry or upstream change review criterion');
    try {
      if (!nonempty(item.file) || isAbsolute(item.file)) throw new Error('path');
      const base = realpathSync(root);
      const path = realpathSync(resolve(base, item.file));
      const local = relative(base, path);
      if (local.startsWith('..') || isAbsolute(local)) throw new Error('path');
      const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
      if (!/^[a-f0-9]{64}$/.test(item.sha256 ?? '') || item.sha256 !== actual) reasons.push('fixture bytes do not match reviewed sha256');
    } catch { reasons.push('missing fixture or path outside repository'); }
    report.fixtures.push({
      id: nonempty(item.id) ? item.id : 'invalid entry',
      provider: nonempty(item.provider) ? item.provider : 'unclassified',
      status: reasons.length ? 'unverified' : 'verified', reasons,
      refresh_owner: item.refresh_owner ?? 'repository owner',
      refresh_action: nonempty(item.refresh_action) ? item.refresh_action : 'Review and register a sanitized recording with version, capture date and expiry or upstream change criterion; live capture needs separate authorization.',
    });
  }
  if (report.fixtures.every((item) => item.status === 'verified')) report.status = 'verified';
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let report;
  try {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--manifest', '--root'].includes(args[i]) || !args[i + 1]) throw new Error('Use --manifest PATH and --root PATH.');
      options[args[i]] = args[i + 1];
    }
    report = inspectProviderFixtures(JSON.parse(readFileSync(options['--manifest'] ?? resolve(root, 'tests/fixtures/providers/manifest.json'), 'utf8')), options['--root'] ?? root);
  } catch {
    report = { status: 'unverified', live_availability: 'unverified', fixtures: [], errors: ['Unreadable provider inventory or invalid arguments. Review tests/fixtures/providers/manifest.json and rerun the offline check.'] };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'verified' ? 0 : 1;
}
