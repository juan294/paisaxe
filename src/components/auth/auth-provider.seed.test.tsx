import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { AuthProvider, useAuthContext } from './auth-provider';

const state = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), callback: undefined as undefined | ((event: string, session: unknown) => void) }));
vi.mock('@/lib/supabase-browser', () => ({ createSupabaseBrowserClient: () => ({ auth: { getSession: state.getSession, getUser: state.getUser, onAuthStateChange: state.subscribe } }) }));
const initialUser = { id: 'verified-user', email: 'verified@example.test', name: 'Verified Name', avatarUrl: null };
const rawUser = { ...initialUser, user_metadata: { name: initialUser.name } };
function Consumer() {
  const { user, isLoading, authError, retryAuth } = useAuthContext();
  return <><output>{user?.name ?? 'anonymous'}:{String(isLoading)}:{String(!!authError)}</output><button onClick={retryAuth}>retry</button></>;
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJ-local-test-only');
  state.getSession.mockResolvedValue({ data: { session: null } });
  state.getUser.mockResolvedValue({ data: { user: null }, error: null });
  state.subscribe.mockImplementation((callback) => { state.callback = callback; return { data: { subscription: { unsubscribe: state.unsubscribe } } }; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('Phase 7 verified presentation seed and bounded auth', () => {
  it('renders the verified narrow user before effects without manufacturing a session', () => {
    expect(renderToString(<AuthProvider initialUser={initialUser}><Consumer /></AuthProvider>)).toContain('Verified Name');
    expect(state.getSession).not.toHaveBeenCalled();
  });

  it('subscribes before bootstrap and ignores a late bootstrap after logout', async () => {
    let finish!: (value: unknown) => void;
    state.getUser.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<AuthProvider initialUser={initialUser}><Consumer /></AuthProvider>);
    await waitFor(() => expect(state.getUser).toHaveBeenCalled());
    expect(state.subscribe).toHaveBeenCalled();
    act(() => state.callback?.('SIGNED_OUT', null));
    await act(async () => finish({ data: { user: rawUser }, error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('anonymous:false:false');
  });

  it('ends slow auth at 1500ms and successfully retries without remounting children', async () => {
    vi.useFakeTimers();
    state.getUser.mockReturnValueOnce(new Promise(() => {}));
    render(<AuthProvider initialUser={initialUser}><Consumer /></AuthProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByRole('status')).toHaveTextContent('anonymous:false:true');
    state.getUser.mockResolvedValue({ data: { user: rawUser }, error: null });
    await act(async () => { screen.getByRole('button', { name: 'retry' }).click(); await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole('status')).toHaveTextContent('Verified Name:false:false');
  });
});

describe('explicit recovery on a deferred static route', () => {
  it('keeps default deferral but performs a bounded explicit retry', async () => {
    render(<AuthProvider deferInitialAuth initialAuthError><Consumer /></AuthProvider>);
    expect(state.getUser).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('anonymous:false:true');
    state.getUser.mockResolvedValue({data:{user:rawUser},error:null});
    await act(async () => screen.getByRole('button',{name:'retry'}).click());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Verified Name:false:false'));
  });
});
