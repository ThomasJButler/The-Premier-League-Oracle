import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import SeasonStats from './SeasonStats.svelte';
import { dataService } from '../services/dataService';
import type { Match } from '../types';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn(),
    getStandings: vi.fn().mockResolvedValue([]),
    getTopScorers: vi.fn().mockResolvedValue([]),
  },
}));

// Mock lucide-svelte
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
        root: opts?.target || document.createElement('div'),
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return {
    Calendar: stub, Target: stub, TrendingUp: stub, Award: stub,
    Users: stub, Zap: stub, Shield: stub, AlertTriangle: stub,
    Percent: stub, Activity: stub, Timer: stub, Home: stub,
    BarChart3: stub, Trophy: stub, Crosshair: stub, ArrowDownUp: stub,
    Flame: stub, Swords: stub,
  };
});

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '1',
    season_id: 's1',
    date: '2026-01-15T15:00:00Z',
    home_team: 'Arsenal FC',
    away_team: 'Chelsea FC',
    home_goals: 2,
    away_goals: 1,
    result: 'H',
    home_odds: null,
    draw_odds: null,
    away_odds: null,
    first_half_home_goals: 1,
    first_half_away_goals: 0,
    full_time_result: 'H',
    half_time_result: 'H',
    referee: 'Michael Oliver',
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
    created_at: '2026-01-15T00:00:00Z',
    status: 'FINISHED',
    ...overrides,
  };
}

describe('SeasonStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([]);
    render(SeasonStats);
    expect(screen.getByText('Season Stats')).toBeInTheDocument();
  });

  it('shows loading skeleton cards initially', () => {
    // Return a promise that never resolves so the component stays in loading state
    vi.mocked(dataService.getCurrentSeasonMatches).mockReturnValue(new Promise(() => {}));
    render(SeasonStats);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(6);
  });

  it('shows error message on load failure', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockRejectedValue(new Error('API error'));
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    expect(screen.getByText(/Unable to load season statistics/)).toBeInTheDocument();
  });

  it('renders stat cards after successful load', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch(),
      makeMatch({ id: '2', home_team: 'Liverpool FC', away_team: 'Tottenham FC', home_goals: 3, away_goals: 0, result: 'H' }),
      makeMatch({ id: '3', home_team: 'Man City FC', away_team: 'Brighton FC', home_goals: 1, away_goals: 1, result: 'D' }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    expect(screen.getByText('Average Goals')).toBeInTheDocument();
    expect(screen.getByText('Win Streak')).toBeInTheDocument();
    expect(screen.getByText('Home Fortress')).toBeInTheDocument();
  });

  it('calculates average goals per match correctly', async () => {
    // 2+1=3, 3+0=3, 1+1=2 → total 8, avg 8/3 = 2.67
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({ id: '1', home_goals: 2, away_goals: 1, result: 'H' }),
      makeMatch({ id: '2', home_goals: 3, away_goals: 0, result: 'H' }),
      makeMatch({ id: '3', home_goals: 1, away_goals: 1, result: 'D' }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    expect(screen.getByText('2.67')).toBeInTheDocument();
  });

  it('detects biggest comeback from halftime deficit', async () => {
    // Home team trailing 0-2 at HT, wins 3-2
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({
        id: '1',
        home_team: 'Arsenal FC',
        away_team: 'Chelsea FC',
        first_half_home_goals: 0,
        first_half_away_goals: 2,
        home_goals: 3,
        away_goals: 2,
        result: 'H',
        half_time_result: 'A',
        full_time_result: 'H',
      }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    expect(screen.getByText('Arsenal FC (2 goals)')).toBeInTheDocument();
  });

  it('counts second-half turnarounds correctly', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      // HT: H, FT: A → turnaround
      makeMatch({ id: '1', half_time_result: 'H', full_time_result: 'A', result: 'A' }),
      // HT: H, FT: H → no turnaround
      makeMatch({ id: '2', half_time_result: 'H', full_time_result: 'H', result: 'H' }),
      // HT: D, FT: H → turnaround
      makeMatch({ id: '3', half_time_result: 'D', full_time_result: 'H', result: 'H' }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    expect(screen.getByText('2 matches')).toBeInTheDocument();
  });

  it('shows N/A for card data when free tier returns null', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({ home_yellows: null, away_yellows: null, home_reds: null, away_reds: null }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    // The Most Cards stat should show N/A
    const naElements = screen.queryAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('handles empty matches array gracefully', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    // Should not crash — the calculation functions only run when matches.length > 0
    expect(screen.getByText('Season Stats')).toBeInTheDocument();
  });

  it('renders extended analytics section', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({ id: '1', result: 'H', home_goals: 2, away_goals: 1 }),
      makeMatch({ id: '2', result: 'D', home_goals: 1, away_goals: 1 }),
      makeMatch({ id: '3', result: 'A', home_goals: 0, away_goals: 3, home_team: 'Liverpool FC', away_team: 'Man City FC' }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    expect(screen.getByText('Extended Analytics')).toBeInTheDocument();
    expect(screen.getByText('Clean Sheets Leader')).toBeInTheDocument();
    expect(screen.getByText('Draw Rate')).toBeInTheDocument();
    expect(screen.getByText('BTTS Rate')).toBeInTheDocument();
    expect(screen.getByText('Over 2.5 Goals')).toBeInTheDocument();
  });

  it('calculates draw rate percentage correctly', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({ id: '1', result: 'D', home_goals: 1, away_goals: 1 }),
      makeMatch({ id: '2', result: 'H', home_goals: 2, away_goals: 0 }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    // 1 draw out of 2 matches = 50.0% (away win rate also 50% — use getAllByText)
    const fiftyPercent = screen.getAllByText('50.0%');
    expect(fiftyPercent.length).toBeGreaterThan(0);
  });

  it('identifies longest winning streak', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({ id: '1', home_team: 'Arsenal FC', away_team: 'Chelsea FC', result: 'H' }),
      makeMatch({ id: '2', home_team: 'Arsenal FC', away_team: 'Liverpool FC', result: 'H' }),
      makeMatch({ id: '3', home_team: 'Brighton FC', away_team: 'Arsenal FC', result: 'A' }),
    ]);
    const { component } = render(SeasonStats);
    await (component as any).loadSeasonStats();
    await act();
    // Appears in both Win Streak (primary) and Unbeaten Run (extended) cards
    const streakElements = screen.getAllByText('Arsenal FC (3)');
    expect(streakElements.length).toBeGreaterThan(0);
  });

  it('shows the "Did you know" footer', () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([makeMatch()]);
    render(SeasonStats);
    // Footer is outside the loading/error/loaded conditional — always rendered
    expect(screen.getByText(/Did you know/)).toBeInTheDocument();
  });

  it('surfaces the COVID 2020/21 anomaly when that historical season is selected', async () => {
    // Historical mode reads synchronously from the stats pack — it must not
    // hit the live API, and the anomaly banner proves the multi-season plumbing works.
    const { component } = render(SeasonStats, { props: { selectedSeason: '2020/21' } });
    await (component as any).loadSeasonStats();
    await act();
    expect(dataService.getCurrentSeasonMatches).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: /anomalous season/i })).toBeInTheDocument();
    expect(screen.getByText('Anomalous season')).toBeInTheDocument();
    // 2020/21 reasons reference home/away win rate shifts vs the 33-season mean
    expect(screen.getByText(/homeWinRate .* vs 33-season mean/)).toBeInTheDocument();
  });
});
