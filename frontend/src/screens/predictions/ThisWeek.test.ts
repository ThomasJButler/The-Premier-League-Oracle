import { act, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThisWeek from './ThisWeek.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

// vi.mock is hoisted — factory must live INSIDE describe to safely reference values
describe('ThisWeek (Predictions This Week screen)', () => {
  const mkUpcomingMatch = (id: string, matchday: number, daysFromNow: number) => ({
    id,
    season_id: '2025-26',
    date: new Date(Date.now() + daysFromNow * 86_400_000).toISOString(),
    matchday,
    home_team: 'Liverpool FC',
    away_team: 'Arsenal FC',
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
    status: 'SCHEDULED' as const,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-screen="predictions-this-week"] root unconditionally', () => {
    const { container } = render(ThisWeek);
    expect(container.querySelector('[data-screen="predictions-this-week"]')).toBeTruthy();
  });

  it('renders [data-no-gameweek] copy when getCurrentSeasonMatches returns empty', async () => {
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-no-gameweek]')).toBeTruthy();
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(0);
  });

  it('renders one [data-card-row] per fixture in the current gameweek', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
      mkUpcomingMatch('m2', 35, 3),
      mkUpcomingMatch('m3', 35, 3),
      // Extra fixture in a different gameweek to verify the filter
      mkUpcomingMatch('m4', 36, 9),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(3);
    // MatchCard contract marker from P1a — 3 cards × 3 blocks (home/center/away) = 9
    expect(container.querySelectorAll('[data-block]')).toHaveLength(9);
    expect(container.querySelector('[data-no-gameweek]')).toBeNull();
  });

  it('renders the SectionHeader kicker with the gameweek number', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const kicker = container.querySelector('[data-kicker]');
    expect(kicker?.textContent).toContain('GAMEWEEK 35');
  });

  it('renders [Export PDF] and [Share PNG] as disabled placeholder buttons', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkUpcomingMatch('m1', 35, 2),
    ]);
    const { container, component } = render(ThisWeek);
    await (component as { load(): Promise<void> }).load();
    await act();
    const buttons = container.querySelectorAll('[data-export-placeholder]');
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => {
      expect(b.getAttribute('disabled')).not.toBeNull();
    });
    expect(Array.from(buttons).map((b) => b.textContent?.trim())).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Export PDF/i),
        expect.stringMatching(/Share PNG/i),
      ]),
    );
  });
});
