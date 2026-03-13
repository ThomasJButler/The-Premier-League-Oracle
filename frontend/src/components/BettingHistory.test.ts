import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/svelte';
import BettingHistory from './BettingHistory.svelte';
import { betHistoryService } from '../services/betting/betHistoryService';
import type { StoredBet, ROISummary, MonthlyPL } from '../services/betting/betHistoryService';

// Mock betHistoryService
vi.mock('../services/betting/betHistoryService', () => ({
  betHistoryService: {
    getAllBets: vi.fn(() => []),
    getROI: vi.fn(() => ({ roi: 0, totalStaked: 0, totalReturn: 0, totalBets: 0 })),
    getWinRate: vi.fn(() => 0),
    getMonthlyPL: vi.fn(() => []),
    exportBets: vi.fn(() => '[]'),
    getPendingBets: vi.fn(() => []),
    resolveMatchBets: vi.fn()
  }
}));

// Mock Chart.js
vi.mock('chart.js', () => {
  function MockChart() {}
  MockChart.register = vi.fn();
  return {
    Chart: MockChart,
    Title: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
    BarElement: vi.fn(),
    CategoryScale: vi.fn(),
    LinearScale: vi.fn()
  };
});

// Mock svelte-chartjs Bar component
vi.mock('svelte-chartjs', () => {
  function MockBar(this: any, options: any) {
    this.$$ = {
      fragment: { c() {}, m() {}, p() {}, d() {}, l() {}, i() {}, o() {} },
      ctx: [], props: {}, update: () => {}, not_equal: () => false,
      bound: Object.create(null), on_mount: [], on_destroy: [], on_disconnect: [],
      before_update: [], after_update: [], context: new Map(),
      callbacks: Object.create(null), dirty: [-1], skip_bound: false,
      root: options?.target || document.createElement('div')
    };
  }
  MockBar.prototype.$destroy = function() {};
  MockBar.prototype.$on = function() { return () => {}; };
  MockBar.prototype.$set = function() {};

  return { Bar: MockBar };
});

// Mock tweened from svelte/motion
vi.mock('svelte/motion', () => ({
  tweened: vi.fn((initial) => {
    let value = initial;
    const subscribers = new Set<(v: number) => void>();
    return {
      set: vi.fn((newVal: number) => {
        value = newVal;
        subscribers.forEach(fn => fn(value));
      }),
      update: vi.fn(),
      subscribe: vi.fn((callback: (v: number) => void) => {
        subscribers.add(callback);
        callback(value);
        return () => { subscribers.delete(callback); };
      })
    };
  })
}));

// Mock svelte/easing
vi.mock('svelte/easing', () => ({
  cubicOut: (t: number) => t
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Mocked Date'),
  formatDistanceToNow: vi.fn(() => '2 days ago')
}));

// Mock lucide-svelte icons
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
        root: opts?.target || document.createElement('div')
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return {
    TrendingUp: stub,
    TrendingDown: stub,
    Download: stub,
    DollarSign: stub,
    Minus: stub,
    Trophy: stub,
    Percent: stub,
    Scale: stub,
    Filter: stub
  };
});

const makeBet = (overrides: Partial<StoredBet> = {}): StoredBet => ({
  id: 'bet_1',
  matchId: 'match_1',
  matchDate: '2026-03-15T15:00:00Z',
  homeTeam: 'Arsenal FC',
  awayTeam: 'Chelsea FC',
  market: 'match_result',
  selection: 'home',
  odds: 2.1,
  stake: 10,
  kellyFraction: 0.25,
  confidence: 0.72,
  createdAt: '2026-03-15T14:00:00Z',
  ...overrides
});

describe('BettingHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(betHistoryService.getAllBets).mockReturnValue([]);
    vi.mocked(betHistoryService.getROI).mockReturnValue({ roi: 0, totalStaked: 0, totalReturn: 0, totalBets: 0 });
    vi.mocked(betHistoryService.getWinRate).mockReturnValue(0);
    vi.mocked(betHistoryService.getMonthlyPL).mockReturnValue([]);
    vi.mocked(betHistoryService.exportBets).mockReturnValue('[]');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the heading', () => {
    render(BettingHistory);
    expect(screen.getByText('Betting History')).toBeInTheDocument();
  });

  it('should show empty state when no bets exist', () => {
    render(BettingHistory);
    expect(screen.getByText('No betting history found.')).toBeInTheDocument();
  });

  it('should display summary stat cards', () => {
    render(BettingHistory);

    expect(screen.getByText('Total Staked')).toBeInTheDocument();
    expect(screen.getByText('Total Profit/Loss')).toBeInTheDocument();
    expect(screen.getByText('ROI')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Total Bets')).toBeInTheDocument();
  });

  it('should call betHistoryService methods on mount', () => {
    render(BettingHistory);

    expect(betHistoryService.getAllBets).toHaveBeenCalled();
    expect(betHistoryService.getROI).toHaveBeenCalled();
    expect(betHistoryService.getWinRate).toHaveBeenCalled();
    expect(betHistoryService.getMonthlyPL).toHaveBeenCalled();
  });

  it('should display bets in the table', () => {
    const bets: StoredBet[] = [
      makeBet({ id: 'bet_1', homeTeam: 'Arsenal FC', awayTeam: 'Chelsea FC', result: 'win', profit: 11 }),
      makeBet({ id: 'bet_2', homeTeam: 'Liverpool FC', awayTeam: 'Man City', result: 'loss', profit: -10 })
    ];
    vi.mocked(betHistoryService.getAllBets).mockReturnValue(bets);
    vi.mocked(betHistoryService.getROI).mockReturnValue({ roi: 5, totalStaked: 20, totalReturn: 21, totalBets: 2 });

    render(BettingHistory);

    expect(screen.getByText('Arsenal FC vs Chelsea FC')).toBeInTheDocument();
    expect(screen.getByText('Liverpool FC vs Man City')).toBeInTheDocument();
  });

  it('should display market badges correctly', () => {
    const bets: StoredBet[] = [
      makeBet({ id: 'bet_1', market: 'match_result' }),
      makeBet({ id: 'bet_2', market: 'btts', selection: 'yes' }),
      makeBet({ id: 'bet_3', market: 'over_2_5', selection: 'over' })
    ];
    vi.mocked(betHistoryService.getAllBets).mockReturnValue(bets);

    render(BettingHistory);

    expect(screen.getByText('1X2')).toBeInTheDocument();
    expect(screen.getByText('BTTS')).toBeInTheDocument();
    expect(screen.getByText('O2.5')).toBeInTheDocument();
  });

  it('should display result labels for each state', () => {
    const bets: StoredBet[] = [
      makeBet({ id: 'bet_1', result: 'win', profit: 11 }),
      makeBet({ id: 'bet_2', result: 'loss', profit: -10 }),
      makeBet({ id: 'bet_3' }) // no result = pending
    ];
    vi.mocked(betHistoryService.getAllBets).mockReturnValue(bets);

    render(BettingHistory);

    expect(screen.getByText('Win')).toBeInTheDocument();
    expect(screen.getByText('Loss')).toBeInTheDocument();
    // "Pending" also appears in the filter dropdown, so check for at least 2 instances
    const pendingElements = screen.getAllByText('Pending');
    expect(pendingElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should show the monthly P/L chart section', () => {
    render(BettingHistory);
    expect(screen.getByText('Monthly Profit/Loss')).toBeInTheDocument();
  });

  it('should show empty chart message when no resolved bets', () => {
    vi.mocked(betHistoryService.getMonthlyPL).mockReturnValue([]);
    render(BettingHistory);

    expect(screen.getByText(/No resolved bets yet/)).toBeInTheDocument();
  });

  it('should show the export button', () => {
    render(BettingHistory);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should show the filter dropdown', () => {
    render(BettingHistory);

    const select = document.querySelector('select');
    expect(select).toBeInTheDocument();
  });

  it('should expose a refresh method', () => {
    const { component } = render(BettingHistory);
    expect(typeof (component as any).refresh).toBe('function');
  });

  it('should show detailed history heading', () => {
    render(BettingHistory);
    expect(screen.getByText('Detailed History')).toBeInTheDocument();
  });

  it('should format selection labels for match_result market', () => {
    const bets: StoredBet[] = [
      makeBet({ id: 'bet_1', market: 'match_result', selection: 'home' }),
      makeBet({ id: 'bet_2', market: 'match_result', selection: 'draw' }),
      makeBet({ id: 'bet_3', market: 'match_result', selection: 'away' })
    ];
    vi.mocked(betHistoryService.getAllBets).mockReturnValue(bets);

    render(BettingHistory);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Draw')).toBeInTheDocument();
    expect(screen.getByText('Away')).toBeInTheDocument();
  });

  it('should display profit with correct sign formatting', () => {
    const bets: StoredBet[] = [
      makeBet({ id: 'bet_1', result: 'win', profit: 11 }),
      makeBet({ id: 'bet_2', result: 'loss', profit: -10 })
    ];
    vi.mocked(betHistoryService.getAllBets).mockReturnValue(bets);

    render(BettingHistory);

    expect(screen.getByText('+£11.00')).toBeInTheDocument();
    expect(screen.getByText('-£10.00')).toBeInTheDocument();
  });
});
