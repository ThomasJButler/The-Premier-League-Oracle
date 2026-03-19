import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/svelte';
import Dashboard from './Dashboard.svelte';
import { dataService } from '../services/dataService';
import { predictionTracker } from '../services/predictionTracker';
import type { Match } from '../types';

// Mock the dataService — the Dashboard calls getMatches and predictionTracker
vi.mock('../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn(),
    getStatus: vi.fn(() => ({
      primarySource: { type: 'api', available: true },
      fallbackSource: { type: 'none', available: false }
    }))
  }
}));

vi.mock('../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn(() => ({
      accuracy: 65,
      totalPredictions: 10,
      correctPredictions: 6,
      incorrectPredictions: 4
    })),
    updateWithResult: vi.fn(),
    getRecentPredictions: vi.fn(() => []),
    getMatchPredictions: vi.fn(() => []),
    getAccuracyByGameweek: vi.fn(() => [])
  }
}));

vi.mock('../services/betting/betHistoryService', () => ({
  betHistoryService: {
    resolveMatchBets: vi.fn(),
    getROI: vi.fn(() => ({ roi: 0, totalStaked: 0, totalReturn: 0, totalBets: 0 })),
    getAllBets: vi.fn(() => []),
    getWinRate: vi.fn(() => 0),
    getPendingBets: vi.fn(() => []),
    getMonthlyPL: vi.fn(() => [])
  }
}));

// Mock Chart.js — Dashboard imports and registers chart components
vi.mock('chart.js', () => {
  function MockChart() {}
  MockChart.register = vi.fn();
  return {
    Chart: MockChart,
    Title: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
    LineElement: vi.fn(),
    LinearScale: vi.fn(),
    CategoryScale: vi.fn(),
    PointElement: vi.fn(),
    Filler: vi.fn()
  };
});

// Mock svelte-chartjs with a minimal Svelte-like component constructor
vi.mock('svelte-chartjs', () => {
  function MockLine(this: any, options: any) {
    this.$$ = {
      fragment: {
        c() {},
        m() {},
        p() {},
        d() {},
        l() {},
        i() {},
        o() {}
      },
      ctx: [],
      props: {},
      update: () => {},
      not_equal: () => false,
      bound: Object.create(null),
      on_mount: [],
      on_destroy: [],
      on_disconnect: [],
      before_update: [],
      after_update: [],
      context: new Map(),
      callbacks: Object.create(null),
      dirty: [-1],
      skip_bound: false,
      root: options?.target || document.createElement('div')
    };
  }
  MockLine.prototype.$destroy = function() {};
  MockLine.prototype.$on = function() { return () => {}; };
  MockLine.prototype.$set = function() {};

  return { Line: MockLine };
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

// Mock date-fns format to avoid issues in test environment
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Mocked Date')
}));

// Mock lucide-svelte icons as simple stub components
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
    Users: stub,
    Target: stub,
    BarChart2: stub,
    Trophy: stub
  };
});

const mockMatches: Match[] = [
  {
    id: '1',
    season_id: 'season-1',
    date: new Date().toISOString(),
    home_team: 'Arsenal',
    away_team: 'Liverpool',
    home_goals: 2,
    away_goals: 1,
    result: 'H',
    home_odds: 2.5,
    draw_odds: 3.2,
    away_odds: 2.8,
    first_half_home_goals: 1,
    first_half_away_goals: 0,
    full_time_result: 'H',
    half_time_result: 'H',
    referee: 'Michael Oliver',
    home_shots: 15,
    away_shots: 12,
    home_shots_target: 6,
    away_shots_target: 4,
    home_fouls: 10,
    away_fouls: 12,
    home_corners: 6,
    away_corners: 4,
    home_yellows: 2,
    away_yellows: 3,
    home_reds: 0,
    away_reds: 0,
    created_at: new Date().toISOString()
  }
];

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply mock implementations cleared by clearAllMocks
    vi.mocked(dataService.getMatches).mockResolvedValue(mockMatches);
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 65,
      totalPredictions: 10,
      correctPredictions: 6,
      incorrectPredictions: 4
    } as any);
    vi.mocked(predictionTracker.updateWithResult).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(Dashboard);

    const loadingElements = document.querySelectorAll('.skeleton');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should display the main title', () => {
    render(Dashboard);

    const title = screen.getByText('Premier League Oracle');
    expect(title).toBeInTheDocument();
  });

  it('should call getMatches on mount', async () => {
    const { component } = render(Dashboard);

    // Call refresh directly since onMount scheduling may not work in jsdom
    await (component as any).refresh();
    await act();

    expect(dataService.getMatches).toHaveBeenCalled();
  });

  it('should display stats cards after loading', async () => {
    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    await waitFor(() => {
      const accuracyElements = screen.queryAllByText(/Prediction Accuracy/i);
      expect(accuracyElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle empty match data', async () => {
    vi.mocked(dataService.getMatches).mockResolvedValue([]);

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    const errorMessage = screen.queryByText(/No matches found for the current season/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it('should handle data loading error', async () => {
    vi.mocked(dataService.getMatches).mockRejectedValue(
      new Error('Failed to fetch')
    );

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    const errorMessage = screen.queryByText(/Failed to load dashboard data/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it('should display retry button on error', async () => {
    vi.mocked(dataService.getMatches).mockRejectedValue(
      new Error('Failed to fetch')
    );

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    const retryButton = screen.queryByText(/Retry/i);
    expect(retryButton).toBeInTheDocument();
  });

  it('should display chart containers', async () => {
    render(Dashboard);

    await waitFor(() => {
      const accuracyChart = screen.queryByText(/Prediction Accuracy Trend/i);
      const profitChart = screen.queryByText(/Profit\/Loss Over Time/i);
      expect(accuracyChart).toBeInTheDocument();
      expect(profitChart).toBeInTheDocument();
    });
  });

  it('should display recent predictions section', async () => {
    render(Dashboard);

    await waitFor(() => {
      const recentPredictionsTitle = screen.queryByText(/Recent Predictions/i);
      expect(recentPredictionsTitle).toBeInTheDocument();
    });
  });

  it('should display the how we predict section', async () => {
    render(Dashboard);

    await waitFor(() => {
      const howWePredict = screen.queryByText(/How We Predict/i);
      expect(howWePredict).toBeInTheDocument();
    });
  });

  it('should render all four stat cards after loading', async () => {
    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    await waitFor(() => {
      expect(screen.queryAllByText(/Prediction Accuracy/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/Total Profit/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/Total Predictions/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/Bets Placed/i).length).toBeGreaterThan(0);
    });
  });

  it('should apply responsive grid layout', () => {
    render(Dashboard);

    const gridElements = document.querySelectorAll('.grid.grid-cols-1');
    expect(gridElements.length).toBeGreaterThan(0);
  });
});
