import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import Predictions from './Predictions.svelte';
import { dataService } from '../services/dataService';
import { predictionTracker } from '../services/predictionTracker';
import { OptimizedPredictor } from '../lib/optimizedPredictions';
import type { Match } from '../types';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn(() => Promise.resolve([])),
    getCurrentSeason: vi.fn(() => Promise.resolve({ currentMatchday: 20 })),
    getMatches: vi.fn(() => Promise.resolve([])),
    getAllHistoricalMatches: vi.fn(() => Promise.resolve([])),
    getLastFetched: vi.fn(() => Date.now()),
  }
}));

// Mock predictionTracker
vi.mock('../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn(() => ({
      accuracy: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      incorrectPredictions: 0
    })),
    getRecentPredictions: vi.fn(() => []),
    storePrediction: vi.fn(),
    updateWithResult: vi.fn(),
    getMatchPredictions: vi.fn(() => []),
    getAccuracyByGameweek: vi.fn(() => [])
  }
}));

// Mock OptimizedPredictor
vi.mock('../lib/optimizedPredictions', () => ({
  OptimizedPredictor: {
    predictMatch: vi.fn(() => Promise.resolve({
      predictedResult: 'H',
      confidence: 0.72,
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      homeForm: 'WWDLW',
      awayForm: 'LDWWL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: ['ELO favours home', 'Strong H2H record'],
      valueOdds: { home: 1.80, draw: 3.50, away: 4.20 }
    }))
  },
  getActiveModelWeights: () => ({ elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 }),
  saveModelWeights: vi.fn(() => true),
  resetModelWeights: vi.fn(),
  hasCustomWeights: vi.fn(() => false)
}));

// Mock PoissonPredictor
vi.mock('../lib/advancedPredictions', () => ({
  PoissonPredictor: {
    predictScoreProbabilities: vi.fn(() => ({})),
    getOutcomeProbabilities: vi.fn(() => ({ homeWin: 0.50, draw: 0.25, awayWin: 0.25 }))
  }
}));

// Mock BetBuilderPredictor with full interface shape
vi.mock('../lib/betBuilder', () => ({
  BetBuilderPredictor: {
    generateBetBuilder: vi.fn(() => Promise.resolve({
      matchId: 'm1',
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      matchResult: { prediction: 'H', homeWinProb: 0.50, drawProb: 0.25, awayWinProb: 0.25, confidence: 0.72 },
      bothTeamsToScore: { prediction: true, yesProb: 0.55, noProb: 0.45, confidence: 0.6 },
      totalGoals: {
        over25: { prediction: true, probability: 0.62 },
        over35: { prediction: false, probability: 0.35 },
        under25: { prediction: false, probability: 0.38 },
        under35: { prediction: true, probability: 0.65 },
        exactGoals: { 0: 0.05, 1: 0.12, 2: 0.25, 3: 0.28, 4: 0.18, 5: 0.08, 6: 0.04 }
      },
      corners: {
        totalOver85: { prediction: true, probability: 0.65 },
        totalOver95: { prediction: true, probability: 0.55 },
        totalOver105: { prediction: false, probability: 0.40 }
      },
      cards: {
        totalOver25: { prediction: true, probability: 0.70 },
        totalOver35: { prediction: true, probability: 0.58 },
        totalOver45: { prediction: false, probability: 0.35 }
      },
      halfTimeResult: { prediction: 'H', homeWinProb: 0.40, drawProb: 0.35, awayWinProb: 0.25 },
      cleanSheets: {
        homeCleanSheet: { prediction: false, probability: 0.30 },
        awayCleanSheet: { prediction: false, probability: 0.25 },
        bothCleanSheets: { prediction: false, probability: 0.05 }
      },
      suggestedCombos: [
        { name: 'Safe Acca', selections: ['Home Win', 'Over 1.5'], combinedOdds: 2.1, confidence: 0.65, reasoning: 'Strong home form' }
      ]
    }))
  }
}));

// Mock BacktestRunner
vi.mock('../lib/backtest', () => ({
  BacktestRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn(() => Promise.resolve({
      totalMatches: 50,
      correctPredictions: 30,
      overallAccuracy: 60.0,
      outcomeAccuracy: {
        home: { correct: 18, total: 25, accuracy: 72 },
        draw: { correct: 5, total: 15, accuracy: 33.3 },
        away: { correct: 7, total: 10, accuracy: 70 }
      },
      logLoss: 0.95,
      brierScore: 0.42,
      predictions: []
    }))
  }))
}));

// Mock Kelly
vi.mock('../services/betting/kelly', () => ({
  calculateKelly: vi.fn(() => ({
    fullKelly: 0.05,
    halfKelly: 0.025,
    quarterKelly: 0.0125,
    recommendedStake: 2.50,
    edge: 0.08,
    isValueBet: true
  }))
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
    TrendingUp: stub, Target: stub, Users: stub, BarChart3: stub,
    Calculator: stub, Package: stub, ChevronDown: stub, ChevronUp: stub,
    FlaskConical: stub, Sparkles: stub, Loader2: stub, CheckCircle2: stub, XCircle: stub, Clock: stub
  };
});

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 })
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Mocked Date')
}));

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png'),
  getTeamColor: vi.fn(() => '#666666')
}));

function makeMatch(overrides: Partial<Match> = {}): Match {
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();
  return {
    id: 'm1', season_id: 's1', date: futureDate,
    home_team: 'Arsenal', away_team: 'Liverpool',
    home_goals: null, away_goals: null, result: null,
    home_odds: null, draw_odds: null, away_odds: null,
    first_half_home_goals: null, first_half_away_goals: null,
    full_time_result: null, half_time_result: null,
    referee: null, home_shots: null, away_shots: null,
    home_shots_target: null, away_shots_target: null,
    home_fouls: null, away_fouls: null,
    home_corners: null, away_corners: null,
    home_yellows: null, away_yellows: null,
    home_reds: null, away_reds: null,
    created_at: new Date().toISOString(),
    matchday: 20,
    ...overrides
  };
}

describe('Predictions Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([]);
    vi.mocked(dataService.getCurrentSeason).mockResolvedValue({ currentMatchday: 20 } as any);
  });

  it('should render the header', () => {
    render(Predictions);
    expect(screen.getByText('Match Predictions')).toBeInTheDocument();
  });

  it('should show the gameweek selector', () => {
    render(Predictions);
    expect(screen.getByLabelText('Gameweek:')).toBeInTheDocument();
  });

  it('should show the Predict Gameweek button', () => {
    render(Predictions);
    expect(screen.getByTestId('predict-gameweek')).toBeInTheDocument();
    expect(screen.getByText('Predict Gameweek')).toBeInTheDocument();
  });

  it('should have 38 gameweek options', () => {
    render(Predictions);
    const options = document.querySelectorAll('#gameweek option');
    expect(options).toHaveLength(38);
  });

  it('should show skeleton loading state initially', () => {
    render(Predictions);
    // Skeleton placeholders are visible before loadGameweekMatches completes
    const skeleton = document.querySelector('.skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('should load matches for selected gameweek', async () => {
    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Liverpool')).toBeInTheDocument();
  });

  it('should show error when matches fail to load', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockRejectedValue(new Error('API error'));

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByText('Failed to load matches. Please try again.')).toBeInTheDocument();
  });

  it('should show completed matches with actual score and no-prediction message', async () => {
    const pastMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'FINISHED',
      result: 'H',
      home_goals: 2,
      away_goals: 1
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([pastMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    // Completed matches should now be shown (not hidden behind an error message)
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Liverpool')).toBeInTheDocument();
    // Actual score should be displayed
    expect(screen.getByTestId('actual-score')).toHaveTextContent('2-1');
    expect(screen.getByText('Full Time')).toBeInTheDocument();
    // Without a stored prediction, shows "no prediction made"
    expect(screen.getByText(/no prediction made/)).toBeInTheDocument();
  });

  it('should show "Exact score" verdict when predicted scoreline matches actual', async () => {
    const pastMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'FINISHED',
      result: 'H',
      home_goals: 2,
      away_goals: 1
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([pastMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([{
      id: 'pred_1',
      matchId: pastMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.72,
      actualResult: 'H',
      actualHomeGoals: 2,
      actualAwayGoals: 1,
      isCorrect: true,
      timestamp: new Date().toISOString(),
      matchDate: pastMatch.date,
      matchday: 20
    }]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByTestId('result-correct')).toBeInTheDocument();
    expect(screen.getByTestId('result-verdict')).toHaveTextContent(/Exact score/);
    expect(screen.getByTestId('result-verdict')).toHaveTextContent('2-1');
  });

  it('should show amber "Correct outcome" verdict when outcome is right but scoreline differs', async () => {
    // LIV 2-0 actual, predicted 2-1 — both are Home Wins, but scoreline is off.
    // The bug Tom spotted: this used to say "Correct prediction" with no indication
    // the scoreline was wrong. New verdict surfaces the nuance.
    const pastMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'FINISHED',
      result: 'H',
      home_goals: 2,
      away_goals: 0
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([pastMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([{
      id: 'pred_outcome_only',
      matchId: pastMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.69,
      actualResult: 'H',
      actualHomeGoals: 2,
      actualAwayGoals: 0,
      isCorrect: true,
      timestamp: new Date().toISOString(),
      matchDate: pastMatch.date,
      matchday: 20
    }]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    const verdict = screen.getByTestId('result-verdict');
    expect(verdict).toHaveTextContent(/Correct outcome/);
    expect(verdict).toHaveTextContent(/Home Win/);
    expect(verdict).toHaveTextContent('2-0');
    expect(verdict).toHaveTextContent('2-1');
    // Amber styling, not green
    expect(verdict.className).toContain('amber');
    expect(verdict.className).not.toContain('bg-green-500');
  });

  it('should show incorrect indicator for a wrongly predicted completed match', async () => {
    const pastMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'FINISHED',
      result: 'A',
      home_goals: 0,
      away_goals: 2
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([pastMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([{
      id: 'pred_2',
      matchId: pastMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.72,
      actualResult: 'A',
      actualHomeGoals: 0,
      actualAwayGoals: 2,
      isCorrect: false,
      timestamp: new Date().toISOString(),
      matchDate: pastMatch.date,
      matchday: 20
    }]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByTestId('result-incorrect')).toBeInTheDocument();
    expect(screen.getByTestId('result-verdict')).toHaveTextContent(/Incorrect/);
    expect(screen.getByTestId('result-verdict')).toHaveTextContent(/Away Win/);
  });

  it('shows live score with "Live {minute}\'" label and no verdict for in-play matches', async () => {
    // Regression for the "Full Time during live match" bug. Transform now leaves
    // result null for IN_PLAY, so the verdict banner must not render and the
    // stage label must read "Live 67'", not "Full Time".
    const liveMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() - 3600_000).toISOString(),
      status: 'IN_PLAY',
      minute: 67,
      result: null,
      home_goals: 1,
      away_goals: 0
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([liveMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([{
      id: 'pred_live',
      matchId: liveMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.70,
      timestamp: new Date().toISOString(),
      matchDate: liveMatch.date,
      matchday: 20
    }]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByTestId('live-score')).toHaveTextContent('1-0');
    expect(screen.getByText(/Live 67'/)).toBeInTheDocument();
    expect(screen.queryByText(/Full Time/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-verdict')).not.toBeInTheDocument();
  });

  it('should filter matches by gameweek number', async () => {
    const gw20Match = makeMatch({ id: 'm1', matchday: 20, home_team: 'Arsenal', away_team: 'Liverpool' });
    const gw21Match = makeMatch({ id: 'm2', matchday: 21, home_team: 'Chelsea', away_team: 'Spurs' });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([gw20Match, gw21Match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.queryByText('Chelsea')).not.toBeInTheDocument();
  });

  it('should show accuracy panel when predictions exist', async () => {
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 68,
      totalPredictions: 25,
      correctPredictions: 17,
      incorrectPredictions: 8
    } as any);

    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByTestId('accuracy-panel')).toBeInTheDocument();
  });

  it('should not show accuracy panel when no predictions exist', async () => {
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      incorrectPredictions: 0
    } as any);

    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.queryByTestId('accuracy-panel')).not.toBeInTheDocument();
  });

  it('should show team logos', async () => {
    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    const imgs = document.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it('should call OptimizedPredictor when predicting', async () => {
    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    await (component as any).predictGameweek();
    await act();

    expect(OptimizedPredictor.predictMatch).toHaveBeenCalledWith(
      'Arsenal', 'Liverpool', undefined, null, match.date
    );
  });

  it('should store prediction in tracker after predicting', async () => {
    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    await (component as any).predictGameweek();
    await act();

    expect(predictionTracker.storePrediction).toHaveBeenCalledTimes(1);
    const call = vi.mocked(predictionTracker.storePrediction).mock.calls[0];
    expect(call[0]).toBe('m1'); // matchId
    expect(call[1]).toBe('Arsenal'); // homeTeam
    expect(call[2]).toBe('Liverpool'); // awayTeam
    expect(call[3]).toEqual(expect.objectContaining({
      predictedResult: 'H',
      confidence: 0.72
    }));
  });

  it('should show Run Backtest button when accuracy panel is visible', async () => {
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 68,
      totalPredictions: 25,
      correctPredictions: 17,
      incorrectPredictions: 8
    } as any);

    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    expect(screen.getByTestId('run-backtest')).toBeInTheDocument();
    expect(screen.getByText('Run Backtest')).toBeInTheDocument();
  });

  it('should display backtest results after running', async () => {
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 68,
      totalPredictions: 25,
      correctPredictions: 17,
      incorrectPredictions: 8
    } as any);

    // Need completed matches for backtest — uses getAllHistoricalMatches for multi-season data
    const completedMatches = Array.from({ length: 10 }, (_, i) =>
      makeMatch({
        id: `m${i}`,
        matchday: 20,
        result: 'H' as const,
        home_goals: 2,
        away_goals: 1,
        date: new Date(Date.now() - 86400000 * (i + 1)).toISOString()
      })
    );
    vi.mocked(dataService.getAllHistoricalMatches).mockResolvedValue(completedMatches);

    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    await (component as any).runBacktest();
    await act();

    // Check backtest results are displayed
    expect(screen.getByText('60.0%')).toBeInTheDocument(); // overallAccuracy
    expect(screen.getByText('50')).toBeInTheDocument(); // totalMatches
  });

  it('should show backtest error when insufficient matches', async () => {
    vi.mocked(predictionTracker.getAccuracyStats).mockReturnValue({
      accuracy: 68,
      totalPredictions: 25,
      correctPredictions: 17,
      incorrectPredictions: 8
    } as any);

    // Only 2 completed matches — below the threshold of 5
    vi.mocked(dataService.getAllHistoricalMatches).mockResolvedValue([
      makeMatch({ id: 'm1', result: 'H' as const, home_goals: 1, away_goals: 0 }),
      makeMatch({ id: 'm2', result: 'A' as const, home_goals: 0, away_goals: 2 })
    ]);

    const match = makeMatch({ matchday: 20 });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    await (component as any).runBacktest();
    await act();

    expect(screen.getByText(/Need at least 5 completed matches/)).toBeInTheDocument();
  });
});
