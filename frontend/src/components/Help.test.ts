import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/svelte';
import Help from './Help.svelte';

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 }),
}));

// Mock lucide-svelte
vi.mock('lucide-svelte', () => {
  const stub = class {
    $$: any;
    constructor(opts: any) {
      this.$$ = {
        fragment: { c() {}, m() {}, p() {}, d() {}, l() {}, i() {}, o() {} },
        ctx: [], props: {}, update: () => {}, not_equal: () => false,
        bound: Object.create(null), on_mount: [], on_destroy: [], on_disconnect: [],
        before_update: [], after_update: [], context: new Map(),
        callbacks: Object.create(null), dirty: [-1], skip_bound: false,
        root: opts?.target || document.createElement('div'),
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return {
    Book: stub, HelpCircle: stub, TrendingUp: stub, Shield: stub,
    Zap: stub, ExternalLink: stub, ChevronRight: stub, Home: stub,
  };
});

describe('Help', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    render(Help);
    expect(screen.getByText('Help & Documentation')).toBeInTheDocument();
  });

  it('shows Getting Started section by default', () => {
    render(Help);
    // "Getting Started" appears in both the nav button and the section h2
    expect(screen.getAllByText('Getting Started').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Quick Setup Guide')).toBeInTheDocument();
  });

  it('renders all 6 navigation items', () => {
    render(Help);
    // "Getting Started" appears in nav and h2 — use getAllByText
    expect(screen.getAllByText('Getting Started').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Understanding Predictions')).toBeInTheDocument();
    expect(screen.getByText('Maximizing Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Features Guide')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('switches to Predictions section when clicked', async () => {
    render(Help);
    const predButton = screen.getAllByText('Understanding Predictions')[0];
    await fireEvent.click(predButton);
    await act();
    expect(screen.getByText('Our Five-Component Ensemble')).toBeInTheDocument();
  });

  it('switches to FAQ section when clicked', async () => {
    render(Help);
    const faqButton = screen.getAllByText('FAQ')[0];
    await fireEvent.click(faqButton);
    await act();
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('How accurate are the predictions?')).toBeInTheDocument();
  });

  it('switches to Privacy & Security section', async () => {
    render(Help);
    const secButton = screen.getAllByText('Privacy & Security')[0];
    await fireEvent.click(secButton);
    await act();
    // The h3 text includes an emoji prefix: "🔒 Your Data is Safe"
    expect(screen.getByText('🔒 Your Data is Safe')).toBeInTheDocument();
  });

  it('switches to Features Guide section', async () => {
    render(Help);
    const featButton = screen.getAllByText('Features Guide')[0];
    await fireEvent.click(featButton);
    await act();
    // Should show feature cards
    expect(screen.queryAllByText(/Dashboard/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Kelly Calculator/).length).toBeGreaterThan(0);
  });

  it('switches to Maximizing Accuracy section', async () => {
    render(Help);
    const maxButton = screen.getAllByText('Maximizing Accuracy')[0];
    await fireEvent.click(maxButton);
    await act();
    // The h3 text includes an emoji prefix: "🎯 The Golden Rules"
    expect(screen.getByText('🎯 The Golden Rules')).toBeInTheDocument();
    expect(screen.getByText('Kelly Criterion Calculator')).toBeInTheDocument();
  });

  it('shows active section with aria-current', () => {
    render(Help);
    // Getting Started should be active by default
    const gettingStartedButton = screen.getAllByText('Getting Started')[0];
    expect(gettingStartedButton).toHaveAttribute('aria-current', 'true');
  });

  it('updates aria-current when switching sections', async () => {
    render(Help);
    const faqButton = screen.getAllByText('FAQ')[0];
    await fireEvent.click(faqButton);
    await act();
    expect(faqButton).toHaveAttribute('aria-current', 'true');
    // Previous section should no longer have aria-current
    const gettingStartedButton = screen.getAllByText('Getting Started')[0];
    expect(gettingStartedButton).not.toHaveAttribute('aria-current');
  });

  it('contains external link to Football-Data.org', () => {
    render(Help);
    // The link wraps text and an icon component — use getByRole for reliable matching
    const link = screen.getByRole('link', { name: /Get Your API Key/i });
    expect(link).toHaveAttribute('href', 'https://www.football-data.org/client/register');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('mobile menu toggle has correct aria attributes', () => {
    render(Help);
    const toggleButton = screen.getByLabelText('Toggle documentation menu');
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButton).toHaveAttribute('aria-controls', 'help-nav');
  });

  it('shows ensemble model weights in Predictions section', async () => {
    render(Help);
    const predButton = screen.getAllByText('Understanding Predictions')[0];
    await fireEvent.click(predButton);
    await act();
    expect(screen.getByText('25%')).toBeInTheDocument(); // ELO
    expect(screen.getByText('30%')).toBeInTheDocument(); // Poisson
    expect(screen.getByText('20%')).toBeInTheDocument(); // Form
    expect(screen.getByText('10%')).toBeInTheDocument(); // H2H
    expect(screen.getByText('15%')).toBeInTheDocument(); // Standings
  });
});
