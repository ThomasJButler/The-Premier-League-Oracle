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

// Mock predictionTracker. MODEL_VERSION is intentionally left undefined here so
// pre-existing fixtures (which don't set modelVersion on their stored prediction)
// compare equal — undefined !== undefined is false, so they're not treated as
// stale. Staleness is instead tested by setting a distinct modelVersion string
// (e.g. 'v2.0-OLD') on the stored prediction fixture.
vi.mock('../services/predictionTracker', () => ({
  MODEL_VERSION: undefined,
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

// Mock the stats pack helpers — returns undefined by default so the
// Historical Context block doesn't render on unrelated tests. Individual
// tests override with mockReturnValueOnce() to exercise the block.
vi.mock('$lib/data/statsPack', () => ({
  getTeamProfile: vi.fn(() => undefined),
  getPairStats: vi.fn(() => undefined),
  getRefereeStats: vi.fn(() => undefined),
  getMatchdayStats: vi.fn(() => undefined),
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

  it('treats stored predictions with mismatched modelVersion as pending on unfinished fixtures', async () => {
    // Regression: Tom reported cards where the stored scoreline ("Burnley 2-1")
    // disagreed with the live H/D/A bar ("A 68%") — stale stored data from an
    // older model version. Fix: if the stored prediction predates the current
    // MODEL_VERSION and the fixture hasn't been played yet, drop to 'pending'
    // so a fresh forecast is generated on click.
    const upcomingMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() + 86400000).toISOString(),
      status: 'SCHEDULED',
      result: null,
      home_goals: undefined,
      away_goals: undefined
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([upcomingMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([{
      id: 'pred_stale',
      matchId: upcomingMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.70,
      modelVersion: 'v2.0-OLD', // stale
      timestamp: new Date().toISOString(),
      matchDate: upcomingMatch.date,
      matchday: 20
    }]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    // Stale card should NOT render the stored scoreline — it should show the
    // pending prompt instead.
    expect(screen.getByText(/Predict Gameweek.+to generate predictions/i)).toBeInTheDocument();
    expect(screen.queryByText('2-1')).not.toBeInTheDocument();
  });

  it('keeps stored prediction (even stale) when fixture has an actual result — preserves accuracy history', async () => {
    // Completed matches are historical record. Even if the stored prediction
    // predates the current model, we keep it so accuracy tracking remains stable.
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
      id: 'pred_stale_completed',
      matchId: pastMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.70,
      modelVersion: 'v2.0-OLD', // stale — but match is FINISHED
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

    // Historical card must still show the verdict — staleness doesn't evict it.
    expect(screen.getByTestId('result-verdict')).toBeInTheDocument();
  });

  it('populates detailedAnalysis homeForm/keyFactors from stored extras when modelVersion matches', async () => {
    // Regression for "Recent Form: Not available" in the detailed analysis view.
    // Previously the load path hardcoded '-' for form; now it reads from stored
    // extras when present.
    const upcomingMatch = makeMatch({
      matchday: 20,
      date: new Date(Date.now() + 86400000).toISOString(),
      status: 'SCHEDULED',
      result: null,
      home_goals: undefined,
      away_goals: undefined
    });
    const { MODEL_VERSION } = await import('../services/predictionTracker');
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([upcomingMatch]);
    vi.mocked(predictionTracker.getMatchPredictions).mockReturnValue([{
      id: 'pred_with_extras',
      matchId: upcomingMatch.id,
      homeTeam: 'Arsenal',
      awayTeam: 'Liverpool',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      confidence: 0.70,
      modelVersion: MODEL_VERSION,
      homeForm: 'WWDWL',
      awayForm: 'LLDLW',
      keyFactors: ['Arsenal dominant at home', 'Liverpool poor away form'],
      poissonProbs: { homeWin: 0.62, draw: 0.22, awayWin: 0.16 },
      timestamp: new Date().toISOString(),
      matchDate: upcomingMatch.date,
      matchday: 20
    }]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();

    // Form is rendered as coloured dots (not literal text) — check that the
    // home team's "recent form" aria-labelled container contains the expected
    // 5 result dots (WWDWL → 5 spans with title Win/Draw/Loss). If form were
    // '-' (the fallback), parseFormString returns [] and no dots render.
    const homeFormGroup = document.querySelector('[aria-label="Arsenal recent form"]');
    expect(homeFormGroup).not.toBeNull();
    expect(homeFormGroup!.querySelectorAll('span[title]').length).toBe(5);

    // keyFactors are rendered as <li> text in the detail panel.
    expect(screen.getByText(/Arsenal dominant at home/)).toBeInTheDocument();
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

  it('P12c — renders Historical Context block with all 5 rows when full pair + referee + matchday data is available', async () => {
    const { getTeamProfile, getPairStats, getRefereeStats, getMatchdayStats } =
      await import('$lib/data/statsPack');

    // Arsenal at home: strong record. Note homeAdvantage.homeWinRate is a
    // rate (0..1) — the component multiplies by 100 for display.
    vi.mocked(getTeamProfile).mockImplementation((name: string) => {
      if (name === 'Arsenal') {
        return {
          totalMatches: 1200,
          homeGoalsScored: 2.4,
          homeGoalsConceded: 1.0,
          awayGoalsScored: 1.5,
          awayGoalsConceded: 1.2,
          cleanSheetRateHome: 0.35,
          cleanSheetRateAway: 0.20,
          failedToScoreRateHome: 0.08,
          failedToScoreRateAway: 0.25,
          over25Rate: 0.58,
          bttsRate: 0.52,
          recentScoringTrend: 0,
          goalVariance: 1.6,
          overRates: { over15: 0.82, over25: 0.58, over35: 0.35, over45: 0.18, under15: 0.18, under25: 0.42 },
          eraWeighted: { homeGoalsScored: 2.4, homeGoalsConceded: 1.0, awayGoalsScored: 1.5, awayGoalsConceded: 1.2 },
          homeAdvantage: {
            homeWinRate: 0.68,
            awayWinRate: 0.40,
            homeAwayWinDelta: 0.28,
            homeAwayGoalsScoredDelta: 0.9,
            homeAwayGoalsConcededDelta: -0.2,
          },
        } as any;
      }
      if (name === 'Chelsea') {
        return {
          totalMatches: 1200,
          homeGoalsScored: 1.9,
          homeGoalsConceded: 1.1,
          awayGoalsScored: 1.3,
          awayGoalsConceded: 1.4,
          cleanSheetRateHome: 0.30,
          cleanSheetRateAway: 0.22,
          failedToScoreRateHome: 0.12,
          failedToScoreRateAway: 0.30,
          over25Rate: 0.55,
          bttsRate: 0.50,
          recentScoringTrend: 0,
          goalVariance: 1.4,
          overRates: { over15: 0.80, over25: 0.55, over35: 0.30, over45: 0.15, under15: 0.20, under25: 0.45 },
          eraWeighted: { homeGoalsScored: 1.9, homeGoalsConceded: 1.1, awayGoalsScored: 1.3, awayGoalsConceded: 1.4 },
          homeAdvantage: {
            homeWinRate: 0.60,
            awayWinRate: 0.38,
            homeAwayWinDelta: 0.22,
            homeAwayGoalsScoredDelta: 0.6,
            homeAwayGoalsConcededDelta: -0.3,
          },
        } as any;
      }
      return undefined;
    });

    vi.mocked(getPairStats).mockReturnValue({
      totalMatches: 60,
      homeWins: 28,
      draws: 16,
      awayWins: 16,
      avgHomeGoals: 1.7,
      avgAwayGoals: 1.1,
      avgTotalGoals: 2.8,
      over25Rate: 0.58,
      over35Rate: 0.32,
      bttsRate: 0.55,
      recentTenAvgTotal: 2.9,
      historicalVariance: 1.5,
      isDerby: false,
      biggestMargins: {
        biggestHomeWin: { score: '5-0', margin: 5, season: '2017/18' },
        biggestAwayWin: { score: '0-3', margin: 3, season: '2010/11' },
      },
    } as any);

    vi.mocked(getRefereeStats).mockReturnValue({
      matches: 220,
      avgGoalsPerMatch: 2.8,
      goalsVsLeagueAvg: 0.15,
      homeWinRate: 0.46,
      drawRate: 0.24,
      awayWinRate: 0.30,
      over25Rate: 0.57,
      bttsRate: 0.52,
      avgYellowsPerMatch: 4.1,
    } as any);

    vi.mocked(getMatchdayStats).mockReturnValue({
      matches: 33 * 10,
      avgTotalGoals: 2.1,
      homeWinRate: 0.44,
      drawRate: 0.26,
      awayWinRate: 0.30,
      over25Rate: 0.42,
    } as any);

    const match = makeMatch({
      matchday: 38,
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      referee: 'Michael Oliver',
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(38);
    await act();
    await (component as any).predictGameweek();
    await act();

    const block = screen.getByTestId('historical-context');
    expect(block).toBeInTheDocument();

    // All 5 rows present with expected distinguishing values.
    expect(block).toHaveTextContent(/Arsenal at home:.*68%.*2\.4 goals\/match.*clean sheets in 35%/);
    expect(block).toHaveTextContent(/Chelsea away:.*38%.*1\.3 goals\/match.*clean sheets in 22%/);
    expect(block).toHaveTextContent(/Historically:.*2\.8 goals\/game.*58% over 2\.5.*biggest Arsenal 5-0 Chelsea.*2017\/18/);
    expect(block).toHaveTextContent(/Michael Oliver:.*2\.8 goals\/match.*4\.1 yellows.*high tempo/);
    expect(block).toHaveTextContent(/Gameweek 38 avg:.*2\.1 goals.*42% over 2\.5/);
  });

  it('P12c — gracefully skips rows when stats pack has no data (newly promoted team)', async () => {
    const { getTeamProfile, getPairStats, getRefereeStats, getMatchdayStats } =
      await import('$lib/data/statsPack');

    // Only Arsenal has a profile; the newly-promoted side returns undefined.
    vi.mocked(getTeamProfile).mockImplementation((name: string) => {
      if (name === 'Arsenal') {
        return {
          totalMatches: 1200,
          homeGoalsScored: 2.4,
          homeGoalsConceded: 1.0,
          awayGoalsScored: 1.5,
          awayGoalsConceded: 1.2,
          cleanSheetRateHome: 0.35,
          cleanSheetRateAway: 0.20,
          failedToScoreRateHome: 0.08,
          failedToScoreRateAway: 0.25,
          over25Rate: 0.58,
          bttsRate: 0.52,
          recentScoringTrend: 0,
          goalVariance: 1.6,
          overRates: { over15: 0.82, over25: 0.58, over35: 0.35, over45: 0.18, under15: 0.18, under25: 0.42 },
          eraWeighted: { homeGoalsScored: 2.4, homeGoalsConceded: 1.0, awayGoalsScored: 1.5, awayGoalsConceded: 1.2 },
          homeAdvantage: {
            homeWinRate: 0.68,
            awayWinRate: 0.40,
            homeAwayWinDelta: 0.28,
            homeAwayGoalsScoredDelta: 0.9,
            homeAwayGoalsConcededDelta: -0.2,
          },
        } as any;
      }
      return undefined;
    });
    vi.mocked(getPairStats).mockReturnValue(undefined);
    vi.mocked(getRefereeStats).mockReturnValue(undefined);
    vi.mocked(getMatchdayStats).mockReturnValue(undefined);

    const match = makeMatch({
      matchday: 20,
      home_team: 'Arsenal',
      away_team: 'Luton',
      referee: null,
    });
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([match]);

    const { component } = render(Predictions);
    await (component as any).loadGameweekMatches(20);
    await act();
    await (component as any).predictGameweek();
    await act();

    const block = screen.getByTestId('historical-context');
    expect(block).toBeInTheDocument();
    // Home venue row renders; the rest are absent.
    expect(block).toHaveTextContent(/Arsenal at home/);
    expect(block).not.toHaveTextContent(/Luton away/);
    expect(block).not.toHaveTextContent(/Historically/);
    expect(block).not.toHaveTextContent(/Gameweek 20 avg/);
    // No undefined leaks into the DOM.
    expect(block.innerHTML).not.toContain('undefined');
    expect(block.innerHTML).not.toContain('NaN');
  });
});
