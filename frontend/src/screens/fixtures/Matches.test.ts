import { act, fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Matches from './Matches.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
    getLastFetched: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

const mkUpcomingMatch = (
  id: string,
  dateIso: string,
  home = 'Liverpool FC',
  away = 'Arsenal FC',
) => ({
  id,
  season_id: '2025-26',
  date: dateIso,
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
  created_at: new Date().toISOString(),
});

describe('Matches (Fixtures Matches screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-screen="fixtures-matches"] root unconditionally', () => {
    const { container } = render(Matches);
    expect(container.querySelector('[data-screen="fixtures-matches"]')).toBeTruthy();
  });

  it('renders FilterChips with "all" active by default', () => {
    const { container } = render(Matches);
    const allChip = container.querySelector('[data-chip="all"]');
    expect(allChip?.getAttribute('aria-pressed')).toBe('true');
  });

  it('groups matches by date — one [data-fixture-group] per unique date', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', '2026-04-12T15:00:00Z'),
      mkUpcomingMatch('m2', '2026-04-12T17:30:00Z'),
      mkUpcomingMatch('m3', '2026-04-13T20:00:00Z'),
    ]);
    const { container, component } = render(Matches);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-fixture-group]')).toHaveLength(2);
    // Each MatchCard renders one [data-block="center"] (P1a contract); use it for one-per-card counting.
    expect(container.querySelectorAll('[data-block="center"]')).toHaveLength(3);
  });

  it('filters to Top 6 fixtures only when "top6" chip is selected', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', '2026-04-12T15:00:00Z', 'Liverpool FC', 'Arsenal FC'),
      mkUpcomingMatch('m2', '2026-04-12T17:30:00Z', 'Brentford FC', 'Burnley FC'),
      mkUpcomingMatch('m3', '2026-04-13T20:00:00Z', 'Chelsea FC', 'Crystal Palace FC'),
    ]);
    const { container, component } = render(Matches);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-block="center"]')).toHaveLength(3);

    await fireEvent.click(container.querySelector('[data-chip="top6"]')!);
    await act();
    expect(container.querySelectorAll('[data-block="center"]')).toHaveLength(2);
  });

  it('shows [data-matches-empty] copy when filter results in zero matches', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', '2026-04-12T15:00:00Z', 'Brentford FC', 'Burnley FC'),
    ]);
    const { container, component } = render(Matches);
    await (component as { load(): Promise<void> }).load();
    await act();

    await fireEvent.click(container.querySelector('[data-chip="top6"]')!);
    await act();
    expect(container.querySelector('[data-matches-empty]')).toBeTruthy();
  });
});
