import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { AuthProvider, useAuthContext } from './auth-provider';

// The provider, browser wrapper, cookie storage and installed SDK stay real.
// Only the third-party GoTrue HTTP boundary is controlled; no event is supplied
// by a mock onAuthStateChange callback.
const api = 'http://127.0.0.1:54321';
const cookie = 'sb-127-auth-token';
const observed: string[] = [];
const userRequests: string[] = [];
const pending = new Map<string, (response: Response) => void>();
const candidates = new Map<string, Session>();
let mode: 'reject' | 'verify' | 'hold' = 'verify';
let view: ReturnType<typeof render> | undefined;
let client: ReturnType<typeof createSupabaseBrowserClient>;

function candidate(id: string, name = 'Unverified stored name'): Session {
  const user: User = { id, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z',
    email: `${id}@example.invalid`, app_metadata: {}, user_metadata: { name } };
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })}.c3ludGhldGlj`;
  const session: Session = { access_token, refresh_token: `synthetic-refresh-${id}`, token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  candidates.set(access_token, session);
  return session;
}

function responseUser(session: Session): User {
  return { ...session.user, user_metadata: { name: `Verified ${session.user.id}` } };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== api) throw new Error('Unexpected external auth transport');
  if (url.pathname === '/auth/v1/user') {
    const token = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    userRequests.push(token);
    const session = candidates.get(token);
    if (!session) throw new Error('Uninventoried auth verification token');
    if (mode === 'reject') return json({ code: 'bad_jwt', message: 'Invalid JWT signature' }, 403);
    if (mode === 'hold') return new Promise(resolve => { pending.set(token, resolve); });
    return json(responseUser(session));
  }
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const email = JSON.parse(String(init?.body)).email as string;
    const session = [...candidates.values()].find(value => value.user.email === email);
    if (!session) throw new Error('Uninventoried synthetic login');
    return json(session);
  }
  if (url.pathname === '/auth/v1/logout') return json({});
  throw new Error('Unexpected local auth transport path');
});

function Consumer() {
  const { user, session, isLoading, authError, retryAuth } = useAuthContext();
  const state = `${user?.name ?? 'anonymous'}|${session?.user.user_metadata.name ?? 'no-session'}|${isLoading}|${!!authError}`;
  observed.push(state);
  return <><output>{state}</output><button onClick={retryAuth}>retry</button></>;
}

function store(session: Session) {
  const encoded = btoa(JSON.stringify(session)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  document.cookie = `${cookie}=base64-${encoded}; Path=/; SameSite=Lax`;
}
async function flush() {
  for (let index = 0; index < 30; index++) await Promise.resolve();
}
async function mountAnonymous() {
  view = render(<AuthProvider><Consumer /></AuthProvider>);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous|no-session|false|false'));
  client = createSupabaseBrowserClient();
  expect(client).not.toBeNull();
}
async function login(session: Session) {
  await act(async () => {
    const result = await client!.auth.signInWithPassword({ email: session.user.email!, password: 'synthetic-local-only' });
    expect(result.error).toBeNull();
  });
}
function complete(session: Session) {
  const resolve = pending.get(session.access_token);
  expect(resolve, 'The actual SDK must verify this exact token at the HTTP boundary').toBeDefined();
  pending.delete(session.access_token);
  resolve!(json(responseUser(session)));
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', api);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJ-local-events-contract');
  vi.stubGlobal('fetch', transport);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  mode = 'verify'; observed.length = 0; userRequests.length = 0; transport.mockClear();
  document.cookie = `${cookie}=; Max-Age=0; Path=/`;
});
afterEach(async () => {
  view?.unmount(); view = undefined;
  // Finish held external requests only after unmount; they cannot affect UI.
  for (const resolve of pending.values()) resolve(json({ code: 'bad_jwt', message: 'Disposed test request' }, 403));
  pending.clear();
  vi.useRealTimers();
  client = createSupabaseBrowserClient();
  await client?.auth.signOut({ scope: 'local' });
  document.cookie = `${cookie}=; Max-Age=0; Path=/`;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
afterAll(async () => { await client?.auth.dispose(); });

describe('actual SDK recovery events are candidate credentials, not verified identity', () => {
  it('never publishes a forged persisted user when recovery emits SIGNED_IN before /user rejects it', async () => {
    const forged = candidate('forged');
    store(forged); mode = 'reject';
    view = render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(userRequests).toContain(forged.access_token));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous|no-session|false|true'));
    expect(observed.some(value => value.includes('Unverified stored name'))).toBe(false);
  });

  it('keeps real visibility recovery pending, reaches 1500ms failure, ignores its late result and retries', async () => {
    await mountAnonymous();
    const stored = candidate('slow-recovery');
    const events: string[] = [];
    let recovered!: () => void;
    const recovery = new Promise<void>(resolve => { recovered = resolve; });
    const subscription = client!.auth.onAuthStateChange((event: AuthChangeEvent) => {
      events.push(event);
      if (event === 'SIGNED_IN') recovered();
    }).data.subscription;
    try {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      mode = 'hold'; store(stored);
      await act(async () => { window.dispatchEvent(new Event('visibilitychange')); await recovery; await flush(); });
      expect(events).toContain('SIGNED_IN');
      expect(userRequests).toContain(stored.access_token);
      expect(screen.getByRole('status')).not.toHaveTextContent('Unverified stored name');
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
      expect(screen.getByRole('status')).toHaveTextContent('anonymous|no-session|false|true');
      await act(async () => { complete(stored); await flush(); });
      expect(screen.getByRole('status')).toHaveTextContent('anonymous|no-session|false|true');
      mode = 'verify';
      await act(async () => { screen.getByRole('button', { name: 'retry' }).click(); await flush(); });
      expect(screen.getByRole('status')).toHaveTextContent('Verified slow-recovery|Verified slow-recovery|false|false');
    } finally { subscription.unsubscribe(); }
  });

  it('publishes both context user and session.user only from the authoritative token verification', async () => {
    await mountAnonymous();
    const signed = candidate('fresh-login');
    await login(signed);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Verified fresh-login|Verified fresh-login|false|false'));
    expect(userRequests).toContain(signed.access_token);
    expect(observed.some(value => value.includes('Unverified stored name'))).toBe(false);
  });

  it('a newer actual SDK login wins over an older event verification resolving last', async () => {
    await mountAnonymous(); mode = 'hold';
    const older = candidate('older-login'), newer = candidate('newer-login');
    await login(older);
    await waitFor(() => expect(pending.has(older.access_token)).toBe(true));
    await login(newer);
    await waitFor(() => expect(pending.has(newer.access_token)).toBe(true));
    await act(async () => { complete(newer); await flush(); });
    expect(screen.getByRole('status')).toHaveTextContent('Verified newer-login|Verified newer-login|false|false');
    await act(async () => { complete(older); await flush(); });
    expect(screen.getByRole('status')).toHaveTextContent('Verified newer-login|Verified newer-login|false|false');
  });

  it('actual SDK SIGNED_OUT clears synchronously and beats a late user-bearing event result', async () => {
    await mountAnonymous(); mode = 'hold';
    const signed = candidate('logout-race');
    await login(signed);
    await waitFor(() => expect(pending.has(signed.access_token)).toBe(true));
    await act(async () => { expect((await client!.auth.signOut({ scope: 'local' })).error).toBeNull(); });
    expect(screen.getByRole('status')).toHaveTextContent('anonymous|no-session|false|false');
    await act(async () => { complete(signed); await flush(); });
    expect(screen.getByRole('status')).toHaveTextContent('anonymous|no-session|false|false');
  });
});
