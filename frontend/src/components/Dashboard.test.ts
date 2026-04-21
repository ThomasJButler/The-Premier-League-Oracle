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
    Trophy: stub,
    ChevronDown: stub,
    Calendar: stub,
    Clock: stub,
    Zap: stub
  };
});

// Mock team logos utility — returns a simple data URI for any team
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'data:image/svg+xml,mock')
}));

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

    const title = screen.getByRole('heading', { name: 'Dashboard' });
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

  it('should preserve API-key-required error message from dataService', async () => {
    const apiKeyError = 'API key required. Please set up your Football-Data.org API key in Settings or through the setup wizard.';
    vi.mocked(dataService.getMatches).mockRejectedValue(new Error(apiKeyError));

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    const errorMessage = screen.queryByText(/API key required/i);
    expect(errorMessage).toBeInTheDocument();
    // The generic fallback must NOT be shown when a specific actionable message exists
    expect(screen.queryByText(/Failed to load dashboard data/i)).not.toBeInTheDocument();
  });

  it('should log data load failures to console.warn instead of swallowing them', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('Boom');
    vi.mocked(dataService.getMatches).mockRejectedValue(err);

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    expect(warnSpy).toHaveBeenCalledWith('Dashboard data load failed', err);
    warnSpy.mockRestore();
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

  it('should display activity section with predictions tab', async () => {
    render(Dashboard);

    await waitFor(() => {
      const predictionsTab = screen.queryByTestId('tab-predictions');
      expect(predictionsTab).toBeInTheDocument();
      const upcomingTab = screen.queryByTestId('tab-upcoming');
      expect(upcomingTab).toBeInTheDocument();
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

    const gridElements = document.querySelectorAll('.grid');
    expect(gridElements.length).toBeGreaterThan(0);
  });

  it('should show onboarding card when no predictions or bets exist', async () => {
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      incorrectPredictions: 0
    } as any);

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-card')).toBeInTheDocument();
      expect(screen.queryByText('Ready to predict?')).toBeInTheDocument();
      expect(screen.queryByText(/Generate Your First Prediction/)).toBeInTheDocument();
      // Stat cards should NOT be visible in onboarding state
      expect(screen.queryByTestId('stat-cards')).not.toBeInTheDocument();
    });
  });

  it('should show stat cards instead of onboarding when predictions exist', async () => {
    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    await waitFor(() => {
      expect(screen.queryByTestId('stat-cards')).toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-card')).not.toBeInTheDocument();
    });
  });

  it('should show featured match in hero section when upcoming matches exist', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const upcomingMatch: Match = {
      id: 'upcoming-1', season_id: 'season-1', date: futureDate,
      home_team: 'Chelsea', away_team: 'Tottenham',
      home_goals: null, away_goals: null, result: null,
      home_odds: null, draw_odds: null, away_odds: null,
      first_half_home_goals: null, first_half_away_goals: null,
      full_time_result: null, half_time_result: null, referee: null,
      home_shots: null, away_shots: null, home_shots_target: null,
      away_shots_target: null, home_fouls: null, away_fouls: null,
      home_corners: null, away_corners: null, home_yellows: null,
      away_yellows: null, home_reds: null, away_reds: null,
      created_at: new Date().toISOString(), status: 'TIMED', matchday: 30
    };

    // First call: recent matches. Second call: upcoming matches.
    vi.mocked(dataService.getMatches)
      .mockResolvedValueOnce(mockMatches)
      .mockResolvedValueOnce([upcomingMatch]);

    const { component } = render(Dashboard);
    await (component as any).refresh();
    await act();

    await waitFor(() => {
      expect(screen.queryByTestId('featured-match')).toBeInTheDocument();
    });
  });
});
