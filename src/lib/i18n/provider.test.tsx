import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { LanguageProvider, LanguageContext, _resetTranslationCacheForTesting } from './provider';
import { useTranslation } from './use-translation';

// Test component that uses the hook
function TestConsumer() {
  const { t, locale, setLocale } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translation">{t('common.loading')}</span>
      <span data-testid="chat-placeholder">{t('chat.placeholder')}</span>
      <span data-testid="missing-key">{t('nonexistent.key')}</span>
      <button onClick={() => setLocale('en')} data-testid="switch-en">Switch to EN</button>
      <button onClick={() => setLocale('es')} data-testid="switch-es">Switch to ES</button>
      <button onClick={() => setLocale('fr')} data-testid="switch-fr">Switch to FR</button>
      <button onClick={() => setLocale('de')} data-testid="switch-de">Switch to DE</button>
      <button onClick={() => setLocale('pt')} data-testid="switch-pt">Switch to PT</button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    _resetTranslationCacheForTesting();
  });

  it('renders with default locale "es" when initialLocale is provided', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('translation').textContent).toBe('Cargando...');
  });

  it('renders with locale "en" when initialLocale is "en"', () => {
    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('translation').textContent).toBe('Loading...');
  });

  it('resolves chat placeholder in Spanish', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('chat-placeholder').textContent).toBe('Escribe tu pregunta...');
  });

  it('resolves chat placeholder in English', () => {
    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('chat-placeholder').textContent).toBe('Ask about this place...');
  });

  it('returns the key itself for missing translations', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('missing-key').textContent).toBe('nonexistent.key');
  });

  it('switches locale from es to en', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('translation').textContent).toBe('Cargando...');

    act(() => {
      screen.getByTestId('switch-en').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('translation').textContent).toBe('Loading...');
  });

  it('switches locale from en to es', () => {
    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');

    act(() => {
      screen.getByTestId('switch-es').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('translation').textContent).toBe('Cargando...');
  });

  it('persists locale choice to localStorage when switching', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-en').click();
    });

    expect(localStorage.getItem('paisaxe-locale')).toBe('en');
  });

  it('detects browser language on mount when no initialLocale', () => {
    Object.defineProperty(navigator, 'languages', {
      value: ['en-US'],
      configurable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });

    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('uses stored locale over browser language', () => {
    localStorage.setItem('paisaxe-locale', 'es');
    Object.defineProperty(navigator, 'languages', {
      value: ['en-US'],
      configurable: true,
    });

    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  // Lazy-loaded locale tests — these locales load asynchronously
  it('renders with locale "fr" after lazy load', async () => {
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('fr');
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
    });
  });

  it('renders with locale "de" after lazy load', async () => {
    render(
      <LanguageProvider initialLocale="de">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('de');
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Laden...');
    });
  });

  it('renders with locale "pt" after lazy load', async () => {
    render(
      <LanguageProvider initialLocale="pt">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('pt');
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Carregando...');
    });
  });

  it('switches locale from es to fr (lazy load)', async () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-fr').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('fr');
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
    });
  });

  it('switches locale from es to de (lazy load)', async () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-de').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('de');
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Laden...');
    });
  });

  it('switches locale from es to pt (lazy load)', async () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-pt').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('pt');
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Carregando...');
    });
  });

  it('resolves chat placeholder in French (lazy load)', async () => {
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-placeholder').textContent).toBe('Posez une question sur ce lieu...');
    });
  });

  it('resolves chat placeholder in German (lazy load)', async () => {
    render(
      <LanguageProvider initialLocale="de">
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-placeholder').textContent).toBe('Fragen Sie nach diesem Ort...');
    });
  });

  it('resolves chat placeholder in Portuguese (lazy load)', async () => {
    render(
      <LanguageProvider initialLocale="pt">
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-placeholder').textContent).toBe('Pergunte sobre este lugar...');
    });
  });
});

describe('useTranslation', () => {
  it('throws when used outside LanguageProvider', () => {
    // Suppress React error output during this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useTranslation must be used within a LanguageProvider');

    spy.mockRestore();
  });
});

// Helper that reads context directly (no hook dependency)
function LocaleDisplay() {
  const ctx = useContext(LanguageContext);
  return <span data-testid="ctx-locale">{ctx?.locale ?? 'NO_CONTEXT'}</span>;
}

describe('LanguageProvider render-blocking fix', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    _resetTranslationCacheForTesting();
  });

  it('renders children immediately without null flash when no initialLocale', () => {
    Object.defineProperty(navigator, 'languages', {
      value: ['es'],
      configurable: true,
    });

    const { container } = render(
      <LanguageProvider>
        <LocaleDisplay />
      </LanguageProvider>
    );

    expect(container.innerHTML).not.toBe('');
    expect(screen.getByTestId('ctx-locale').textContent).toBe('es');
  });

  it('renders with stored locale immediately (no flash)', () => {
    localStorage.setItem('paisaxe-locale', 'en');

    render(
      <LanguageProvider>
        <LocaleDisplay />
      </LanguageProvider>
    );

    expect(screen.getByTestId('ctx-locale').textContent).toBe('en');
  });

  it('renders with detected browser language immediately (no flash)', () => {
    Object.defineProperty(navigator, 'languages', {
      value: ['fr-FR', 'en-US'],
      configurable: true,
    });

    render(
      <LanguageProvider>
        <LocaleDisplay />
      </LanguageProvider>
    );

    expect(screen.getByTestId('ctx-locale').textContent).toBe('fr');
  });

  it('defaults to es when no stored pref and unsupported browser language', () => {
    Object.defineProperty(navigator, 'languages', {
      value: ['zh-CN', 'ja'],
      configurable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: 'zh-CN',
      configurable: true,
    });

    render(
      <LanguageProvider>
        <LocaleDisplay />
      </LanguageProvider>
    );

    expect(screen.getByTestId('ctx-locale').textContent).toBe('es');
  });

  it('uses initialLocale prop without running detection', () => {
    Object.defineProperty(navigator, 'languages', {
      value: ['fr-FR'],
      configurable: true,
    });

    render(
      <LanguageProvider initialLocale="de">
        <LocaleDisplay />
      </LanguageProvider>
    );

    expect(screen.getByTestId('ctx-locale').textContent).toBe('de');
  });
});

describe('Lazy translation loading', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    _resetTranslationCacheForTesting();
  });

  it('falls back to Spanish translations while lazy locale is loading', () => {
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    // Locale is set immediately, but translations fall back to es until loaded
    expect(screen.getByTestId('locale').textContent).toBe('fr');
    // On first render, French translations aren't cached yet — falls back to Spanish
    expect(screen.getByTestId('translation').textContent).toBe('Cargando...');
  });

  it('loads French translations asynchronously and re-renders', async () => {
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    // After async load, French translations appear
    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
    });
  });

  it('caches loaded translations — no re-import on subsequent mounts', async () => {
    // First mount: loads French
    const { unmount } = render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
    });

    unmount();

    // Second mount: French is already cached, should be immediate
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    // Should be French immediately (cached)
    expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
  });

  it('es and en are always available without async loading', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    // Spanish is always available — no fallback needed
    expect(screen.getByTestId('translation').textContent).toBe('Cargando...');
  });
});
