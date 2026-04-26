import { act, fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { navigate } from 'svelte-routing';
import Standings from './Standings.svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

vi.mock('../../services/dataService', () => ({
  dataService: {
    getStandings: vi.fn().mockResolvedValue([]),
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([]),
    getLastFetched: vi.fn().mockReturnValue(null),
  },
}));

const mkStanding = (
  position: number,
  name = `Team ${position}`,
  form: string | null = 'WWLDW',
) => ({
  position,
  team: {
    id: position,
    name,
    shortName: name.slice(0, 8),
    tla: name.slice(0, 3).toUpperCase(),
    crest: '',
  },
  playedGames: 30,
  form,
  won: 18,
  draw: 6,
  lost: 6,
  points: 60,
  goalsFor: 55,
  goalsAgainst: 30,
  goalDifference: 25,
});

const mkMatch = (id: string, home: string, away: string, dateIso: string) => ({
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

describe('Standings (Fixtures Standings screen)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-screen="fixtures-standings"] root unconditionally', () => {
    const { container } = render(Standings);
    expect(container.querySelector('[data-screen="fixtures-standings"]')).toBeTruthy();
  });

  it('renders one [data-standings-row] per standing after load', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      Array.from({ length: 20 }, (_, i) => mkStanding(i + 1)),
    );
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-standings-row]')).toHaveLength(20);
  });

  it('AUTO ASSERTION: each row has exactly 13 [data-col] cells (Pos · Crest · Team · P · W · D · L · GF · GA · GD · Pts · Form · PPG)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1),
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    const row = container.querySelector('[data-standings-row]');
    expect(row?.querySelectorAll('[data-col]')).toHaveLength(13);
  });

  it('AUTO ASSERTION: UCL/UEL/relegation rows expose data-zone + matching bg-* class', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1),
      mkStanding(4),
      mkStanding(5),
      mkStanding(20),
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    const rows = container.querySelectorAll('[data-standings-row]');
    expect(rows[0].getAttribute('data-zone')).toBe('ucl');
    expect(rows[0].className).toContain('bg-accent/8');
    expect(rows[1].getAttribute('data-zone')).toBe('ucl');
    expect(rows[2].getAttribute('data-zone')).toBe('uel');
    expect(rows[2].className).toContain('bg-accent/4');
    expect(rows[3].getAttribute('data-zone')).toBe('relegation');
    expect(rows[3].className).toContain('bg-destructive/6');
  });

  it("AUTO ASSERTION: each row's Form column contains exactly 5 form indicators (FormDot or pending)", async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1, 'Established', 'WWLDW'),
      mkStanding(2, 'New club', null),
      mkStanding(3, 'Mid-season', 'WL'),
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    const rows = container.querySelectorAll('[data-standings-row]');
    rows.forEach((r) => {
      const formCol = r.querySelector('[data-col="form"]');
      expect(formCol?.querySelectorAll('[data-form-indicator]')).toHaveLength(5);
    });
  });

  it('navigates to /match/[next-fixture-id] when a row is clicked', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1, 'Liverpool FC'),
    ]);
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkMatch(
        'm-next',
        'Liverpool FC',
        'Arsenal FC',
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    ]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    await fireEvent.click(container.querySelector('[data-standings-row]')!);
    expect(navigate).toHaveBeenCalledWith('/match/m-next');
  });

  it('does NOT navigate when a row has no upcoming fixture (next-id is null)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getStandings as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      mkStanding(1, 'Solo Team'),
    ]);
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { container, component } = render(Standings);
    await (component as { load(): Promise<void> }).load();
    await act();
    await fireEvent.click(container.querySelector('[data-standings-row]')!);
    expect(navigate).not.toHaveBeenCalled();
  });
});
