import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n';
import TermsPage from './page';

// TermsPage is a client component (UX-H3): it uses useTranslation() so its
// content follows the visitor's selected locale instead of hardcoded Spanish.
// Render through LanguageProvider with real translation data so assertions
// verify actual rendered text, not just that a translation function was called.
function renderWithLocale(locale: 'es' | 'en') {
  return render(
    <LanguageProvider initialLocale={locale}>
      <TermsPage />
    </LanguageProvider>
  );
}

describe('TermsPage', () => {
  it('renders the page heading in Spanish by default', () => {
    renderWithLocale('es');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Términos de Servicio');
  });

  it('renders the last updated date in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('Última actualización: 5 de febrero de 2026')).toBeInTheDocument();
  });

  it('renders all 10 sections in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('1. Descripción del servicio')).toBeInTheDocument();
    expect(screen.getByText('2. Uso del servicio')).toBeInTheDocument();
    expect(screen.getByText('3. VoicePass y pagos')).toBeInTheDocument();
    expect(screen.getByText('4. Contenido generado por IA')).toBeInTheDocument();
    expect(screen.getByText('5. Reservas')).toBeInTheDocument();
    expect(screen.getByText('6. Propiedad intelectual')).toBeInTheDocument();
    expect(screen.getByText('7. Limitación de responsabilidad')).toBeInTheDocument();
    expect(screen.getByText('8. Modificaciones')).toBeInTheDocument();
    expect(screen.getByText('9. Legislación aplicable')).toBeInTheDocument();
    expect(screen.getByText('10. Contacto')).toBeInTheDocument();
  });

  it('renders the VoicePass pricing description in Spanish', () => {
    renderWithLocale('es');
    expect(
      screen.getByText(/El VoicePass de 24 horas cuesta 1,99/)
    ).toBeInTheDocument();
  });

  it('has a contact email link', () => {
    renderWithLocale('es');
    const link = screen.getByRole('link', { name: /support@paisaxe.es/ });
    expect(link).toHaveAttribute('href', 'mailto:support@paisaxe.es');
  });

  it('renders in a semantic main structure', () => {
    renderWithLocale('es');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('uses the immersive dark background', () => {
    const { container } = renderWithLocale('es');
    const outerDiv = container.firstElementChild;
    expect(outerDiv?.className).toContain('bg-neutral-950');
  });

  it('renders a back navigation link to /immersive', () => {
    renderWithLocale('es');
    const backLink = screen.getByLabelText('Volver');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/immersive');
  });

  it('renders footer links to privacy and about pages', () => {
    renderWithLocale('es');
    const privacyLink = screen.getByText('Privacidad');
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
    const aboutLink = screen.getByText('Sobre Paisaxe');
    expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
  });

  // UX-H3 regression coverage: the page must respect the visitor's selected
  // language instead of always rendering Spanish (legally load-bearing content).
  describe('UX-H3: respects the visitor selected locale', () => {
    it('renders English content, not Spanish, when locale is "en"', () => {
      renderWithLocale('en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms of Service');
      expect(screen.getByText('1. Service description')).toBeInTheDocument();
      expect(screen.getByText('3. VoicePass and payments')).toBeInTheDocument();
      expect(screen.getByText(/The 24-hour VoicePass costs/)).toBeInTheDocument();
      expect(screen.getByText('10. Contact')).toBeInTheDocument();

      expect(screen.queryByText('Términos de Servicio')).not.toBeInTheDocument();
      expect(screen.queryByText('1. Descripción del servicio')).not.toBeInTheDocument();
    });

    it('translates the back-link aria-label and footer links when locale is "en"', () => {
      renderWithLocale('en');
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
      const privacyLink = screen.getByText('Privacy');
      expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
      const aboutLink = screen.getByText('About Paisaxe');
      expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
    });
  });
});
