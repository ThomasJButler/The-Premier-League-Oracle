import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SidebarNav from './SidebarNav.svelte';

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
    LayoutDashboard: stub, List: stub, BarChart2: stub, BarChart3: stub,
    History: stub, Settings: stub, Calculator: stub, HelpCircle: stub,
    Trophy: stub, Tv: stub, Table: stub, X: stub, MessageCircle: stub,
    Search: stub, Layers: stub, Calendar: stub,
  };
});

// Mock shadcn Separator
vi.mock('$lib/components/ui/separator', () => {
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
  return { Separator: stub };
});

describe('SidebarNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders header branding', () => {
    render(SidebarNav, { props: { currentView: 'Dashboard' } });
    expect(screen.getByText('Premier League')).toBeInTheDocument();
    expect(screen.getByText('Oracle')).toBeInTheDocument();
  });

  it('renders all 9 main navigation items', () => {
    render(SidebarNav, { props: { currentView: 'Dashboard' } });
    const mainItems = [
      'Dashboard', 'Standings', 'Live Matches', 'Matches', 'Predictions',
      'Oracle Chat', 'Top Scorers', 'Season Stats', 'Season Timeline',
    ];
    for (const name of mainItems) {
      expect(screen.getByTitle(name)).toBeInTheDocument();
    }
  });

  it('renders all 4 betting navigation items', () => {
    render(SidebarNav, { props: { currentView: 'Dashboard' } });
    const bettingItems = ['Kelly Calculator', 'Value Bets', 'Accumulators', 'Betting History'];
    for (const name of bettingItems) {
      expect(screen.getByTitle(name)).toBeInTheDocument();
    }
  });

  it('renders 2 bottom navigation items', () => {
    render(SidebarNav, { props: { currentView: 'Dashboard' } });
    expect(screen.getByTitle('Help')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('marks active item with aria-current="page"', () => {
    render(SidebarNav, { props: { currentView: 'Predictions' } });
    expect(screen.getByTitle('Predictions')).toHaveAttribute('aria-current', 'page');
  });

  it('does not set aria-current on inactive items', () => {
    render(SidebarNav, { props: { currentView: 'Predictions' } });
    expect(screen.getByTitle('Dashboard')).not.toHaveAttribute('aria-current');
  });

  it('dispatches navigate event with correct view on click', async () => {
    const { component } = render(SidebarNav, { props: { currentView: 'Dashboard' } });
    const handler = vi.fn();
    component.$on('navigate', handler);

    await fireEvent.click(screen.getByTitle('Predictions'));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { view: 'Predictions' } }),
    );
  });

  it('hides close button by default', () => {
    render(SidebarNav, { props: { currentView: 'Dashboard' } });
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
  });

  it('shows close button when showCloseButton is true', () => {
    render(SidebarNav, { props: { currentView: 'Dashboard', showCloseButton: true } });
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('dispatches close event when close button is clicked', async () => {
    const { component } = render(SidebarNav, { props: { currentView: 'Dashboard', showCloseButton: true } });
    const handler = vi.fn();
    component.$on('close', handler);

    await fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(handler).toHaveBeenCalled();
  });
});
