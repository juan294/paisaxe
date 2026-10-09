import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { createClient, type Session } from '@supabase/supabase-js';
import { injectSessionCookies, isValidTestEmail, readSessionFromAuthCookies } from './fixtures/auth';
import { presentationAuthClientSource } from './fixtures/presentation-auth-client';
import { assertLocalDatastore } from '../scripts/release/probe-guards';
import { psql } from '../src/test/local-supabase';

// Literal UI samples prove rendered dictionary content, not just a seed field.
// These declarations do not certify native-language quality or story coverage.
const samples = [
  { locale: 'es', preparing: 'Preparando la navegación…', signIn: 'Entrar', skip: 'Ir al contenido principal', next: 'Historia siguiente' },
  { locale: 'en', preparing: 'Preparing navigation…', signIn: 'Sign in', skip: 'Skip to main content', next: 'Next story' },
  { locale: 'fr', preparing: 'Préparation de la navigation…', signIn: 'Se connecter', skip: 'Aller au contenu principal', next: 'Histoire suivante' },
  { locale: 'de', preparing: 'Navigation wird vorbereitet…', signIn: 'Anmelden', skip: 'Zum Hauptinhalt springen', next: 'Nächste Geschichte' },
  { locale: 'pt', preparing: 'A preparar a navegação…', signIn: 'Iniciar sessão', skip: 'Ir para o conteúdo principal', next: 'Próxima história' },
  { locale: 'ast', preparing: 'Preparando la navegación…', signIn: 'Entrar', skip: 'Dir al conteníu principal', next: 'Historia siguiente' },
] as const;

interface BuildManifest {
  candidateSha: string;
  treeSha: string;
  buildId: string;
  files: { path: string; bytes: number; sha256: string }[];
}

let datastore: string, anonKey: string, email: string, password: string;
let origin: string, marker: string, manifest: BuildManifest;
const blocked = new WeakMap<BrowserContext, { url: string; method: string; resourceType: string; abort: string; forbidden: boolean }[]>();
const region = (page: Page) => page.locator('[data-request-presentation]');
// Next can retain a hidden streamed copy while the active segment hydrates.
const visibleNext = (page: Page) => page.locator('[data-testid="next-story-button"]:visible');
const storyUrl = '/immersive?story=release-probe-local-story';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`presentation-local requires ${name}; refusing an unqualified or skipped run`);
  return value;
}

test.beforeAll(async ({ request, baseURL }) => {
  datastore = required('NEXT_PUBLIC_SUPABASE_URL');
  assertLocalDatastore(datastore);
  expect(datastore).toBe(required('SUPABASE_LOCAL_API_URL'));
  marker = required('SUPABASE_LOCAL_DB_MARKER');
  expect(marker).toMatch(/^paisaxe-contracts:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}:[a-f0-9]{64}$/);
  required('SUPABASE_LOCAL_DB_URL');
  required('PRESENTATION_LOCAL_JWT_SECRET');
  expect(psql("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname=current_database();")).toBe(marker);
  anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  expect(anonKey.startsWith('eyJ')).toBe(true);
  email = required('QA_TEST_USER_EMAIL');
  password = required('QA_TEST_USER_PASSWORD');
  expect(isValidTestEmail(email)).toBe(true);
  if (process.env.RELEASE_TARGET_URL || !baseURL) throw new Error('presentation-local requires an explicit loopback application origin');
  const app = new URL(baseURL);
  expect(app.protocol).toBe('http:');
  expect(['127.0.0.1', 'localhost']).toContain(app.hostname);
  origin = app.origin;

  manifest = JSON.parse(await readFile(required('PRESENTATION_BUILD_MANIFEST'), 'utf8')) as BuildManifest;
  expect(manifest.candidateSha).toMatch(/^[a-f0-9]{40}$/);
  expect(manifest.treeSha).toMatch(/^[a-f0-9]{40}$/);
  expect(manifest.buildId).toBe((await readFile('.next/BUILD_ID', 'utf8')).trim());
  expect(manifest.files.length).toBeGreaterThan(0);
  const health = await request.get('/api/health', { headers: { authorization: `Bearer ${required('CRON_SECRET')}` } });
  expect(health.status()).toBe(200);
  const body = await health.json();
  expect(body.status).toBe('healthy');
  expect(body.build).toEqual({ commit: manifest.candidateSha, tree: manifest.treeSha.slice(0, 12) });
  const database = await request.get('/api/health/db');
  expect(database.status()).toBe(200);
  expect(await database.json()).toMatchObject({ success: true, tablesAccessible: true });
});

test.beforeEach(async ({ context }) => {
  const records: NonNullable<ReturnType<typeof blocked.get>> = [];
  blocked.set(context, records);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const oauth = /^\/auth\/v1\/authorize(?:\/|$)/.test(url.pathname);
    if (!oauth && (url.origin === origin || url.origin === new URL(datastore).origin)) return route.continue();
    const bootstrap = request.method() === 'GET' && request.resourceType() === 'script' && url.href === 'https://js.stripe.com/dahlia/stripe.js';
    await route.abort('blockedbyclient');
    records.push({ url: url.origin + url.pathname, method: request.method(), resourceType: request.resourceType(), abort: 'blockedbyclient', forbidden: oauth || (!bootstrap && /stripe|paypal|elevenlabs|anthropic|voyage|accounts\.google/.test(url.hostname)) });
  });
  await context.routeWebSocket(/.*/, socket => {
    const url = new URL(socket.url());
    const local = new URL(datastore);
    if (url.hostname === local.hostname && url.port === local.port && ['ws:', 'wss:'].includes(url.protocol)) {
      socket.connectToServer();
    } else {
      records.push({ url: url.origin + url.pathname, method: 'WEBSOCKET', resourceType: 'websocket', abort: 'closed-without-connect', forbidden: true });
      socket.close();
    }
  });
});

test.afterEach(async ({ context }, testInfo) => {
  const records = blocked.get(context) ?? [];
  await testInfo.attach('external-boundary-denials', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
  expect(records.filter(record => record.forbidden), 'No payment, model, conversation or external OAuth request may be attempted').toEqual([]);
});

async function setLocale(context: BrowserContext, locale: string) {
  await context.addCookies([{ name: 'paisaxe-locale', value: locale, url: origin, sameSite: 'Lax' }]);
}

async function passwordSession(): Promise<Session> {
  const client = createClient(datastore, anonKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  expect(signed.error).toBeNull();
  if (!signed.data.session) throw new Error('Owned local QA login did not produce a session');
  return signed.data.session;
}

function personalName(session: Session): string {
  const name = session.user.user_metadata.full_name ?? session.user.user_metadata.name;
  if (typeof name !== 'string' || !name) throw new Error('Owned QA fixture requires a name for the personal SSR UI oracle');
  return name;
}

async function inject(page: Page, session: Session) {
  // A real same-origin blank response establishes the cookie helper origin.
  await page.goto('/api/health/live');
  await injectSessionCookies(page, `sb-${new URL(datastore).hostname.split('.')[0]}-auth-token`, session);
}

async function holdApplicationScripts(context: BrowserContext) {
  let release!: () => void, held = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pattern = /\/_next\/static\/.*\.js(?:\?.*)?$/;
  await context.route(pattern, async route => {
    if (new URL(route.request().url()).origin !== origin) return route.fallback();
    held++;
    await gate;
    await route.continue();
  });
  return { release, held: () => held };
}

async function assertBuiltClient(page: Page) {
  const sources = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.getAttribute('src') ?? ''));
  const source = sources.find(src => src.startsWith('/_next/static/') && manifest.files.some(file => file.path === `.next/${src.slice('/_next/'.length)}`));
  expect(source, 'SSR must reference a client bundle sealed in the build manifest').toBeTruthy();
  const expected = manifest.files.find(file => file.path === `.next/${source!.slice('/_next/'.length)}`)!;
  const response = await page.request.get(source!);
  expect(response.status()).toBe(200);
  const bytes = await response.body();
  expect(bytes.length).toBe(expected.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected.sha256);
}

async function expectCenterHitsControl(control: Locator, inline = false) {
  await expect(control).toBeVisible();
  await expect.poll(() => control.evaluate((node, inline) => {
    // Wrapped inline links have several painted boxes; their union can center on a gap.
    const boxes = inline ? Array.from(node.getClientRects()).filter(box => box.width > 0 && box.height > 0) : [node.getBoundingClientRect()];
    return boxes.length > 0 && boxes.every(box => {
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !!hit && (hit === node || node.contains(hit));
    });
  }, inline), 'Each actual control box must receive a pointer, without forcing the action').toBe(true);
}

const englishFallback = 'Some story content or questions are not yet available in the selected language and are shown in Spanish.';
const frenchFallback = 'Certains contenus ou certaines questions de cette histoire ne sont pas encore disponibles dans la langue choisie et sont affichés en espagnol.';

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`visible partial translation disclosure leaves real toolbar and menus usable at ${viewport.width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize(viewport);
    await setLocale(context, 'en');
    await page.goto(storyUrl);
    await expect(visibleNext(page)).toHaveCount(1);
    await expect(visibleNext(page)).toBeEnabled();
    const notice = page.getByRole('status').filter({ hasText: englishFallback });
    const controls = page.getByRole('navigation', { name: 'Story controls', exact: true });
    await expect(notice).toBeVisible();
    await expect.poll(async () => {
      const [banner, toolbar] = await Promise.all([notice.boundingBox(), controls.boundingBox()]);
      return !!banner && !!toolbar && banner.y >= toolbar.y + toolbar.height + 8 && banner.x >= 0 && banner.x + banner.width <= viewport.width;
    }, 'Visible wrapped disclosure must sit below the collapsed toolbar, within the viewport').toBe(true);
    await expectCenterHitsControl(controls.getByRole('button', { name: 'Add to saved', exact: true }));
    const language = page.getByRole('group', { name: 'Language switcher', exact: true }).getByRole('button', { expanded: false });
    await expectCenterHitsControl(language);
    await language.click();
    const french = page.getByRole('option', { name: 'Français (FR)', exact: true });
    await expectCenterHitsControl(french);
    await french.click();
    await expect(region(page)).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('status').filter({ hasText: frenchFallback })).toBeVisible();
    if (viewport.width < 768) {
      const more = page.getByRole('button', { name: "Plus d'options", exact: true });
      await expectCenterHitsControl(more);
      await more.click();
    }
    const suggest = page.locator('button[data-suggest-place-trigger]:visible').first();
    await expectCenterHitsControl(suggest);
    await suggest.click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Suggérer un lieu', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    const path = testInfo.outputPath(`visible-fallback-toolbar-${viewport.width}.png`);
    await page.screenshot({ path });
    await testInfo.attach('Actual visible fallback and reachable toolbar', { path, contentType: 'image/png' });
  });
}

for (const sample of samples.flatMap(sample => [
  { width: 1280, height: 720 }, { width: 390, height: 844 },
].map(viewport => ({ ...sample, viewport })))) {
  test(`${sample.locale} ${sample.viewport.width}px: actual translated streamed UI before hydration, then html language synchronization`, async ({ page, context }, testInfo) => {
    await page.setViewportSize(sample.viewport);
    await setLocale(context, sample.locale);
    const scripts = await holdApplicationScripts(context);
    try {
      await page.goto(storyUrl, { waitUntil: 'commit' });
      await expect(region(page)).toHaveAttribute('lang', sample.locale);
      await expect(region(page).locator('a[href="#main-content"]')).toHaveText(sample.skip);
      await expect(page.getByTestId('next-story-button')).toHaveAttribute('aria-label', sample.next);
      await expect(page.getByTestId('next-story-button')).toBeDisabled();
      await expect.poll(scripts.held).toBeGreaterThan(0);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await assertBuiltClient(page);
      // React's streamed boundary reveals on a later frame; hidden markup is not first paint.
      await expect(region(page)).toBeVisible();
      await expect(visibleNext(page)).toHaveCount(1);
      await expect(visibleNext(page)).toHaveAttribute('aria-label', sample.next);
      await expect(visibleNext(page)).toBeDisabled();
      await expect(page.getByText(sample.preparing, { exact: true })).toBeVisible();
      const recovery = page.getByText(sample.preparing, { exact: true }).locator('..');
      await expectCenterHitsControl(recovery.locator('a[href="/immersive"]'), true);
      if (sample.locale !== 'es') {
        const fallback = region(page).locator('main p[role="status"]');
        await expect(fallback).toHaveCount(1);
        await expect(fallback).toBeVisible();
        await expect.poll(async () => {
          const [a, b] = await Promise.all([recovery.boundingBox(), fallback.boundingBox()]);
          return !!a && !!b && [a, b].every(box => box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0 && box.x + box.width <= sample.viewport.width && box.y + box.height <= sample.viewport.height) && (a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x);
        }, 'Pre-hydration recovery and translation disclosure must not overlap').toBe(true);
      }
      const path = testInfo.outputPath(`streamed-${sample.locale}-${sample.viewport.width}-scripts-held.png`);
      await page.screenshot({ path });
      await testInfo.attach('Actual streamed UI with external application scripts held', { path, contentType: 'image/png' });
    } finally { scripts.release(); }
    await expect(visibleNext(page)).toHaveCount(1);
    await expect(visibleNext(page)).toBeEnabled();
    await expect(page.locator('html')).toHaveAttribute('lang', sample.locale);
    await expect(page.getByRole('button', { name: sample.signIn, exact: true }).and(page.locator('[aria-haspopup="menu"]'))).toBeVisible();
    await expect(region(page).locator(':scope > [role="alert"]')).toHaveCount(0);
  });
}

test('verified named personal UI is streamed before hydration using real local password-auth cookies', async ({ page, context }) => {
  const session = await passwordSession();
  await inject(page, session);
  await setLocale(context, 'fr');
  const scripts = await holdApplicationScripts(context);
  try {
    await page.goto(storyUrl, { waitUntil: 'commit' });
    await expect(region(page)).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('button', { name: personalName(session), exact: true })).toBeVisible();
    await expect(page.getByTestId('next-story-button')).toBeDisabled();
    await expect.poll(scripts.held).toBeGreaterThan(0);
  } finally { scripts.release(); }
  await expect(visibleNext(page)).toHaveCount(1);
  await expect(visibleNext(page)).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

for (const kind of ['forged', 'expired'] as const) {
  test(`${kind} auth cookie and forged presentation hints remain anonymous-safe before and after hydration`, async ({ page, context }) => {
    const session = await passwordSession();
    const parts = session.access_token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // GoTrue can issue ES256 user tokens while also accepting the local legacy
    // JWT secret used by the stack's anon/service keys. Prove that authenticator
    // accepts our HS256 signature before testing an expired token signed by it.
    const header = kind === 'expired' ? Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') : parts[0];
    const verifier = createClient(datastore, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if (kind === 'expired') {
      const validPayload = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const validSignature = createHmac('sha256', required('PRESENTATION_LOCAL_JWT_SECRET')).update(`${header}.${validPayload}`).digest('base64url');
      const accepted = await verifier.auth.getUser(`${header}.${validPayload}.${validSignature}`);
      expect(accepted.error, 'The actual local authenticator must accept this signature before expiry is the oracle').toBeNull();
      expect(accepted.data.user?.id).toBe(session.user.id);
    }
    const payload = Buffer.from(JSON.stringify({ ...claims, exp: kind === 'expired' ? 1 : Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const signature = kind === 'expired' ? createHmac('sha256', required('PRESENTATION_LOCAL_JWT_SECRET')).update(`${header}.${payload}`).digest('base64url') : 'forged-signature';
    const invalid = { ...session, access_token: `${header}.${payload}.${signature}`, expires_at: kind === 'expired' ? 1 : Math.floor(Date.now() / 1000) + 3600, refresh_token: 'invalid-local-refresh-token' };
    const rejected = await verifier.auth.getUser(invalid.access_token);
    expect(rejected.error).not.toBeNull();
    expect(rejected.data.user).toBeNull();
    if (kind === 'expired') expect(rejected.error?.message, 'The authentic local signature must fail specifically on expiry').toMatch(/expired/i);
    await inject(page, invalid);
    await context.setExtraHTTPHeaders({ 'x-user-id': session.user.id, 'x-user-name': personalName(session), 'x-paisaxe-user': JSON.stringify(session.user) });
    await setLocale(context, 'fr');
    const scripts = await holdApplicationScripts(context);
    try {
      await page.goto(storyUrl, { waitUntil: 'commit' });
      await expect(region(page)).toHaveAttribute('lang', 'fr');
      await expect(page.getByTestId('next-story-button')).toBeDisabled();
      await expect(page.getByRole('button', { name: personalName(session), exact: true })).toHaveCount(0);
    } finally { scripts.release(); }
    await expect(page.getByRole('button', { name: 'Se connecter', exact: true }).and(page.locator('[aria-haspopup="menu"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: personalName(session), exact: true })).toHaveCount(0);
    expect([401, 403]).toContain((await page.request.get('/api/favorites')).status());
  });
}

test('real form draft and SDK auth continuity, product SPA links/history, locale and actual UI sign-out', async ({ page, context }) => {
  let suggestionSubmissions = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/suggestions' && request.method() === 'POST') suggestionSubmissions++;
  });
  await setLocale(context, 'en');
  await page.goto(storyUrl);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await page.evaluate(() => { window.__presentationRegion = document.querySelector('[data-request-presentation]'); });
  // The actual page-local dialog remains mounted while closed. Route departure
  // intentionally unmounts this form; cross-route draft persistence is not its contract.
  await page.locator('button[data-suggest-place-trigger]:visible').first().click();
  const values = ['Phase7 local draft', 'Keep this unsubmitted note', 'Local visitor'];
  const selectors = ['#place-name', '#comment', '#attribution'];
  for (const [index, selector] of selectors.entries()) await page.locator(selector).fill(values[index]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('group', { name: 'Language switcher', exact: true }).getByRole('button', { expanded: false }).click();
  await page.getByRole('option', { name: 'Français (FR)', exact: true }).click();
  await expect(region(page)).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.locator('button[data-suggest-place-trigger]:visible').first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Suggérer un lieu', exact: true })).toBeVisible();
  const handles = await Promise.all(selectors.map(selector => page.locator(selector).elementHandle()));
  for (const [index, selector] of selectors.entries()) await expect(page.locator(selector)).toHaveValue(values[index]);
  await page.addScriptTag({ content: presentationAuthClientSource(datastore, anonKey) });
  const login = await page.evaluate(async ({ email, password }) => window.__presentationAuthClient.login(email, password), { email, password });
  expect(login.error).toBeNull();
  expect(login.userId).toBeTruthy();
  const session = await readSessionFromAuthCookies(context, datastore);
  expect(session?.user.id).toBe(login.userId);
  if (!session) throw new Error('Real SDK login did not persist the application cookie contract');
  const name = personalName(session);
  expect((await page.request.get('/api/favorites')).status()).toBe(200);
  // The modal hides outside controls from the accessibility tree; require the
  // actual AuthProvider-driven name update before inspecting retained fields.
  await expect(page.getByRole('button', { name, exact: true, includeHidden: true })).toHaveCount(1);
  for (const [index, selector] of selectors.entries()) {
    expect(await handles[index]!.evaluate((node, query) => node.isConnected && node === document.querySelector(query), selector)).toBe(true);
    await expect(page.locator(selector)).toHaveValue(values[index]);
  }
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  const assertStable = async () => {
    expect(await page.evaluate(() => window.__presentationRegion === document.querySelector('[data-request-presentation]'))).toBe(true);
    await expect(region(page)).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    expect((await page.request.get('/api/favorites')).status()).toBe(200);
  };
  await page.getByTestId('ask-button').first().click();
  await page.getByRole('dialog').locator('a[href^="/pricing"]').click();
  await expect(page).toHaveURL(/\/pricing(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Conversations Vocales', exact: true })).toBeVisible();
  await assertStable();
  // Pricing has no direct favorites link. Its real back link returns to
  // immersive; the real saved-places control then navigates to favorites.
  await expect(page.locator('header a[href="/immersive"]:visible')).toHaveCount(1);
  await page.locator('header a[href="/immersive"]:visible').click();
  await expect(page).toHaveURL(/\/immersive(?:\?|$)/);
  // Cache Components retains the open chat on the inactive route. Close its
  // real modal before interacting with the intentionally inert background.
  await page.getByRole('button', { name: 'Fermer le chat', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.getByTestId('story-info-panel').getByRole('button', { name: 'Favoris', exact: true }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await assertStable();
  await page.goBack();
  await expect(page).toHaveURL(/\/immersive/);
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await assertStable();
  await page.goForward();
  await expect(page).toHaveURL(/\/favorites$/);
  await assertStable();
  await expect(page.locator('header a[href="/immersive"]:visible')).toHaveCount(1);
  await page.locator('header a[href="/immersive"]:visible').click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true }).first()).toBeVisible();
  expect([401, 403]).toContain((await page.request.get('/api/favorites')).status());
  expect(suggestionSubmissions).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true }).first()).toBeVisible();
  await expect(region(page)).toHaveAttribute('lang', 'fr');
});

test('real client auth timeout shows localized retry and a successful retry restores verified presentation', async ({ page, context }) => {
  const session = await passwordSession();
  await inject(page, session);
  await setLocale(context, 'fr');
  let delay = true, heldRequests = 0;
  await context.route(url => url.origin === new URL(datastore).origin && url.pathname === '/auth/v1/user', async route => {
    if (delay) {
      heldRequests++;
      // Delay only the actual third-party transport. No owned route or auth
      // provider result is replaced; retry reaches the real local GoTrue API.
      await new Promise(resolve => setTimeout(resolve, 1800));
    }
    await route.continue().catch(error => {
      if (!/cancel|closed|disposed/i.test(String(error))) throw error;
    });
  });
  await page.goto(storyUrl);
  await expect(page.getByRole('button', { name: 'Vérifier à nouveau la session', exact: true })).toBeVisible();
  expect(heldRequests).toBeGreaterThan(0);
  await expect(page.getByText('Votre session n’a pas pu être vérifiée. Réessayez pour continuer.', { exact: true })).toBeVisible();
  delay = false;
  await page.getByRole('button', { name: 'Vérifier à nouveau la session', exact: true }).click();
  await expect(page.getByRole('button', { name: personalName(session), exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vérifier à nouveau la session', exact: true })).toHaveCount(0);
  await expect(region(page)).toHaveAttribute('lang', 'fr');
});

test('real admin PATCH preserves unchanged questions and invalidates same-count edits and removed source prompts in Postgres', async ({ page, context }) => {
  const id = required('PRESENTATION_PROMPT_STORY_ID');
  expect(id).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const nonce = marker.split(':')[1];
  interface PromptMetadata {
    issues_phase7_fixture: string;
    sentinel: string;
    question_prompts?: string[];
    translations: { fr: { title: string; subtitle: string; description: string; question_prompts?: string[] } };
    translation_status: { fr: { status: string; updatedAt: string; error?: string } };
  }
  const persisted = (): PromptMetadata => {
    // The existing psql helper checks the exact task database marker first.
    // Both interpolated identifiers are constrained UUIDs; this read can only
    // observe the parent's one synthetic story with this exact fixture nonce.
    const raw = psql(`SELECT metadata::text FROM public.stories WHERE id='${id}'::uuid AND metadata->>'issues_phase7_fixture'='${nonce}';`);
    expect(raw, 'The exact owned prompt fixture must exist; never substitute a public story').not.toBe('');
    return JSON.parse(raw) as PromptMetadata;
  };
  const before = persisted();
  expect(before).toMatchObject({
    issues_phase7_fixture: nonce,
    sentinel: 'retain-unrelated-metadata',
    question_prompts: ['¿Qué puedo visitar?'],
    translations: { fr: {
      title: 'Question originale', subtitle: 'Visite locale', description: 'Histoire synthétique locale.',
      question_prompts: ['Que puis-je visiter ?'],
    } },
    translation_status: { fr: { status: 'complete', updatedAt: expect.any(String) } },
  });

  const session = await passwordSession();
  await inject(page, session);
  await page.goto(storyUrl);
  await expect(page.getByRole('button', { name: personalName(session), exact: true })).toBeVisible();
  const csrf = (await context.cookies(origin)).find(cookie => cookie.name === '__csrf')?.value;
  expect(csrf, 'Use the real page-issued CSRF cookie').toBeTruthy();
  const patch = async (metadata: PromptMetadata, invalidated = false) => {
    const startedAt = Date.now();
    const response = await page.request.patch(`/api/admin/stories/${id}`, {
      headers: { origin, 'x-csrf-token': csrf! },
      data: { metadata },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(id);
    const actual = persisted();
    expect(body.data.metadata, 'Actual HTTP response must agree with the independent persisted-row oracle').toEqual(actual);
    if (invalidated) {
      // JSON stores the application's ISO invalidation time. The existing SQL
      // trigger independently sets row updated_at; their equality is not a contract.
      const invalidatedAt = actual.translation_status.fr.updatedAt;
      expect(new Date(invalidatedAt).toISOString()).toBe(invalidatedAt);
      expect(Date.parse(invalidatedAt)).toBeGreaterThanOrEqual(startedAt);
      expect(Date.parse(invalidatedAt)).toBeLessThanOrEqual(Date.now());
    }
    return { actual };
  };

  const unchanged = await patch(structuredClone(before));
  expect(unchanged.actual).toEqual(before);

  const changed = await patch({ ...structuredClone(before), question_prompts: ['¿Dónde puedo comer?'] }, true);
  const { question_prompts: originalFrenchQuestions, ...translatedText } = before.translations.fr;
  expect(changed.actual).toEqual({
    ...before,
    question_prompts: ['¿Dónde puedo comer?'],
    translations: { fr: translatedText },
    translation_status: { fr: {
      ...before.translation_status.fr,
      status: 'pending',
      error: 'Source questions changed; regenerate translation',
      updatedAt: expect.any(String),
    } },
  });
  expect(changed.actual.translations.fr).not.toHaveProperty('question_prompts');

  const removed = structuredClone(changed.actual);
  delete removed.question_prompts;
  // A stale editor can submit the old French array while removing its source.
  // The route must remove this ghost, preserving translated story text.
  removed.translations.fr.question_prompts = originalFrenchQuestions;
  const cleared = await patch(removed, true);
  const withoutSource = structuredClone(changed.actual);
  delete withoutSource.question_prompts;
  expect(cleared.actual).toEqual({
    ...withoutSource,
    translation_status: { fr: {
      ...changed.actual.translation_status.fr,
      status: 'pending',
      updatedAt: expect.any(String),
    } },
  });
  expect(cleared.actual).not.toHaveProperty('question_prompts');
  expect(cleared.actual.translations.fr).not.toHaveProperty('question_prompts');
  // Parent owns deletion of this exact fixture and restoration of its QA role.
});

// Last: consume the real local read budget only after the other journeys.
test('mobile fallback and actual rate-limit retry remain reachable and recover without navigating', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await inject(page, await passwordSession());
  await setLocale(context, 'en');
  let retryAfter = 0;
  for (let attempt = 0; attempt < 70; attempt++) {
    const response = await page.request.get('/api/favorites');
    expect([200, 429]).toContain(response.status());
    if (response.status() === 429) {
      retryAfter = Number(response.headers()['retry-after']);
      break;
    }
  }
  expect(Number.isInteger(retryAfter)).toBe(true);
  expect(retryAfter).toBeGreaterThanOrEqual(1);
  expect(retryAfter).toBeLessThanOrEqual(60);
  await page.goto(storyUrl);
  await expect(visibleNext(page)).toHaveCount(1);
  await expect(visibleNext(page)).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: englishFallback })).toBeVisible();
  const alert = page.getByRole('alert').filter({ hasText: /Temporary limit\. Wait \d+ seconds and try again\./ });
  const retry = alert.getByRole('button', { name: 'Try again', exact: true });
  await expectCenterHitsControl(retry);
  const title = await page.locator('h1').textContent();
  const url = page.url();
  const screenshot = testInfo.outputPath('visible-fallback-mobile-rate-limit-retry.png');
  await page.screenshot({ path: screenshot });
  await testInfo.attach('Actual local 429 with visible fallback and reachable retry', { path: screenshot, contentType: 'image/png' });
  // Honor the server's real window; no production budget or route is replaced.
  await page.waitForTimeout((retryAfter + 1) * 1000);
  const recovery = page.waitForResponse(response => new URL(response.url()).pathname === '/api/favorites' && response.request().method() === 'GET');
  await retry.click();
  expect((await recovery).status()).toBe(200);
  await expect(alert).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(page.locator('h1')).toHaveText(title!);
  await expect(page.getByRole('status').filter({ hasText: englishFallback })).toBeVisible();
});
