import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n';
import AboutPage from './page';

// AboutPage is a client component (UX-H3): it uses useTranslation() so its
// content follows the visitor's selected locale instead of hardcoded Spanish.
// Render through LanguageProvider with real translation data so assertions
// verify actual rendered text, not just that a translation function was called.
function renderWithLocale(locale: 'es' | 'en') {
  return render(
    <LanguageProvider initialLocale={locale}>
      <AboutPage />
    </LanguageProvider>
  );
}

describe('AboutPage', () => {
  it('renders the page heading in Spanish by default', () => {
    renderWithLocale('es');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acerca de Paisaxe');
  });

  it('renders the tagline in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('Mira. Pregunta. Descubre.')).toBeInTheDocument();
  });

  it('renders the what section in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('Qué es Paisaxe')).toBeInTheDocument();
  });

  it('renders the vision section in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('La visión')).toBeInTheDocument();
  });

  it('renders the content source section in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('El contenido')).toBeInTheDocument();
  });

  it('renders the AI transparency section in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('Inteligencia artificial')).toBeInTheDocument();
  });

  it('renders the contact section in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('Contacto')).toBeInTheDocument();
  });

  it('renders a back link to /immersive', () => {
    renderWithLocale('es');
    const backLink = screen.getByLabelText('Volver');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/immersive');
  });

  it('uses semantic HTML with proper heading hierarchy', () => {
    renderWithLocale('es');
    const h1 = screen.getAllByRole('heading', { level: 1 });
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h1).toHaveLength(1);
    expect(h2.length).toBeGreaterThanOrEqual(4);
  });

  it('has a main landmark', () => {
    renderWithLocale('es');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders the contact email link', () => {
    renderWithLocale('es');
    const emailLink = screen.getByRole('link', { name: /support@paisaxe.es/ });
    expect(emailLink).toHaveAttribute('href', 'mailto:support@paisaxe.es');
  });

  // UX-H3 regression coverage: the page must respect the visitor's selected
  // language instead of always rendering Spanish.
  describe('UX-H3: respects the visitor selected locale', () => {
    it('renders English content, not Spanish, when locale is "en"', () => {
      renderWithLocale('en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Paisaxe');
      expect(screen.getByText('Look. Ask. Discover.')).toBeInTheDocument();
      expect(screen.getByText('What is Paisaxe')).toBeInTheDocument();
      expect(screen.getByText('The vision')).toBeInTheDocument();
      expect(screen.getByText('Artificial intelligence')).toBeInTheDocument();
      expect(screen.getByText('Contact')).toBeInTheDocument();

      expect(screen.queryByText('Acerca de Paisaxe')).not.toBeInTheDocument();
      expect(screen.queryByText('Mira. Pregunta. Descubre.')).not.toBeInTheDocument();
    });

    it('translates the back-link aria-label when locale is "en"', () => {
      renderWithLocale('en');
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
    });
  });
});
