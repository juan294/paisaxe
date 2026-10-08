import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inspectProviderFixtures } from './check-provider-fixtures.mjs';

const NOW = new Date('2026-10-07T15:00:00Z');
const digest = (value) => createHash('sha256').update(value).digest('hex');

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'paisaxe-provider-fixture-test-'));
  const file = 'tests/fixtures/providers/paypal.json';
  const body = '{"id":"SANITIZED-EVENT","event_type":"CHECKOUT.ORDER.APPROVED"}\n';
  mkdirSync(join(root, 'tests/fixtures/providers'), { recursive: true });
  writeFileSync(join(root, file), body);
  const entry = {
    id: 'paypal-webhook', provider: 'PayPal', kind: 'recorded',
    file, sha256: digest(body), api_version: 'Orders v2',
    captured_at: '2026-10-01T12:00:00Z', sanitized: true,
    refresh_owner: 'repository owner', expires_at: '2026-11-01T00:00:00Z',
    upstream_change: 'Review when the webhook schema or Orders API version changes.',
    refresh_action: 'Review a separately authorized sanitized PayPal capture and its adapter tests.',
  };
  try { run({ root, entry, manifest: { schema_version: 1, fixtures: [entry] } }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('a pinned, sanitized, dated recording is compatible evidence only', () => fixture(({ root, manifest }) => {
  const report = inspectProviderFixtures(manifest, root, NOW);
  assert.equal(report.status, 'verified');
  assert.equal(report.fixtures[0].status, 'verified');
  assert.equal(report.live_availability, 'unverified');
  assert.match(report.evidence_scope, /metadata freshness only; adapter execution is separate/);
}));

test('stale metadata discloses a precise refresh action, then corrected metadata recovers', () => fixture(({ root, entry, manifest }) => {
  entry.expires_at = '2026-10-07T15:00:00Z';
  let report = inspectProviderFixtures(manifest, root, NOW);
  assert.equal(report.status, 'unverified');
  assert.match(report.fixtures[0].reasons.join(' '), /expired/);
  assert.equal(report.fixtures[0].refresh_action, entry.refresh_action);
  entry.expires_at = '2026-10-08T00:00:00Z';
  report = inspectProviderFixtures(manifest, root, NOW);
  assert.equal(report.status, 'verified');
}));

test('missing provenance, future captures, changed bytes and unsafe paths cannot qualify', () => fixture(({ root, entry }) => {
  for (const patch of [
    { captured_at: undefined }, { captured_at: '2026-10-08T00:00:00Z' },
    { captured_at: 'yesterday' }, { api_version: '' }, { refresh_owner: '' },
    { sanitized: false }, { upstream_change: '', expires_at: undefined }, { refresh_action: '' },
    { sha256: '0'.repeat(64) }, { file: '../outside.json' },
    { expires_at: 'invalid' }, { expires_at: '2026-09-30T00:00:00Z' },
  ]) {
    const report = inspectProviderFixtures({ schema_version: 1, fixtures: [{ ...entry, ...patch }] }, root, NOW);
    assert.equal(report.status, 'unverified', JSON.stringify(patch));
  }
}));

test('synthetic examples never become recordings just by adding metadata', () => fixture(({ root, entry, manifest }) => {
  entry.kind = 'synthetic';
  const report = inspectProviderFixtures(manifest, root, NOW);
  assert.equal(report.status, 'unverified');
  assert.match(report.fixtures[0].reasons.join(' '), /synthetic/);
}));

test('impossible calendar dates and an invalid observation clock fail closed', () => fixture(({ root, entry }) => {
  for (const patch of [
    { captured_at: '2026-09-31T12:00:00Z' },
    { captured_at: '2026-02-29T12:00:00Z' },
    { expires_at: '2026-11-31T12:00:00Z' },
  ]) {
    assert.equal(inspectProviderFixtures({ schema_version: 1, fixtures: [{ ...entry, ...patch }] }, root, NOW).status, 'unverified');
  }
  assert.equal(inspectProviderFixtures({ schema_version: 1, fixtures: [entry] }, root, new Date('invalid')).status, 'unverified');
}));

test('empty, malformed and duplicate inventories fail closed', () => fixture(({ root, entry }) => {
  for (const manifest of [null, {}, { schema_version: 2, fixtures: [entry] },
    { schema_version: 1, fixtures: [] }, { schema_version: 1, fixtures: [entry, entry] },
    { schema_version: 1, fixtures: [null] }]) {
    assert.equal(inspectProviderFixtures(manifest, root, NOW).status, 'unverified');
  }
}));

test('CLI fails on unverified metadata and reports corrected metadata without provider calls', () => fixture(({ root, entry, manifest }) => {
  const path = join(root, 'manifest.json');
  const script = new URL('./check-provider-fixtures.mjs', import.meta.url).pathname;
  entry.expires_at = '2020-01-01T00:00:00Z';
  writeFileSync(path, JSON.stringify(manifest));
  let result = spawnSync(process.execPath, [script, '--manifest', path, '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, 'unverified');
  entry.expires_at = '2099-01-01T00:00:00Z';
  writeFileSync(path, JSON.stringify(manifest));
  result = spawnSync(process.execPath, [script, '--manifest', path, '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).live_availability, 'unverified');
}));


test('expiry or upstream-change criterion qualifies metadata; a supplied invalid expiry still fails', () => fixture(({ root, entry }) => {
  for (const patch of [{ upstream_change: undefined }, { expires_at: undefined }]) {
    const report = inspectProviderFixtures({ schema_version: 1, fixtures: [{ ...entry, ...patch }] }, root, NOW);
    assert.equal(report.status, 'verified', JSON.stringify(patch));
    assert.equal(report.live_availability, 'unverified');
  }
  for (const patch of [{ expires_at: undefined, upstream_change: undefined },
    { expires_at: 'invalid' }, { expires_at: '2026-10-06T00:00:00Z' }]) {
    assert.equal(inspectProviderFixtures({ schema_version: 1, fixtures: [{ ...entry, ...patch }] }, root, NOW).status, 'unverified');
  }
}));
