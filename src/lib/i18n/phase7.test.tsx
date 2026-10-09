import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { LanguageProvider } from './provider';
import { useTranslation } from './use-translation';
import { fr } from './fr';
import { es } from './es';
import * as resources from './dictionaries';
import { interpolate } from './interpolate';
import { resolveRequestLocale } from './preference';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  document.cookie = 'paisaxe-locale=; Max-Age=0; Path=/';
});

function Consumer() {
  const { t, locale, setLocale } = useTranslation();
  const { loadError, retryLanguage } = useTranslation();
  return <><output>{locale}:{t('common.loading')}</output><button onClick={() => setLocale('de')}>de</button><button onClick={() => setLocale('en')}>en</button><button onClick={() => setLocale('fr')}>fr</button>{loadError && <button onClick={retryLanguage}>retry</button>}</>;
}

describe('Phase 7 locale contract', () => {
  it('uses the complete active dictionary in server output before effects', () => {
    const html = renderToString(<LanguageProvider initialLocale="fr" initialDictionary={fr}><Consumer /></LanguageProvider>);
    expect(html).toContain('Chargement...');
    expect(html).not.toContain('Cargando...');
  });

  it('persists explicit choice in a server-readable validated cookie', () => {
    render(<LanguageProvider initialLocale="fr" initialDictionary={fr}><Consumer /></LanguageProvider>);
    act(() => screen.getByRole('button', { name: 'de' }).click());
    expect(document.cookie).toContain('paisaxe-locale=de');
    expect(localStorage.getItem('paisaxe-locale')).toBe('de');
  });

  it('migrates legacy storage once when the server has no explicit cookie', async () => {
    localStorage.setItem('paisaxe-locale', 'en');
    render(<LanguageProvider initialLocale="fr" initialDictionary={fr} reconcileLegacyPreference><Consumer /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('en:Loading...'));
    expect(document.cookie).toContain('paisaxe-locale=en');
  });

  it('validates cookies and honors weighted supported browser preferences', () => {
    expect(resolveRequestLocale('de', 'en-US,en;q=0.9')).toEqual({ locale: 'de', source: 'cookie' });
    expect(resolveRequestLocale('forged', 'zz,fr-FR;q=0.4,en;q=0.8')).toEqual({ locale: 'en', source: 'browser' });
    expect(resolveRequestLocale(null, 'de;q=0,zz;q=1')).toEqual({ locale: 'es', source: 'default' });
    expect(resolveRequestLocale('__proto__', null)).toEqual({ locale: 'es', source: 'default' });
  });

  it('replaces every occurrence with literal dollar and brace values in one pass', () => {
    expect(interpolate('{title} / {title} / {count}', { title: '$& {count}', count: 3 })).toBe('$& {count} / $& {count} / 3');
  });

  it('keeps missing variables visible and emits development diagnostics', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(interpolate('{missing} {count}', { count: 0 })).toBe('{missing} 0');
    expect(warning).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

// Controlled chunk transport stands in for an import stalled by the network;
// this probe pins that seam to all six real shipped dictionary resources.
describe('dictionary recovery', () => {
  it('loads every actual dictionary resource', async () => {
    for (const locale of ['es', 'en', 'fr', 'de', 'pt', 'ast'] as const) {
      expect((await resources.loadDictionary(locale)).common).toBeDefined();
    }
  });
  it('bounds a stalled chunk, retries, and rejects a stale completion after a newer choice', async () => {
    vi.useFakeTimers();
    let finish!: (dictionary: typeof fr) => void;
    const original = resources.loadDictionary;
    vi.spyOn(resources, 'loadDictionary').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockImplementation(original);
    const view = render(<LanguageProvider initialLocale="fr" initialDictionary={fr}><Consumer /></LanguageProvider>);
    act(() => screen.getByRole('button', {name:'de'}).click());
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByRole('button', {name:'retry'})).toBeVisible();
    await act(async () => screen.getByRole('button', {name:'retry'}).click());
    expect(screen.getByRole('status')).toHaveTextContent('de:Laden...');
    await act(async () => screen.getByRole('button', {name:'en'}).click());
    await act(async () => finish(fr));
    expect(screen.getByRole('status')).toHaveTextContent('en:Loading...');
    view.unmount();
    vi.useRealTimers();
  });
  it('prefers an existing explicit cookie over conflicting legacy storage', async () => {
    document.cookie='paisaxe-locale=fr; Path=/';
    localStorage.setItem('paisaxe-locale','en');
    render(<LanguageProvider initialLocale="fr" initialDictionary={fr} reconcileLegacyPreference><Consumer /></LanguageProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('fr:Chargement...');
    expect(document.cookie).toContain('paisaxe-locale=fr');
  });
});

describe('failed server resource navigation', () => {
  it('loads again when revisiting a locale whose initial request failed', async () => {
    const spy = vi.spyOn(resources, 'loadDictionary');
    render(<LanguageProvider initialLocale="fr" initialLanguageError initialDictionaryLocale="es"><Consumer /></LanguageProvider>);
    await act(async () => screen.getByRole('button', {name:'en'}).click());
    await act(async () => screen.getByRole('button', {name:'fr'}).click());
    expect(spy).toHaveBeenCalledWith('fr');
    expect(screen.getByRole('status')).toHaveTextContent('fr:Chargement...');
  });
});

describe('same locale recovery', () => {
  it('preserves a valid seeded dictionary when reselecting its language', async () => {
    resources.resetDictionaryCacheForTesting();
    const loader = vi.spyOn(resources, 'loadDictionary');
    render(<LanguageProvider initialLocale="fr" initialDictionary={fr} initialDictionaryLocale="fr"><Consumer /></LanguageProvider>);
    await act(async () => screen.getByRole('button', { name: 'fr' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('fr:Chargement...');
    expect(screen.queryByRole('button', { name: 'retry' })).not.toBeInTheDocument();
    expect(loader).not.toHaveBeenCalled();
  });

  it('treats selecting the currently failed language as an executable retry', async () => {
    render(<LanguageProvider initialLocale="fr" initialDictionary={es} initialDictionaryLocale="es" initialLanguageError><Consumer /></LanguageProvider>);
    await act(async () => screen.getByRole('button',{name:'fr'}).click());
    expect(screen.getByRole('status')).toHaveTextContent('fr:Chargement...');
  });
});
