import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import KellyCalculatorComponent from './KellyCalculator.svelte';
import { dataService } from '../../services/dataService';
import { OptimizedPredictor } from '../../lib/optimizedPredictions';
import type { Match } from '../../types';
import type { EnhancedPredictionModel } from '../../lib/optimizedPredictions';

// Mock dataService
vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn(() => Promise.resolve([]))
  }
}));

// Mock OptimizedPredictor
vi.mock('../../lib/optimizedPredictions', () => ({
  OptimizedPredictor: {
    predictMatch: vi.fn(() => Promise.resolve({
      predictedResult: 'H',
      confidence: 0.72,
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      homeForm: 'WWDWW',
      awayForm: 'WLDWL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: ['Arsenal in excellent form'],
      valueOdds: { home: 1.60, draw: 4.00, away: 6.50 }
    }))
  }
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
    Calculator: stub, AlertTriangle: stub, TrendingUp: stub,
    Zap: stub, RefreshCw: stub, BookmarkPlus: stub, Check: stub
  };
});

// Mock betHistoryService
vi.mock('../../services/betting/betHistoryService', () => ({
  betHistoryService: {
    storeBet: vi.fn(() => ({ id: 'test-bet-1', createdAt: new Date().toISOString() }))
  }
}));

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 })
}));

// Mock team logos
vi.mock('../../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png')
}));

function makeUpcomingMatch(overrides: Partial<Match> = {}): Match {
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();
  return {
    id: '1', season_id: 's1', date: futureDate,
    home_team: 'Arsenal', away_team: 'Liverpool',
    home_goals: null, away_goals: null, result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null,
    referee: 'Michael Oliver', home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

describe('KellyCalculator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataService.getMatches).mockResolvedValue([]);
  });

  // --- Manual Calculator Tests ---

  it('should render the calculator container', () => {
    render(KellyCalculatorComponent);

    const container = screen.getByTestId('kelly-calculator');
    expect(container).toBeInTheDocument();
  });

  it('should show the header text', () => {
    render(KellyCalculatorComponent);

    expect(screen.getByText('Kelly Calculator')).toBeInTheDocument();
    expect(screen.getByText(/Half-Kelly stake sizing/)).toBeInTheDocument();
  });

  it('should have bankroll, odds, and probability input fields with correct labels', () => {
    render(KellyCalculatorComponent);

    expect(screen.getByLabelText('Your Bankroll')).toBeInTheDocument();
    expect(screen.getByLabelText('Bookmaker Odds (Decimal)')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Win Probability (%)')).toBeInTheDocument();
  });

  it('should auto-calculate with default values and show results panel', () => {
    render(KellyCalculatorComponent);

    const results = screen.getByTestId('kelly-results');
    expect(results).toBeInTheDocument();
  });

  it('should show Stake Amount, Expected Value, and Potential Return labels', () => {
    render(KellyCalculatorComponent);

    expect(screen.getByText('Stake Amount')).toBeInTheDocument();
    expect(screen.getByText('Expected Value')).toBeInTheDocument();
    expect(screen.getByText('Potential Return')).toBeInTheDocument();
  });

  it('should show Value bet indicator for default values', () => {
    render(KellyCalculatorComponent);

    expect(screen.getByText(/Value bet/)).toBeInTheDocument();
  });

  it('should show the edge percentage text', () => {
    render(KellyCalculatorComponent);

    expect(screen.getByText(/Your edge:/)).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
  });

  // --- Suggestions Section Tests ---

  it('should render the Suggested Bets section', () => {
    render(KellyCalculatorComponent);

    const suggestionsPanel = screen.getByTestId('kelly-suggestions');
    expect(suggestionsPanel).toBeInTheDocument();
    expect(screen.getByText('Suggested Bets')).toBeInTheDocument();
  });

  it('should show the confidence threshold slider', () => {
    render(KellyCalculatorComponent);

    expect(screen.getByLabelText(/Min. Confidence/)).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument(); // default threshold
  });

  it('should show empty state when no upcoming matches', async () => {
    vi.mocked(dataService.getMatches).mockResolvedValue([]);

    const { component } = render(KellyCalculatorComponent);
    await (component as any).loadSuggestions();
    await act();

    expect(screen.getByText(/No value bets found/)).toBeInTheDocument();
  });

  it('should show suggestions when predictions pass the filter', async () => {
    const match = makeUpcomingMatch({
      id: 'm1',
      home_team: 'Arsenal',
      away_team: 'Liverpool'
    });

    vi.mocked(dataService.getMatches).mockResolvedValue([match]);
    vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue({
      predictedResult: 'H',
      confidence: 0.72,
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      homeForm: 'WWDWW',
      awayForm: 'WLDWL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: ['Arsenal in excellent form', 'Liverpool struggling away'],
      valueOdds: { home: 1.60, draw: 4.00, away: 6.50 }
    });

    const { component } = render(KellyCalculatorComponent);
    await (component as any).loadSuggestions();
    await act();

    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Liverpool')).toBeInTheDocument();
    expect(screen.getByText('Home Win')).toBeInTheDocument();
    expect(screen.getByText('72% confidence')).toBeInTheDocument();
  });

  it('should filter out matches with low confidence', async () => {
    const match = makeUpcomingMatch({ id: 'm1' });

    vi.mocked(dataService.getMatches).mockResolvedValue([match]);
    vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue({
      predictedResult: 'D',
      confidence: 0.20, // Below 30% threshold
      predictedHomeGoals: 1,
      predictedAwayGoals: 1,
      homeForm: 'WLDWL',
      awayForm: 'WLDWL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: [],
      valueOdds: { home: 3.00, draw: 3.30, away: 3.00 }
    });

    const { component } = render(KellyCalculatorComponent);
    await (component as any).loadSuggestions();
    await act();

    // Should show empty state — confidence too low
    expect(screen.getByText(/No value bets found/)).toBeInTheDocument();
  });

  it('should show error state when API fails', async () => {
    vi.mocked(dataService.getMatches).mockRejectedValue(new Error('API down'));

    const { component } = render(KellyCalculatorComponent);
    await (component as any).loadSuggestions();
    await act();

    expect(screen.getByText(/Could not load suggestions/)).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should skip matches that already have results', async () => {
    const completedMatch = makeUpcomingMatch({ id: 'm1', result: 'H', home_goals: 2, away_goals: 1 });
    const upcomingMatch = makeUpcomingMatch({ id: 'm2', home_team: 'Chelsea', away_team: 'Spurs' });

    vi.mocked(dataService.getMatches).mockResolvedValue([completedMatch, upcomingMatch]);
    vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue({
      predictedResult: 'H',
      confidence: 0.75,
      predictedHomeGoals: 2,
      predictedAwayGoals: 0,
      homeForm: 'WWWWW',
      awayForm: 'LLLDL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: ['Chelsea dominant at home'],
      valueOdds: { home: 1.50, draw: 4.50, away: 7.00 }
    });

    const { component } = render(KellyCalculatorComponent);
    await (component as any).loadSuggestions();
    await act();

    // Only the upcoming match (Chelsea vs Spurs) should be predicted
    expect(OptimizedPredictor.predictMatch).toHaveBeenCalledTimes(1);
    expect(OptimizedPredictor.predictMatch).toHaveBeenCalledWith(
      'Chelsea', 'Spurs', undefined, 'Michael Oliver'
    );
  });

  it('should display suggestion count text', async () => {
    const match = makeUpcomingMatch({ id: 'm1' });

    vi.mocked(dataService.getMatches).mockResolvedValue([match]);
    vi.mocked(OptimizedPredictor.predictMatch).mockResolvedValue({
      predictedResult: 'H',
      confidence: 0.72,
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      homeForm: 'WWDWW',
      awayForm: 'WLDWL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: [],
      valueOdds: { home: 1.60, draw: 4.00, away: 6.50 }
    });

    const { component } = render(KellyCalculatorComponent);
    await (component as any).loadSuggestions();
    await act();

    expect(screen.getByText(/1 suggestion/)).toBeInTheDocument();
    expect(screen.getByText(/£100 bankroll/)).toBeInTheDocument();
  });
});
