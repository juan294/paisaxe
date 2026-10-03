import { readFile } from 'node:fs/promises';
import { test, expect } from '../../../../e2e/fixtures/base-test';
import { verifyCandidateManifest, verifyServedArtifact } from '../../../../scripts/ci-cadence-artifact.mjs';

async function candidate() {
  if (process.env.CI_CADENCE_LOCAL_QA !== '1' || !process.env.CI_CADENCE_ARTIFACT_MANIFEST || !process.env.CRON_SECRET) throw Error('local measured candidate prerequisite missing');
  const manifest = JSON.parse(await readFile(process.env.CI_CADENCE_ARTIFACT_MANIFEST, 'utf8'));
  await verifyCandidateManifest(process.cwd(), manifest);
  return manifest;
}

test('immutable production build serves actual candidate identity, healthy DB and denied privileged routes', async ({ request }) => {
  const manifest = await candidate();
  const health = await request.get('/api/health', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(health.status()).toBe(200);
  const measured = await health.json();
  expect(measured.status).toBe('healthy');
  expect(measured.build).toEqual({ commit: manifest.candidateSha, tree: manifest.treeSha.slice(0, 12) });
  const database = await request.get('/api/health/db');
  expect(database.status()).toBe(200);
  const data = await database.json();
  expect(data.success).toBe(true);
  expect(data.tablesAccessible).toBe(true);
  expect([401, 403]).toContain((await request.get('/api/admin/agent-reports')).status());
  const unsigned = await request.post('/api/webhooks/supabase', { data: { type: 'INSERT', table: 'stories', record: {} } });
  expect([401, 403]).toContain(unsigned.status());
});

test('actual built client asset hydrates after homepage redirect and matches immutable manifest bytes', async ({ page, request }) => {
  const manifest = await candidate();
  await page.goto('/');
  await page.waitForURL('**/immersive');
  expect(new URL(page.url()).origin).toBe(process.env.CI_CADENCE_QA_APP_ORIGIN);
  const sources = await page.locator('script[src]').evaluateAll(elements => elements.map(element => element.getAttribute('src')).filter(Boolean));
  const path = sources.find(source => source?.startsWith('/_next/static/') && manifest.files.some((file: { path: string }) => file.path === `.next/${source.slice('/_next/'.length)}`));
  if (!path) throw Error('no actually referenced measured client asset');
  const asset = await request.get(path);
  expect(asset.status()).toBe(200);
  expect(verifyServedArtifact(manifest, process.env.CI_CADENCE_QA_APP_ORIGIN, path, await asset.body())).toBe(true);
  await page.goto('/favorites');
  await expect(page.getByRole('link', { name: /explore stories|explorar historias/i })).toBeVisible({ timeout: 10_000 });
  await verifyCandidateManifest(process.cwd(), manifest);
});
