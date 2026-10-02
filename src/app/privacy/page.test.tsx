import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n';
import PrivacyPage from './page';

// PrivacyPage is a client component (UX-H3): it uses useTranslation() so its
// content follows the visitor's selected locale instead of hardcoded Spanish.
// Render through LanguageProvider with real translation data so assertions
// verify actual rendered text, not just that a translation function was called.
function renderWithLocale(locale: 'es' | 'en') {
  return render(
    <LanguageProvider initialLocale={locale}>
      <PrivacyPage />
    </LanguageProvider>
  );
}

describe('PrivacyPage', () => {
  it('renders the page heading in Spanish by default', () => {
    renderWithLocale('es');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Política de Privacidad');
  });

  it('renders the last updated date in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('Última actualización: 5 de febrero de 2026')).toBeInTheDocument();
  });

  it('renders all 9 sections in Spanish', () => {
    renderWithLocale('es');
    expect(screen.getByText('1. Información que recopilamos')).toBeInTheDocument();
    expect(screen.getByText('2. Cómo usamos tu información')).toBeInTheDocument();
    expect(screen.getByText('3. Servicios de terceros')).toBeInTheDocument();
    expect(screen.getByText('4. Cookies')).toBeInTheDocument();
    expect(screen.getByText('5. Retención de datos')).toBeInTheDocument();
    expect(screen.getByText('6. Tus derechos')).toBeInTheDocument();
    expect(screen.getByText('7. Seguridad')).toBeInTheDocument();
    expect(screen.getByText('8. Cambios a esta política')).toBeInTheDocument();
    expect(screen.getByText('9. Contacto')).toBeInTheDocument();
  });

  it('renders third-party service names', () => {
    renderWithLocale('es');
    expect(screen.getByText('Supabase')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument();
    expect(screen.getByText('ElevenLabs')).toBeInTheDocument();
    expect(screen.getByText('Twilio')).toBeInTheDocument();
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

  it('renders footer links to terms and about pages', () => {
    renderWithLocale('es');
    const termsLink = screen.getByText('Términos de servicio');
    expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
    const aboutLink = screen.getByText('Sobre Paisaxe');
    expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
  });

  // UX-H3 regression coverage: the page must respect the visitor's selected
  // language instead of always rendering Spanish (legally load-bearing content).
  describe('UX-H3: respects the visitor selected locale', () => {
    it('renders English content, not Spanish, when locale is "en"', () => {
      renderWithLocale('en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy Policy');
      expect(screen.getByText('1. Information we collect')).toBeInTheDocument();
      expect(screen.getByText('6. Your rights')).toBeInTheDocument();
      expect(screen.getByText('9. Contact')).toBeInTheDocument();

      expect(screen.queryByText('Política de Privacidad')).not.toBeInTheDocument();
      expect(screen.queryByText('1. Información que recopilamos')).not.toBeInTheDocument();
    });

    it('translates the back-link aria-label and footer links when locale is "en"', () => {
      renderWithLocale('en');
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
      const termsLink = screen.getByText('Terms of Service');
      expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
      const aboutLink = screen.getByText('About Paisaxe');
      expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
    });
  });
});
