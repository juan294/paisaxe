import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { LanguageProvider, LanguageContext } from './provider';
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

  it('renders with locale "fr" when initialLocale is "fr"', () => {
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('fr');
    expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
  });

  it('renders with locale "de" when initialLocale is "de"', () => {
    render(
      <LanguageProvider initialLocale="de">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('de');
    expect(screen.getByTestId('translation').textContent).toBe('Laden...');
  });

  it('renders with locale "pt" when initialLocale is "pt"', () => {
    render(
      <LanguageProvider initialLocale="pt">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('pt');
    expect(screen.getByTestId('translation').textContent).toBe('Carregando...');
  });

  it('switches locale from es to fr', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-fr').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('fr');
    expect(screen.getByTestId('translation').textContent).toBe('Chargement...');
  });

  it('switches locale from es to de', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-de').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('de');
    expect(screen.getByTestId('translation').textContent).toBe('Laden...');
  });

  it('switches locale from es to pt', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );

    act(() => {
      screen.getByTestId('switch-pt').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('pt');
    expect(screen.getByTestId('translation').textContent).toBe('Carregando...');
  });

  it('resolves chat placeholder in French', () => {
    render(
      <LanguageProvider initialLocale="fr">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('chat-placeholder').textContent).toBe('Posez une question sur ce lieu...');
  });

  it('resolves chat placeholder in German', () => {
    render(
      <LanguageProvider initialLocale="de">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('chat-placeholder').textContent).toBe('Fragen Sie nach diesem Ort...');
  });

  it('resolves chat placeholder in Portuguese', () => {
    render(
      <LanguageProvider initialLocale="pt">
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('chat-placeholder').textContent).toBe('Pergunte sobre este lugar...');
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
  });

  it('renders children immediately without null flash when no initialLocale', () => {
    // With no initialLocale and no stored pref, should still render children
    // on the first render (no useEffect delay, no return null)
    Object.defineProperty(navigator, 'languages', {
      value: ['es'],
      configurable: true,
    });

    const { container } = render(
      <LanguageProvider>
        <LocaleDisplay />
      </LanguageProvider>
    );

    // Children must be present on first render (not null)
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

    // Should use 'en' from localStorage on first render
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

    // Should detect 'fr' from navigator.languages on first render
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
    // Even if browser is 'fr', initialLocale='de' should win
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
