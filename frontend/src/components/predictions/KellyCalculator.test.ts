import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import KellyCalculator from './KellyCalculator.svelte';

// The global test setup (src/tests/setup.ts) replaces window.localStorage
// with vi.fn() stubs that don't actually store. Persistence-round-trip
// assertions need a real Map-backed Storage; install one per-test here
// and restore the global mock in afterEach so other suites are unaffected.
const originalLocalStorage = globalThis.localStorage;

function installRealLocalStorage(): void {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => { store.delete(k); },
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true });
}

describe('KellyCalculator (broadcast rebuild)', () => {
  beforeEach(() => {
    installRealLocalStorage();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it('renders [data-testid="kelly-calculator"] root with three inputs', () => {
    const { container } = render(KellyCalculator);
    expect(container.querySelector('[data-testid="kelly-calculator"]')).toBeTruthy();
    expect(container.querySelector('[data-input="bankroll"]')).toBeTruthy();
    expect(container.querySelector('[data-input="odds"]')).toBeTruthy();
    expect(container.querySelector('[data-input="probability"]')).toBeTruthy();
  });

  it('auto-renders [data-results] on initial render with seeded inputs', () => {
    const { container } = render(KellyCalculator);
    expect(container.querySelector('[data-results]')).toBeTruthy();
    expect(container.querySelector('[data-output="stake"]')).toBeTruthy();
    expect(container.querySelector('[data-output="ev"]')).toBeTruthy();
    expect(container.querySelector('[data-output="edge"]')).toBeTruthy();
  });

  it('renders the stake-fraction bar with three marks (quarter/half/full)', () => {
    const { container } = render(KellyCalculator);
    const bar = container.querySelector('[data-stake-bar]');
    expect(bar).toBeTruthy();
    const marks = container.querySelectorAll('[data-stake-mark]');
    expect(marks).toHaveLength(3);
    const ids = Array.from(marks).map((m) => m.getAttribute('data-stake-mark'));
    expect(ids).toEqual(['quarter', 'half', 'full']);
  });

  it('persists bankroll to localStorage[kelly_bankroll] on input change', async () => {
    const { container } = render(KellyCalculator);
    const bankrollInput = container.querySelector('[data-input="bankroll"]') as HTMLInputElement;
    bankrollInput.value = '250';
    await fireEvent.input(bankrollInput);
    expect(localStorage.getItem('kelly_bankroll')).toBe('250');
  });

  it('reads bankroll from localStorage[kelly_bankroll] on mount', () => {
    localStorage.setItem('kelly_bankroll', '500');
    const { container } = render(KellyCalculator);
    const bankrollInput = container.querySelector('[data-input="bankroll"]') as HTMLInputElement;
    expect(bankrollInput.value).toBe('500');
  });

  it('renders [data-no-value] warning when edge is negative (probability << implied)', async () => {
    const { container } = render(KellyCalculator);
    const odds = container.querySelector('[data-input="odds"]') as HTMLInputElement;
    const prob = container.querySelector('[data-input="probability"]') as HTMLInputElement;
    odds.value = '1.5';
    await fireEvent.input(odds);
    prob.value = '30';
    await fireEvent.input(prob);
    expect(container.querySelector('[data-no-value]')).toBeTruthy();
  });
});
