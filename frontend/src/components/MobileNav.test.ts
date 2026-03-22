import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MobileNav from './MobileNav.svelte';

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
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
    LayoutDashboard: stub, Tv: stub, BarChart3: stub, Table: stub,
    MoreHorizontal: stub, List: stub, Calculator: stub, History: stub,
    Trophy: stub, HelpCircle: stub, Settings: stub, BarChart2: stub,
    X: stub, MessageCircle: stub, Search: stub, Layers: stub, Calendar: stub,
    Zap: stub,
  };
});

// Mock focusTrap as a no-op Svelte action
vi.mock('$lib/utils', () => ({
  focusTrap: () => ({ update: vi.fn(), destroy: vi.fn() }),
  cn: (...inputs: any[]) => inputs.join(' '),
}));

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders 4 primary navigation items', () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Predictions')).toBeInTheDocument();
    expect(screen.getByText('Standings')).toBeInTheDocument();
  });

  it('renders More button with correct aria-label', () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();
  });

  it('More button has aria-expanded=false by default', () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    const moreBtn = screen.getByRole('button', { name: 'More options' });
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking More opens the overlay with all secondary items', async () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    await fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    const secondaryItems = [
      'Matches', 'Oracle Chat', 'Top Scorers', 'Kelly Calculator',
      'Suggested Bets', 'Value Scanner', 'Accumulators', 'Season Stats',
      'Timeline', 'Betting History', 'Settings', 'Help',
    ];
    for (const name of secondaryItems) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('dispatches navigate event when primary item is clicked', async () => {
    const { component } = render(MobileNav, { props: { currentView: 'Dashboard' } });
    const handler = vi.fn();
    component.$on('navigate', handler);

    await fireEvent.click(screen.getByText('Predictions'));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { view: 'Predictions' } }),
    );
  });

  it('dispatches navigate and closes menu when more item is clicked', async () => {
    const { component } = render(MobileNav, { props: { currentView: 'Dashboard' } });
    const handler = vi.fn();
    component.$on('navigate', handler);

    // Open then click a secondary item
    await fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    await fireEvent.click(screen.getByText('Top Scorers'));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { view: 'Top Scorers' } }),
    );
    // Menu should be closed — secondary items no longer in DOM
    expect(screen.queryByText('Kelly Calculator')).not.toBeInTheDocument();
  });

  it('Escape key closes the More menu', async () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    await fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByText('Matches')).toBeInTheDocument();

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Matches')).not.toBeInTheDocument();
  });

  it('clicking overlay backdrop closes the More menu', async () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    await fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByText('Matches')).toBeInTheDocument();

    // The backdrop overlay has aria-label="Close menu"
    await fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByText('Matches')).not.toBeInTheDocument();
  });

  it('highlights More button when currentView is a secondary item', () => {
    render(MobileNav, { props: { currentView: 'Settings' } });
    const moreBtn = screen.getByRole('button', { name: 'More options' });
    expect(moreBtn.className).toContain('mobile-nav-item-active');
  });

  it('close button inside overlay dismisses the menu', async () => {
    render(MobileNav, { props: { currentView: 'Dashboard' } });
    await fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByText('Matches')).toBeInTheDocument();

    // The X button inside the overlay panel has aria-label="Close"
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Matches')).not.toBeInTheDocument();
  });
});
