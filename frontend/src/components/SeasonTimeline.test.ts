import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import SeasonTimeline from './SeasonTimeline.svelte';
import { dataService } from '../services/dataService';
import type { Match, Standing } from '../types';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn(),
    getStandings: vi.fn(),
  },
}));

// Mock svelte-chartjs
vi.mock('svelte-chartjs', () => {
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
  return { Line: stub };
});

// Mock chart.js
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  Title: 'Title',
  Tooltip: 'Tooltip',
  Legend: 'Legend',
  LineElement: 'LineElement',
  LinearScale: 'LinearScale',
  CategoryScale: 'CategoryScale',
  PointElement: 'PointElement',
  Filler: 'Filler',
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
    Trophy: stub, TrendingUp: stub, AlertTriangle: stub, Flame: stub,
    Target: stub, Calendar: stub, ChevronDown: stub, ChevronUp: stub,
    Zap: stub, Shield: stub, ArrowDownUp: stub,
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
    matchday: 1,
    ...overrides,
  };
}

function makeStanding(overrides: Partial<Standing> = {}): Standing {
  return {
    position: 1,
    team: { id: 1, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: '' },
    playedGames: 20,
    form: 'WWDWW',
    won: 14,
    draw: 3,
    lost: 3,
    points: 45,
    goalsFor: 42,
    goalsAgainst: 15,
    goalDifference: 27,
    ...overrides,
  };
}

const mockTeams = [
  'Arsenal FC', 'Liverpool FC', 'Manchester City FC', 'Chelsea FC',
  'Tottenham Hotspur FC', 'Aston Villa FC', 'Newcastle United FC',
  'Brighton & Hove Albion FC', 'West Ham United FC', 'Bournemouth FC',
  'Crystal Palace FC', 'Brentford FC', 'Fulham FC', 'Wolverhampton Wanderers FC',
  'Everton FC', 'Nottingham Forest FC', 'Leicester City FC',
  'Ipswich Town FC', 'Southampton FC', 'Burnley FC',
];

function makeStandings(): Standing[] {
  return mockTeams.map((name, i) => makeStanding({
    position: i + 1,
    team: { id: i + 1, name, shortName: name.split(' ')[0], tla: name.substring(0, 3).toUpperCase(), crest: '' },
    points: 60 - i * 3,
    playedGames: 20,
  }));
}

function makeSeasonMatches(): Match[] {
  const matches: Match[] = [];
  let id = 1;
  // Generate 3 matchdays of matches between the first 6 teams
  for (let md = 1; md <= 3; md++) {
    for (let i = 0; i < mockTeams.length; i += 2) {
      matches.push(makeMatch({
        id: String(id++),
        home_team: mockTeams[i],
        away_team: mockTeams[i + 1],
        matchday: md,
        home_goals: md === 1 ? 3 : 1,
        away_goals: md === 1 ? 2 : 0,
        result: 'H',
        date: `2025-08-${10 + md}T15:00:00Z`,
      }));
    }
  }
  return matches;
}

describe('SeasonTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the page header', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(makeSeasonMatches());
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText('Season Timeline')).toBeTruthy();
    expect(screen.getByText(/The story of the/)).toBeTruthy();
  });

  it('shows loading state initially', () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockReturnValue(new Promise(() => {}));
    vi.mocked(dataService.getStandings).mockReturnValue(new Promise(() => {}));

    render(SeasonTimeline);

    // Should show skeleton cards while loading
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error when no match data available', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([]);
    vi.mocked(dataService.getStandings).mockResolvedValue([]);

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/No match data available/)).toBeTruthy();
  });

  it('shows error when no completed matches', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue([
      makeMatch({ result: null, matchday: 1 }),
    ]);
    vi.mocked(dataService.getStandings).mockResolvedValue([]);

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/No completed matches/)).toBeTruthy();
  });

  it('renders title race section with chart', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(makeSeasonMatches());
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText('Title Race')).toBeTruthy();
  });

  it('renders relegation battle section', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(makeSeasonMatches());
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText('Relegation Battle')).toBeTruthy();
  });

  it('renders key results section when thrillers exist', async () => {
    const matches = makeSeasonMatches();
    // Add a high-scoring thriller
    matches.push(makeMatch({
      id: '999',
      home_team: 'Arsenal FC',
      away_team: 'Liverpool FC',
      home_goals: 4,
      away_goals: 3,
      result: 'H',
      matchday: 2,
      date: '2025-08-12T15:00:00Z',
    }));

    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(matches);
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText('Key Results')).toBeTruthy();
  });

  it('detects comeback results', async () => {
    const matches = makeSeasonMatches();
    // Add a comeback match: losing 0-2 at half-time, winning 3-2
    matches.push(makeMatch({
      id: '888',
      home_team: 'Arsenal FC',
      away_team: 'Chelsea FC',
      first_half_home_goals: 0,
      first_half_away_goals: 2,
      home_goals: 3,
      away_goals: 2,
      result: 'H',
      matchday: 3,
      date: '2025-08-13T15:00:00Z',
    }));

    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(matches);
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/come from/)).toBeTruthy();
  });

  it('detects upset results (bottom-3 beating top-6)', async () => {
    const standings = makeStandings();
    const matches = makeSeasonMatches();
    // Bottom team (Burnley, pos 20) beats top team (Arsenal, pos 1) at home
    matches.push(makeMatch({
      id: '777',
      home_team: 'Burnley FC',
      away_team: 'Arsenal FC',
      home_goals: 2,
      away_goals: 0,
      result: 'H',
      matchday: 3,
      date: '2025-08-13T15:00:00Z',
    }));

    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(matches);
    vi.mocked(dataService.getStandings).mockResolvedValue(standings);

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/stun/)).toBeTruthy();
  });

  it('renders the season narrative section', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(makeSeasonMatches());
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText('The Story So Far')).toBeTruthy();
  });

  it('shows matchday badge', async () => {
    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(makeSeasonMatches());
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/Matchday 3 of 38/)).toBeTruthy();
  });

  it('handles API failure gracefully', async () => {
    // Promise.allSettled catches rejections — matches becomes [] → "No match data" message
    vi.mocked(dataService.getCurrentSeasonMatches).mockRejectedValue(new Error('API error'));
    vi.mocked(dataService.getStandings).mockRejectedValue(new Error('API error'));

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/No match data available/)).toBeTruthy();
  });

  it('matchday 1 gets special narrative treatment', async () => {
    // Just one matchday
    const matches: Match[] = [];
    let id = 1;
    for (let i = 0; i < mockTeams.length; i += 2) {
      matches.push(makeMatch({
        id: String(id++),
        home_team: mockTeams[i],
        away_team: mockTeams[i + 1],
        matchday: 1,
        home_goals: 1,
        away_goals: 0,
        result: 'H',
        date: '2025-08-10T15:00:00Z',
      }));
    }

    vi.mocked(dataService.getCurrentSeasonMatches).mockResolvedValue(matches);
    vi.mocked(dataService.getStandings).mockResolvedValue(makeStandings());

    const { component } = render(SeasonTimeline);
    await (component as any).loadTimeline();
    await act();

    expect(screen.getByText(/The Season Begins/)).toBeTruthy();
  });
});
