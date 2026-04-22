import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/svelte';
import AccumulatorBuilder from './AccumulatorBuilder.svelte';
import { dataService } from '../../services/dataService';
import { betHistoryService } from '../../services/betting/betHistoryService';
import type { Match } from '../../types';

// Mock dataService — includes the calls used by both `loadMatches` (existing
// manual-builder combos) and `buildAutoAccumulators` (new auto-build path).
vi.mock('../../services/dataService', () => ({
  dataService: {
    getMatches: vi.fn(() => Promise.resolve([])),
    getCurrentSeason: vi.fn(() => Promise.resolve({ currentMatchday: 20 })),
    getCurrentSeasonMatches: vi.fn(() => Promise.resolve([])),
  }
}));

// Mock OptimizedPredictor — used by buildAutoAccumulators.
// Tests override this per-case via vi.mocked(OptimizedPredictor.predictMatch).
vi.mock('../../lib/optimizedPredictions', () => ({
  OptimizedPredictor: {
    predictMatch: vi.fn(() => Promise.resolve({
      predictedResult: 'H',
      confidence: 0.55,
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      homeForm: 'WWDLW',
      awayForm: 'LDWWL',
      modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
      insights: [],
      valueOdds: { home: 1.85, draw: 3.50, away: 4.20 },
    }))
  }
}));

// Mock BetBuilderPredictor
const mockGenerateBetBuilder = vi.fn(() => Promise.resolve({
  matchId: '1',
  homeTeam: 'Arsenal',
  awayTeam: 'Liverpool',
  matchResult: {
    prediction: 'H',
    homeWinProb: 0.55,
    drawProb: 0.25,
    awayWinProb: 0.20,
    confidence: 0.55
  },
  bothTeamsToScore: { prediction: true, yesProb: 0.62, noProb: 0.38, confidence: 0.62 },
  totalGoals: {
    over25: { prediction: true, probability: 0.68 },
    over35: { prediction: false, probability: 0.35 },
    under25: { prediction: false, probability: 0.32 },
    under35: { prediction: true, probability: 0.65 },
    exactGoals: { 0: 0.05, 1: 0.12, 2: 0.22, 3: 0.25, 4: 0.18, 5: 0.10 }
  },
  corners: {
    totalOver85: { prediction: true, probability: 0.65 },
    totalOver95: { prediction: false, probability: 0.45 },
    totalOver105: { prediction: false, probability: 0.30 }
  },
  cards: {
    totalOver25: { prediction: true, probability: 0.70 },
    totalOver35: { prediction: false, probability: 0.40 },
    totalOver45: { prediction: false, probability: 0.20 }
  },
  halfTimeResult: { prediction: 'D', homeWinProb: 0.30, drawProb: 0.45, awayWinProb: 0.25 },
  cleanSheets: {
    homeCleanSheet: { prediction: false, probability: 0.30 },
    awayCleanSheet: { prediction: false, probability: 0.25 },
    bothCleanSheets: { prediction: false, probability: 0.08 }
  },
  suggestedCombos: [
    {
      name: 'Safe Builder',
      selections: ['Home Win', 'Over 2.5 Goals'],
      combinedOdds: 3.25,
      confidence: 0.62,
      reasoning: 'Arsenal strong at home with high-scoring trend.'
    },
    {
      name: 'Value Builder',
      selections: ['Home Win', 'BTTS Yes', 'Over 2.5 Goals'],
      combinedOdds: 5.80,
      confidence: 0.45,
      reasoning: 'Both sides score frequently in this fixture.'
    }
  ]
}));

vi.mock('../../lib/betBuilder', () => ({
  BetBuilderPredictor: {
    generateBetBuilder: () => mockGenerateBetBuilder()
  }
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
    Layers: stub, RefreshCw: stub, Trash2: stub, BookmarkPlus: stub,
    Check: stub, AlertTriangle: stub, ChevronDown: stub, ChevronUp: stub,
    Shield: stub, TrendingUp: stub, Flame: stub
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

/** Render + call the exported loadMatches() to bypass onMount timing issues */
async function renderAndLoad(matches: Match[] = []) {
  vi.mocked(dataService.getMatches).mockResolvedValue(matches);
  const { component } = render(AccumulatorBuilder);
  await act(async () => {
    await (component as any).loadMatches();
  });
  return component;
}

describe('AccumulatorBuilder Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataService.getMatches).mockResolvedValue([]);
  });

  it('should render the component container', () => {
    render(AccumulatorBuilder);
    expect(screen.getByTestId('accumulator-builder')).toBeInTheDocument();
  });

  it('should show the header text', () => {
    render(AccumulatorBuilder);
    expect(screen.getByText('Accumulator Builder')).toBeInTheDocument();
    expect(screen.getByText(/Pre-built combos and custom accumulator/)).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    vi.mocked(dataService.getMatches).mockReturnValue(new Promise(() => {}));
    render(AccumulatorBuilder);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByText(/Analysing upcoming matches/)).toBeInTheDocument();
  });

  it('should show empty state when no matches have combos', async () => {
    await renderAndLoad([]);
    expect(screen.getByText(/No upcoming matches with combo suggestions/)).toBeInTheDocument();
  });

  it('should show match cards when matches have combos', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    expect(screen.getByText('Liverpool')).toBeInTheDocument();
    expect(screen.getByText(/2 combo/)).toBeInTheDocument();
  });

  it('should show match count footer', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);
    expect(screen.getByText(/Showing combos for 1 upcoming match/)).toBeInTheDocument();
  });

  it('should expand match to show combo details when clicked', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    // The match header is a button containing team names
    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    expect(matchHeader).toBeTruthy();
    await fireEvent.click(matchHeader!);

    expect(screen.getByText('Safe Builder')).toBeInTheDocument();
    expect(screen.getByText('Value Builder')).toBeInTheDocument();
    expect(screen.getByText('@3.25')).toBeInTheDocument();
    expect(screen.getByText('@5.80')).toBeInTheDocument();
  });

  it('should show combo reasoning and confidence when expanded', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    expect(screen.getByText('Arsenal strong at home with high-scoring trend.')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
  });

  it('should show individual selection buttons when combo expanded', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const homeWinButtons = screen.getAllByText(/Home Win/);
    expect(homeWinButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('should show "Add full combo to accumulator" links', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const addButtons = screen.getAllByText(/Add full combo to accumulator/);
    expect(addButtons.length).toBe(2);
  });

  it('should add combo to accumulator when "Add full combo" is clicked', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const addButtons = screen.getAllByText(/Add full combo to accumulator/);
    await fireEvent.click(addButtons[0]);

    expect(screen.getByTestId('custom-accumulator')).toBeInTheDocument();
    expect(screen.getByText('Your Accumulator')).toBeInTheDocument();
    expect(screen.getByText(/1 leg/)).toBeInTheDocument();
  });

  it('should show combined odds and probability in accumulator panel', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const addButtons = screen.getAllByText(/Add full combo to accumulator/);
    await fireEvent.click(addButtons[0]);

    expect(screen.getByText('Combined Odds')).toBeInTheDocument();
    expect(screen.getByText('Win Prob')).toBeInTheDocument();
    expect(screen.getByText('Expected Value')).toBeInTheDocument();
  });

  it('should show Track Bet button for suggested combos', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const trackButtons = screen.getAllByText('Track Bet');
    expect(trackButtons.length).toBe(2);
  });

  it('should call betHistoryService.storeBet when Track Bet clicked on a combo', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const trackButtons = screen.getAllByText('Track Bet');
    await fireEvent.click(trackButtons[0]);

    expect(betHistoryService.storeBet).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: '1',
        market: 'combo',
        selection: 'Home Win + Over 2.5 Goals',
        odds: 3.25,
        confidence: 0.62
      })
    );
  });

  it('should show "Tracked" state after tracking a combo', async () => {
    const match = makeUpcomingMatch();
    await renderAndLoad([match]);

    const matchButtons = screen.getAllByRole('button');
    const matchHeader = matchButtons.find(b => b.textContent?.includes('Arsenal'));
    await fireEvent.click(matchHeader!);

    const trackButtons = screen.getAllByText('Track Bet');
    await fireEvent.click(trackButtons[0]);

    const trackedLabels = screen.getAllByText('Tracked');
    expect(trackedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('should show error state when API fails', async () => {
    vi.mocked(dataService.getMatches).mockRejectedValue(new Error('Network error'));
    const { component } = render(AccumulatorBuilder);
    await act(async () => {
      await (component as any).loadMatches();
    });

    expect(screen.getByText(/Failed to load upcoming matches/)).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should have a refresh button', () => {
    render(AccumulatorBuilder);
    expect(screen.getByLabelText('Refresh suggestions')).toBeInTheDocument();
  });

  describe('Auto-built accumulators', () => {
    /**
     * Helper — seed dataService + OptimizedPredictor mocks with N upcoming
     * matches, each with a per-index confidence level (for testing the
     * Safe / Risky / Favourites split).
     */
    async function renderWithAutoBuild(predictions: Array<{ confidence: number; result?: 'H' | 'D' | 'A' }>) {
      const { OptimizedPredictor } = await import('../../lib/optimizedPredictions');
      const matches: Match[] = predictions.map((_, i) =>
        makeUpcomingMatch({
          id: `auto_${i + 1}`,
          home_team: `Home${i + 1}`,
          away_team: `Away${i + 1}`,
          matchday: 20,
        })
      );
      vi.mocked(dataService.getCurrentSeason).mockResolvedValue({ currentMatchday: 20 } as any);
      vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(matches);
      vi.mocked(dataService.getMatches).mockResolvedValue(matches);

      let callIndex = 0;
      vi.mocked(OptimizedPredictor.predictMatch).mockImplementation(async () => {
        const idx = Math.min(callIndex++, predictions.length - 1);
        const p = predictions[idx];
        return {
          predictedResult: (p.result ?? 'H') as 'H' | 'D' | 'A',
          confidence: p.confidence,
          predictedHomeGoals: 2,
          predictedAwayGoals: 1,
          homeForm: 'WWDLW',
          awayForm: 'LDWWL',
          modelWeights: { elo: 0.25, poisson: 0.30, form: 0.20, h2h: 0.10, standings: 0.15 },
          insights: [],
          valueOdds: { home: 1 / p.confidence, draw: 3.5, away: 4.2 },
        } as any;
      });

      const { component } = render(AccumulatorBuilder);
      await act(async () => {
        await (component as any).buildAutoAccumulators();
      });
      return component;
    }

    it('builds Safe/Risky/Favourites accumulators from the gameweek predictions', async () => {
      // 10 predictions spread across confidence bands:
      // - 4 above 0.65 (safe picks)
      // - 4 between 0.45 and 0.65 (risky picks)
      // - 2 below 0.45 (still eligible for favourites)
      await renderWithAutoBuild([
        { confidence: 0.82 }, { confidence: 0.77 }, { confidence: 0.72 }, { confidence: 0.68 },
        { confidence: 0.60 }, { confidence: 0.55 }, { confidence: 0.50 }, { confidence: 0.47 },
        { confidence: 0.42 }, { confidence: 0.38 },
      ]);

      // All three preset cards should render via the accent-keyed test IDs.
      expect(screen.getByTestId('auto-accumulator-card-emerald')).toBeInTheDocument();
      expect(screen.getByTestId('auto-accumulator-card-amber')).toBeInTheDocument();
      expect(screen.getByTestId('auto-accumulator-card-red')).toBeInTheDocument();

      // Section headings present (each card has the builder name in emerald/amber/red text).
      expect(screen.getByText('Safe Builder')).toBeInTheDocument();
      expect(screen.getByText('Risky Builder')).toBeInTheDocument();
      expect(screen.getByText('Favourites Accumulator')).toBeInTheDocument();

      // Favourites Accumulator includes all 10 fixtures.
      expect(screen.getByText(/10 games/)).toBeInTheDocument();
    });

    it('"Use this" on an auto-accumulator loads legs into the manual builder', async () => {
      await renderWithAutoBuild([
        { confidence: 0.80 }, { confidence: 0.75 }, { confidence: 0.70 },
        { confidence: 0.55 }, { confidence: 0.50 },
      ]);

      // Click "Use this" on the emerald (Safe) accumulator.
      const useBtn = screen.getByTestId('auto-accumulator-use-emerald');
      await fireEvent.click(useBtn);

      // The manual "Your Accumulator" section should now render with legs.
      // It's gated on accumulatorLegs.length > 0, so its data-testid appears.
      expect(screen.getByTestId('custom-accumulator')).toBeInTheDocument();
      expect(screen.getByText('Your Accumulator')).toBeInTheDocument();
    });
  });
});
