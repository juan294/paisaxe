import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { AuthProvider, useAuthContext } from './auth-provider';

function Consumer() {
  const { user, session, isLoading, authError } = useAuthContext();
  return <output>{user?.name ?? 'anonymous'}:{String(!!session)}:{String(isLoading)}:{String(!!authError)}</output>;
}
let client: ReturnType<typeof createSupabaseBrowserClient>;
const transport = vi.fn(async () => { throw new Error('Anonymous SDK bootstrap must not request a network transport'); });
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJ-local-anonymous-contract');
  vi.stubGlobal('fetch', transport);
  transport.mockClear();
  expect(document.cookie).not.toMatch(/sb-127-auth-token/);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => { await client?.auth.dispose(); });

describe('actual installed browser SDK anonymous bootstrap', () => {
  it.each([null, { id: 'verified-seed', email: 'seed@example.invalid', name: 'Server seed', avatarUrl: null }])('settles missing session as anonymous without a verification failure (seed %j)', async initialUser => {
    client = createSupabaseBrowserClient();
    expect(client).not.toBeNull();
    const result = await client!.auth.getUser();
    expect(result.data.user).toBeNull();
    expect(isAuthSessionMissingError(result.error)).toBe(true);
    // No owned module or SDK outcome is mocked: the same real wrapper/client
    // supplies the missing-session result to the real provider bootstrap.
    const view = render(<AuthProvider initialUser={initialUser}><Consumer /></AuthProvider>);
    try {
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous:false:false:false'));
      expect(transport).not.toHaveBeenCalled();
    } finally { view.unmount(); }
  });
});
