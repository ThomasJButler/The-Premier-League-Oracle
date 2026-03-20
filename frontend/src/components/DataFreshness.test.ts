import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import DataFreshness from './DataFreshness.svelte';

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
  return { Clock: stub };
});

describe('DataFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when timestamp is null', () => {
    const { container } = render(DataFreshness, { props: { timestamp: null } });
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows "just now" for timestamps under 10 seconds ago', () => {
    const fiveSecondsAgo = Date.now() - 5_000;
    render(DataFreshness, { props: { timestamp: fiveSecondsAgo } });
    expect(screen.getByText(/Updated just now/)).toBeTruthy();
  });

  it('shows seconds for timestamps 10-59 seconds ago', () => {
    const thirtySecondsAgo = Date.now() - 30_000;
    render(DataFreshness, { props: { timestamp: thirtySecondsAgo } });
    expect(screen.getByText(/Updated 30s ago/)).toBeTruthy();
  });

  it('shows minutes for timestamps 1-59 minutes ago', () => {
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    render(DataFreshness, { props: { timestamp: threeMinutesAgo } });
    expect(screen.getByText(/Updated 3m ago/)).toBeTruthy();
  });

  it('shows hours for timestamps 1-23 hours ago', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    render(DataFreshness, { props: { timestamp: twoHoursAgo } });
    expect(screen.getByText(/Updated 2h ago/)).toBeTruthy();
  });

  it('shows days for timestamps 24+ hours ago', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    render(DataFreshness, { props: { timestamp: threeDaysAgo } });
    expect(screen.getByText(/Updated 3d ago/)).toBeTruthy();
  });

  it('has accessibility title attribute', () => {
    const now = Date.now();
    render(DataFreshness, { props: { timestamp: now } });
    const element = screen.getByTitle('Data freshness');
    expect(element).toBeTruthy();
  });

  it('auto-updates display over time', async () => {
    const timestamp = Date.now();
    const { component } = render(DataFreshness, { props: { timestamp } });
    expect(screen.getByText(/Updated just now/)).toBeTruthy();

    // Move system clock forward 30 seconds
    vi.setSystemTime(new Date(timestamp + 30_000));
    // Svelte skips re-render when prop value is unchanged — use a negligibly different value
    component.$set({ timestamp: timestamp + 1 });
    await vi.advanceTimersByTimeAsync(0);
    // (30_000 - 1) / 1000 = 29.999 → Math.floor → 29
    expect(screen.getByText(/Updated 29s ago/)).toBeTruthy();
  });

  it('updates when timestamp prop changes', async () => {
    const oldTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    const { component } = render(DataFreshness, { props: { timestamp: oldTimestamp } });
    expect(screen.getByText(/Updated 5m ago/)).toBeTruthy();

    // Update the prop to "just now"
    const newTimestamp = Date.now();
    component.$set({ timestamp: newTimestamp });
    // Wait for Svelte to update
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText(/Updated just now/)).toBeTruthy();
  });
});
