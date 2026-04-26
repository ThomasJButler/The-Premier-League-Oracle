import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/svelte';
import Today from './Today.svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

vi.mock('../services/dataService', () => {
  const mockMatch = {
    id: '1',
    season_id: 's-1',
    date: '2026-05-01T15:00:00Z',
    home_team: 'Liverpool',
    away_team: 'Arsenal',
    home_goals: null,
    away_goals: null,
    result: null,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: null,
    half_time_result: null,
    referee: null,
    home_shots: null,
    away_shots: null,
    home_shots_target: null,
    away_shots_target: null,
    home_fouls: null,
    away_fouls: null,
    home_corners: null,
    away_corners: null,
    home_yellows: null,
    away_yellows: null,
    home_reds: null,
    away_reds: null,
    created_at: '2026-04-26T00:00:00Z',
    status: 'SCHEDULED',
    matchday: 35,
  };
  return {
    dataService: {
      getCurrentSeasonMatches: vi.fn().mockResolvedValue([mockMatch]),
      getLastFetched: vi.fn().mockReturnValue(Date.now()),
    },
  };
});

vi.mock('../services/predictionTracker', () => {
  const mockStored = {
    id: 'p-1',
    matchId: '1',
    homeTeam: 'Liverpool',
    awayTeam: 'Arsenal',
    predictedResult: 'H' as const,
    predictedHomeGoals: 2,
    predictedAwayGoals: 0,
    confidence: 0.62,
    timestamp: '2026-04-26T10:00:00Z',
    matchDate: '2026-05-01T15:00:00Z',
    matchday: 35,
    poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.2 },
  };
  return {
    predictionTracker: {
      getAccuracyStats: vi.fn().mockReturnValue({
        totalPredictions: 12,
        correctPredictions: 8,
        accuracy: 67,
        brierScore: 0,
        averageConfidence: 0.55,
        scoreAccuracy: 0,
        highConfidenceAccuracy: 0,
        mediumConfidenceAccuracy: 0,
        lowConfidenceAccuracy: 0,
        homeWinAccuracy: 0,
        awayWinAccuracy: 0,
        drawAccuracy: 0,
        streak: { current: 0, best: 0, worst: 0 },
      }),
      getRecentPredictions: vi.fn().mockReturnValue([]),
      getAccuracyByGameweek: vi.fn().mockReturnValue([]),
      getMatchPredictions: vi.fn().mockReturnValue([mockStored]),
    },
  };
});

describe('Today screen — P2a skeleton', () => {
  it('renders the command strip immediately (independent of data load)', () => {
    const { container } = render(Today);
    expect(container.querySelector('[data-command-strip]')).toBeTruthy();
  });

  it('renders the resolved gameweek after load', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.textContent).toContain('GW 35');
  });

  it('renders the hero match as an emphasised MatchCard with analyse open by default', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const hero = container.querySelector('[data-zone="hero"]');
    expect(hero).toBeTruthy();
    expect(hero?.innerHTML).toMatch(/shadow-emphasised/);
    const analyse = hero?.querySelector('[data-section="analyse"] button');
    expect(analyse?.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders an empty hero placeholder when no upcoming fixtures exist', async () => {
    const { dataService } = await import('../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-zone="hero-empty"]')).toBeTruthy();
  });
});

describe('Today screen — P2b KPI strip', () => {
  it('renders four KPI tiles with the expected labels', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const strip = container.querySelector('[data-zone="kpi-strip"]');
    expect(strip).toBeTruthy();
    expect(strip!.textContent).toContain('Picks');
    expect(strip!.textContent).toContain('Accuracy');
    expect(strip!.textContent).toContain('Brier');
    expect(strip!.textContent).toContain('Avg Confidence');
  });

  it('highlights the Brier tile when brierScore is above the threshold', async () => {
    const { predictionTracker } = await import('../services/predictionTracker');
    (predictionTracker.getAccuracyStats as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      totalPredictions: 12,
      correctPredictions: 8,
      accuracy: 67,
      brierScore: 0.6, // poor — above 0.25 threshold
      averageConfidence: 0.55,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0,
      mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0,
      awayWinAccuracy: 0,
      drawAccuracy: 0,
      streak: { current: 0, best: 0, worst: 0 },
    });
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const brierTile = container.querySelector('[data-tile="brier"]');
    expect(brierTile?.getAttribute('data-state')).toBe('highlight');
  });
});

describe('Today screen — P2b predictions grid', () => {
  // Internal `Match` shape (frontend/src/types/index.ts) — matches the
  // top-of-file `mockMatch` factory inside `vi.mock('../services/dataService', …)`.
  const mkMatch = (id: string, home: string, away: string, date: string) => ({
    id,
    season_id: 's-1',
    date,
    home_team: home,
    away_team: away,
    home_goals: null,
    away_goals: null,
    result: null,
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: null,
    half_time_result: null,
    referee: null,
    home_shots: null,
    away_shots: null,
    home_shots_target: null,
    away_shots_target: null,
    home_fouls: null,
    away_fouls: null,
    home_corners: null,
    away_corners: null,
    home_yellows: null,
    away_yellows: null,
    home_reds: null,
    away_reds: null,
    created_at: '2026-04-26T00:00:00Z',
    status: 'SCHEDULED' as const,
    matchday: 35,
  });

  it('renders standard MatchCards for remaining gameweek fixtures (excluding the hero)', async () => {
    const { dataService } = await import('../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkMatch('1', 'Liverpool', 'Arsenal', '2026-05-01T15:00:00Z'),
      mkMatch('2', 'Chelsea', 'Man Utd', '2026-05-02T17:30:00Z'),
      mkMatch('3', 'Spurs', 'Everton', '2026-05-03T15:00:00Z'),
    ]);
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const grid = container.querySelector('[data-zone="grid"]');
    expect(grid).toBeTruthy();
    // 3 fixtures total, 1 in hero → 2 in grid
    expect(grid!.querySelectorAll('article').length).toBe(2);
  });

  it('renders an empty-state hint when there are no remaining fixtures beyond the hero', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    // P2a default mock has 1 fixture only → grid empty
    expect(container.querySelector('[data-zone="grid-empty"]')).toBeTruthy();
  });
});

describe('Today screen — P2c below-fold', () => {
  it('renders the model-trends section header and Spark', async () => {
    const { predictionTracker } = await import('../services/predictionTracker');
    (predictionTracker.getAccuracyByGameweek as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { matchday: 32, totalPredictions: 8, correctPredictions: 5, accuracy: 62 },
      { matchday: 33, totalPredictions: 9, correctPredictions: 6, accuracy: 67 },
      { matchday: 34, totalPredictions: 10, correctPredictions: 7, accuracy: 70 },
    ]);
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const trends = container.querySelector('[data-zone="trends"]');
    expect(trends).toBeTruthy();
    expect(trends!.textContent).toMatch(/MODEL TRENDS/);
    expect(trends!.querySelector('svg')).toBeTruthy();
  });

  it('renders five MatchRow entries when getRecentPredictions returns five', async () => {
    const { predictionTracker } = await import('../services/predictionTracker');
    (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i}`,
        matchId: String(100 + i),
        homeTeam: 'Liverpool',
        awayTeam: 'Arsenal',
        predictedResult: 'H' as const,
        predictedHomeGoals: 2,
        predictedAwayGoals: 0,
        confidence: 0.6,
        actualResult: 'H' as const,
        actualHomeGoals: 2,
        actualAwayGoals: 0,
        isCorrect: true,
        timestamp: '2026-04-26T10:00:00Z',
        matchDate: `2026-04-${20 + i}T19:00:00Z`,
        matchday: 34,
        poissonProbs: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
      })),
    );
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const log = container.querySelector('[data-zone="log"]');
    expect(log).toBeTruthy();
    // Each settled MatchRow renders a [data-hit] cell on the right (MatchRow.svelte:54-57)
    expect(log!.querySelectorAll('[data-hit]').length).toBe(5);
  });

  it('renders an empty-state when getRecentPredictions returns nothing', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    // Default mock returns [] for recent → empty state shown
    expect(container.querySelector('[data-zone="log-empty"]')).toBeTruthy();
  });
});
