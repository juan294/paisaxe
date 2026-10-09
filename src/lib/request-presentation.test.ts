// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInitialPresentation } from './request-presentation';
import { resolveTranslation } from './i18n/resolve';

const mocks = vi.hoisted(() => ({ cookie: null as string | null, language: null as string | null, authCookies: [] as {name: string; value: string}[], getUser: vi.fn(), createClient: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => mocks.cookie ? { value: mocks.cookie } : undefined, getAll: () => mocks.authCookies }), headers: async () => ({ get: (name: string) => name === 'accept-language' ? mocks.language : 'forged-user-hint' }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: (...args: unknown[]) => { mocks.createClient(...args); return { auth: { getUser: mocks.getUser } }; } }));
beforeEach(() => {
  mocks.cookie = null; mocks.language = null; mocks.authCookies = [];
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJ-local-test-only');
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('request-scoped initial presentation', () => {
  it.each(['en', 'fr', 'de', 'pt', 'ast'] as const)('seeds the complete active %s dictionary before client hydration', async locale => {
    mocks.cookie = locale;
    const seed = await getInitialPresentation();
    expect(seed.locale).toBe(locale);
    expect(seed.dictionaryLocale).toBe(locale);
    expect(resolveTranslation('chat.placeholder', seed.dictionary)).not.toBe('chat.placeholder');
    expect(seed.localeSource).toBe('cookie');
    expect(seed.user).toBeNull();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('ignores forged hints and invalid cookies, selecting the browser language', async () => {
    mocks.cookie = 'invalid'; mocks.language = 'fr-FR,en;q=0.8';
    const seed = await getInitialPresentation();
    expect(seed.locale).toBe('fr');
    expect(seed.user).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('verifies auth cookies and emits only the narrow user, never tokens or roles', async () => {
    mocks.authCookies = [{ name: 'sb-127-auth-token', value: 'untrusted-cookie' }];
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'real-user', email: 'real@example.test', user_metadata: { name: 'Real' }, app_metadata: { role: 'admin' }, access_token: 'secret-token' } }, error: null });
    const seed = await getInitialPresentation();
    expect(seed.user).toEqual({ id: 'real-user', email: 'real@example.test', name: 'Real', avatarUrl: null });
    expect(JSON.stringify(seed)).not.toContain('secret-token');
    expect(JSON.stringify(seed.user)).not.toContain('admin');
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it('does not trust an expired or forged auth cookie', async () => {
    mocks.authCookies = [{ name: 'sb-127-auth-token', value: 'forged' }];
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    const seed = await getInitialPresentation();
    expect(seed.user).toBeNull();
    expect(seed.authError).toBe(true);
  });

  it('bounds slow auth and emits an anonymous error/retry state', async () => {
    vi.useFakeTimers();
    mocks.authCookies = [{ name: 'sb-127-auth-token', value: 'slow' }];
    mocks.getUser.mockReturnValue(new Promise(() => {}));
    const pending = getInitialPresentation();
    await vi.advanceTimersByTimeAsync(1500);
    const seed = await pending;
    expect(seed.user).toBeNull();
    expect(seed.authError).toBe(true);
    expect(mocks.createClient.mock.calls[0][2].global.fetch).toBeTypeOf('function');
  });
});
