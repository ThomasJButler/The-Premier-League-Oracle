import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 }),
}));

// Mock lucide-svelte (needed by SidebarNav which renders inside the aside)
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
    Search: stub, Layers: stub, Calendar: stub, CalendarCheck: stub, Zap: stub,
  };
});

// Mock shadcn Separator (used by SidebarNav)
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

// Mock Sheet — stubs that don't render children (mobile Sheet path tested via E2E)
vi.mock('$lib/components/ui/sheet', () => {
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
  return { Root: stub, Content: stub, Sheet: stub, SheetContent: stub };
});

describe('Sidebar', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
  });

  it('renders aside element on desktop', () => {
    const { container } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: true } });
    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('aside has translate-x-0 when isOpen is true', () => {
    const { container } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: true } });
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('translate-x-0');
  });

  it('aside has -translate-x-full when isOpen is false', () => {
    const { container } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: false } });
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('-translate-x-full');
  });

  it('renders SidebarNav inside the aside with correct currentView', () => {
    render(Sidebar, { props: { currentView: 'Predictions', isOpen: true } });
    // SidebarNav renders nav items — the active one gets aria-current
    expect(screen.getByTitle('Predictions')).toHaveAttribute('aria-current', 'page');
  });

  it('dispatches navigate event when a nav item is clicked', async () => {
    const { component } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: true } });
    const handler = vi.fn();
    component.$on('navigate', handler);

    await fireEvent.click(screen.getByTitle('Standings'));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { view: 'Standings' } }),
    );
  });

  it('dispatches closeSidebar on mobile after navigation', async () => {
    // Set mobile viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    window.dispatchEvent(new Event('resize'));

    const { component } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: true } });
    const handler = vi.fn();
    component.$on('closeSidebar', handler);

    // Click a nav item in the aside — handleNavClick calls closeSidebar() when isMobile
    await fireEvent.click(screen.getByTitle('Predictions'));
    expect(handler).toHaveBeenCalled();
  });

  it('does not dispatch closeSidebar on desktop after navigation', async () => {
    const { component } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: true } });
    const handler = vi.fn();
    component.$on('closeSidebar', handler);

    await fireEvent.click(screen.getByTitle('Predictions'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up resize listener on destroy', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(Sidebar, { props: { currentView: 'Dashboard', isOpen: true } });

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
