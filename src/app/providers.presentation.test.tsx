import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useEffect } from 'react';
import { Providers } from './providers';
import { RequestPresentationProviderShell } from './request-presentation-provider-shell';
import { useAuthContext } from '@/components/auth/auth-provider';
import { useTranslation } from '@/lib/i18n';
import { getInitialPresentation } from '@/lib/request-presentation';
import { _resetTranslationCacheForTesting } from '@/lib/i18n/provider';
import { LOCALE_COOKIE } from '@/lib/i18n/preference';

// Only framework and third-party transport boundaries are replaced. The real
// request factory, shell, Providers, context providers and consumers all run.
const mocks = vi.hoisted(() => ({
  pathname: '/immersive',
  serverGetUser: vi.fn(),
  browserGetUser: vi.fn(),
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
  onAuthStateChange: vi.fn(),
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === LOCALE_COOKIE ? { value: 'fr' } : undefined,
    getAll: () => [{ name: 'sb-127-auth-token', value: 'opaque-local-fixture' }],
  }),
  headers: async () => ({ get: () => 'en-GB' }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => {
    mocks.createServerClient(...args);
    return { auth: { getUser: mocks.serverGetUser } };
  },
  createBrowserClient: (...args: unknown[]) => {
    mocks.createBrowserClient(...args);
    return { auth: {
      getSession: mocks.getSession,
      getUser: mocks.browserGetUser,
      onAuthStateChange: mocks.onAuthStateChange,
    } };
  },
}));

const verifiedUser = {
  id: 'local-presentation-user',
  email: 'presentation@example.test',
  user_metadata: { full_name: 'Camille', avatar_url: 'https://example.test/avatar.png' },
  app_metadata: { role: 'must-not-reach-presentation' },
  access_token: 'must-not-reach-html',
};
const narrowUser = {
  id: verifiedUser.id,
  email: verifiedUser.email,
  name: 'Camille',
  avatarUrl: verifiedUser.user_metadata.avatar_url,
};

function PresentationProbe() {
  const { user, isLoading } = useAuthContext();
  const { locale, t, setLocale } = useTranslation();
  useEffect(() => {
    mocks.mount();
    return () => { mocks.unmount(); };
  }, []);
  return <>
    <output data-testid="presentation-user">{JSON.stringify(user)}</output>
    <output data-testid="presentation-loading">{String(isLoading)}</output>
    <output data-testid="presentation-locale">{locale}</output>
    <p data-testid="translated-label">{t('common.close')}</p>
    <label>Trip notes<input defaultValue="" /></label>
    <button type="button" onClick={() => setLocale('en')}>Choose English</button>
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetTranslationCacheForTesting();
  localStorage.clear();
  document.cookie = `${LOCALE_COOKIE}=fr; Path=/`;
  mocks.pathname = '/immersive';
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJ-local-presentation-fixture');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
  mocks.serverGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });
  mocks.browserGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) !== '/api/feature-flags') throw new Error(`Unexpected transport: ${String(input)}`);
    return Response.json({ data: [] });
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('real request presentation and stable Providers', () => {
  it('renders the verified narrow French seed through the actual shell before client effects', async () => {
    const shell = await RequestPresentationProviderShell({ children: <PresentationProbe /> });
    const html = renderToString(shell);
    const container = document.createElement('div');
    container.innerHTML = html;

    expect(container.querySelector('[data-request-presentation]')).toHaveAttribute('lang', 'fr');
    expect(container.querySelector('[data-testid="translated-label"]')).toHaveTextContent('Fermer');
    expect(container.querySelector('a[href="#main-content"]')).toHaveTextContent('Aller au contenu principal');
    expect(JSON.parse(container.querySelector('[data-testid="presentation-user"]')!.textContent!)).toEqual(narrowUser);
    expect(html).not.toContain('must-not-reach-presentation');
    expect(html).not.toContain('must-not-reach-html');
    expect(mocks.serverGetUser).toHaveBeenCalledOnce();
    expect(mocks.createBrowserClient).not.toHaveBeenCalled();
    expect(mocks.browserGetUser).not.toHaveBeenCalled();
    expect(mocks.mount).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves one real auth/language tree, selected language, verified user and form state across revenue routes', async () => {
    const seed = await getInitialPresentation();
    const tree = () => <Providers initialPresentation={seed}><PresentationProbe /></Providers>;
    const view = render(tree());
    await waitFor(() => expect(screen.getByTestId('presentation-loading')).toHaveTextContent('false'));
    expect(JSON.parse(screen.getByTestId('presentation-user').textContent!)).toEqual(narrowUser);
    expect(view.container.querySelector('[data-request-presentation]')).toHaveAttribute('lang', 'fr');
    const notes = screen.getByRole('textbox', { name: 'Trip notes' });
    fireEvent.change(notes, { target: { value: 'Keep my itinerary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose English' }));
    await waitFor(() => expect(screen.getByTestId('translated-label')).toHaveTextContent('Close'));

    for (const pathname of ['/pricing', '/favorites']) {
      mocks.pathname = pathname;
      await act(async () => { view.rerender(tree()); });
      expect(screen.getByRole('textbox', { name: 'Trip notes' })).toBe(notes);
      expect(notes).toHaveValue('Keep my itinerary');
      expect(screen.getByTestId('presentation-locale')).toHaveTextContent('en');
      expect(screen.getByTestId('translated-label')).toHaveTextContent('Close');
      expect(view.container.querySelector('[data-request-presentation]')).toHaveAttribute('lang', 'en');
      expect(JSON.parse(screen.getByTestId('presentation-user').textContent!)).toEqual(narrowUser);
    }

    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce();
    expect(mocks.browserGetUser).toHaveBeenCalledOnce();
    expect(mocks.mount).toHaveBeenCalledOnce();
    expect(mocks.unmount).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('/api/feature-flags');
    view.unmount();
    expect(mocks.unmount).toHaveBeenCalledOnce();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
