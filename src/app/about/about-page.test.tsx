import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from './page';

// AboutPage is a server component — no "use client", no hooks, no LanguageProvider needed.
// Mock the i18n modules so the page resolves translation keys as themselves (fast test setup).
vi.mock('@/lib/i18n/es', () => ({ es: {} }));
vi.mock('@/lib/i18n/resolve', () => ({
  resolveTranslation: (_key: string, _translations: unknown) => _key,
}));

describe('AboutPage', () => {
  it('renders the page heading', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('about.title');
  });

  it('renders the tagline', () => {
    render(<AboutPage />);
    expect(screen.getByText('about.tagline')).toBeInTheDocument();
  });

  it('renders the what section', () => {
    render(<AboutPage />);
    expect(screen.getByText('about.what_title')).toBeInTheDocument();
    expect(screen.getByText('about.what_description')).toBeInTheDocument();
  });

  it('renders the vision section', () => {
    render(<AboutPage />);
    expect(screen.getByText('about.vision_title')).toBeInTheDocument();
    expect(screen.getByText('about.vision_description')).toBeInTheDocument();
  });

  it('renders the content source section', () => {
    render(<AboutPage />);
    expect(screen.getByText('about.content_title')).toBeInTheDocument();
    expect(screen.getByText('about.content_description')).toBeInTheDocument();
  });

  it('renders the AI transparency section', () => {
    render(<AboutPage />);
    expect(screen.getByText('about.ai_title')).toBeInTheDocument();
    expect(screen.getByText('about.ai_description')).toBeInTheDocument();
  });

  it('renders the contact section', () => {
    render(<AboutPage />);
    expect(screen.getByText('about.contact_title')).toBeInTheDocument();
  });

  it('renders a back link to /immersive', () => {
    render(<AboutPage />);
    const backLink = screen.getByLabelText('about.back');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/immersive');
  });

  it('uses semantic HTML with proper heading hierarchy', () => {
    render(<AboutPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h1).toHaveLength(1);
    expect(h2.length).toBeGreaterThanOrEqual(4);
  });

  it('has a main landmark', () => {
    render(<AboutPage />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders the contact email link', () => {
    render(<AboutPage />);
    const emailLink = screen.getByRole('link', { name: /support@paisaxe.es/ });
    expect(emailLink).toHaveAttribute('href', 'mailto:support@paisaxe.es');
  });
});
