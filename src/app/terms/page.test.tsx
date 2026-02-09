import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsPage from './page';

const mockT = vi.fn((key: string) => key);
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: mockT, locale: 'en', setLocale: vi.fn() }),
}));

describe('TermsPage', () => {
  beforeEach(() => {
    mockT.mockImplementation((key: string) => key);
  });

  it('renders the page heading', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('terms.title');
  });

  it('renders the last updated date', () => {
    render(<TermsPage />);
    expect(screen.getByText('terms.last_updated')).toBeInTheDocument();
  });

  it('renders all 10 sections', () => {
    render(<TermsPage />);
    expect(screen.getByText('terms.section1_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section2_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section3_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section4_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section5_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section6_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section7_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section8_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section9_title')).toBeInTheDocument();
    expect(screen.getByText('terms.section10_title')).toBeInTheDocument();
  });

  it('renders the VoicePass pricing key', () => {
    render(<TermsPage />);
    expect(screen.getByText('terms.pricing_description')).toBeInTheDocument();
  });

  it('has a contact email link', () => {
    render(<TermsPage />);
    const link = screen.getByRole('link', { name: /support@paisaxe.es/ });
    expect(link).toHaveAttribute('href', 'mailto:support@paisaxe.es');
  });

  it('renders in a semantic main structure', () => {
    render(<TermsPage />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('uses the immersive dark background', () => {
    const { container } = render(<TermsPage />);
    const outerDiv = container.firstElementChild;
    expect(outerDiv?.className).toContain('bg-neutral-950');
  });

  it('renders a back navigation link to /immersive', () => {
    render(<TermsPage />);
    const backLink = screen.getByLabelText('terms.back');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/immersive');
  });

  it('renders footer links to privacy and about pages', () => {
    render(<TermsPage />);
    const privacyLink = screen.getByText('terms.footer_privacy');
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
    const aboutLink = screen.getByText('terms.footer_about');
    expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
  });
});
