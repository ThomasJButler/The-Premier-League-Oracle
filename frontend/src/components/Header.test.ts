import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Header from './Header.svelte';

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
  return { Sun: stub, Moon: stub, Github: stub, Menu: stub };
});

// Mock theme store — isDarkMode needs subscribe (for $isDarkMode) and toggle (called directly).
// vi.hoisted runs before vi.mock hoisting, making mockToggle available in the factory.
const { mockToggle } = vi.hoisted(() => ({ mockToggle: vi.fn() }));
vi.mock('../stores/theme', () => ({
  isDarkMode: {
    subscribe: (fn: (v: boolean) => void) => {
      fn(true);
      return () => {};
    },
    toggle: mockToggle,
  },
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders The Oracle heading', () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: false } });
    expect(screen.getByText('The Oracle')).toBeInTheDocument();
  });

  it('menu toggle button has correct aria-label', () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: false } });
    expect(screen.getByRole('button', { name: 'Toggle menu' })).toBeInTheDocument();
  });

  it('menu toggle reflects aria-expanded when sidebar is open', () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: true } });
    const menuBtn = screen.getByRole('button', { name: 'Toggle menu' });
    expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('menu toggle reflects aria-expanded when sidebar is closed', () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: false } });
    const menuBtn = screen.getByRole('button', { name: 'Toggle menu' });
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking menu toggle calls toggleSidebar prop', async () => {
    const mockToggleSidebar = vi.fn();
    render(Header, { props: { toggleSidebar: mockToggleSidebar, isSidebarOpen: false } });
    await fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(mockToggleSidebar).toHaveBeenCalledOnce();
  });

  it('dark mode toggle has correct aria-label', () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: false } });
    expect(screen.getByRole('button', { name: 'Toggle dark mode' })).toBeInTheDocument();
  });

  it('clicking dark mode toggle calls isDarkMode.toggle', async () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: false } });
    await fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }));
    expect(mockToggle).toHaveBeenCalledOnce();
  });

  it('GitHub link has correct href, target, and aria-label', () => {
    render(Header, { props: { toggleSidebar: vi.fn(), isSidebarOpen: false } });
    const link = screen.getByRole('link', { name: 'GitHub Repository' });
    expect(link).toHaveAttribute('href', 'https://github.com/ThomasJButler/The-Premier-League-Oracle');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
