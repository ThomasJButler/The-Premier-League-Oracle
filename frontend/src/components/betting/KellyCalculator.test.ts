import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import KellyCalculatorComponent from './KellyCalculator.svelte';

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
    Calculator: stub, AlertTriangle: stub,
  };
});

describe('KellyCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the calculator container', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByTestId('kelly-calculator')).toBeInTheDocument();
  });

  it('should show the header text', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByText('Kelly Calculator')).toBeInTheDocument();
    expect(screen.getByText(/Half-Kelly stake sizing/)).toBeInTheDocument();
  });

  it('should have bankroll, odds, and probability input fields', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByLabelText('Your Bankroll')).toBeInTheDocument();
    expect(screen.getByLabelText('Bookmaker Odds (Decimal)')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Win Probability (%)')).toBeInTheDocument();
  });

  it('should auto-calculate with default values and show results panel', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByTestId('kelly-results')).toBeInTheDocument();
  });

  it('should show Stake Amount, Expected Value, and Potential Return', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByText('Stake Amount')).toBeInTheDocument();
    expect(screen.getByText('Expected Value')).toBeInTheDocument();
    expect(screen.getByText('Potential Return')).toBeInTheDocument();
  });

  it('should show Value bet indicator for default values', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByText(/Value bet/)).toBeInTheDocument();
  });

  it('should show the edge percentage', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByText(/Your edge:/)).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
  });

  it('should note shared bankroll with Suggested Bets', () => {
    render(KellyCalculatorComponent);
    expect(screen.getByText(/Shared with Suggested Bets/)).toBeInTheDocument();
  });
});
