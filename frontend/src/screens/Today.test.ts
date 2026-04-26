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
