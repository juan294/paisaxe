import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPage from './page';

const mockT = vi.fn((key: string) => key);
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: mockT, locale: 'en', setLocale: vi.fn() }),
}));

describe('PrivacyPage', () => {
  beforeEach(() => {
    mockT.mockImplementation((key: string) => key);
  });

  it('renders the page heading', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('privacy.title');
  });

  it('renders the last updated date', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('privacy.last_updated')).toBeInTheDocument();
  });

  it('renders all 9 sections', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('privacy.section1_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section2_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section3_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section4_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section5_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section6_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section7_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section8_title')).toBeInTheDocument();
    expect(screen.getByText('privacy.section9_title')).toBeInTheDocument();
  });

  it('renders third-party service names', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('Supabase')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument();
    expect(screen.getByText('ElevenLabs')).toBeInTheDocument();
    expect(screen.getByText('Twilio')).toBeInTheDocument();
  });

  it('has a contact email link', () => {
    render(<PrivacyPage />);
    const link = screen.getByRole('link', { name: /support@paisaxe.es/ });
    expect(link).toHaveAttribute('href', 'mailto:support@paisaxe.es');
  });

  it('renders in a semantic main structure', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('uses the immersive dark background', () => {
    const { container } = render(<PrivacyPage />);
    const outerDiv = container.firstElementChild;
    expect(outerDiv?.className).toContain('bg-neutral-950');
  });

  it('renders a back navigation link to /immersive', () => {
    render(<PrivacyPage />);
    const backLink = screen.getByLabelText('privacy.back');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/immersive');
  });

  it('renders footer links to terms and about pages', () => {
    render(<PrivacyPage />);
    const termsLink = screen.getByText('privacy.footer_terms');
    expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
    const aboutLink = screen.getByText('privacy.footer_about');
    expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
  });
});
