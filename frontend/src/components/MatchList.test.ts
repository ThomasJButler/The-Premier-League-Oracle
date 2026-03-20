import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/svelte';
import MatchList from './MatchList.svelte';
import { dataService } from '../services/dataService';
import type { Match, Season } from '../types';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getAllSeasons: vi.fn(),
    getMatchesBySeason: vi.fn(),
    getLastFetched: vi.fn(() => Date.now()),
  },
}));

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png'),
}));

// Mock lib/utils
vi.mock('../lib/utils', () => ({
  getSeasonYear: vi.fn(() => 2025),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date, fmt: string) => {
    if (fmt === 'HH:mm') return '15:00';
    if (fmt === 'MMM d') return 'Jan 15';
    return 'Mocked Date';
  }),
}));

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  fly: () => ({ duration: 0 }),
  fade: () => ({ duration: 0 }),
}));

// Mock shadcn Badge and Button
vi.mock('$lib/components/ui/badge', () => {
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
  return { Badge: stub };
});

vi.mock('$lib/components/ui/button', () => {
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
  return { Button: stub };
});

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
  return { ArrowUpDown: stub, Filter: stub, Users: stub, Clock: stub };
});

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: '2025',
    name: '2025-2026',
    start_date: '2025-08-01',
    end_date: '2026-05-31',
    is_current: true,
    created_at: '2025-01-01',
    ...overrides,
  };
}

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
    created_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

const mockMatches: Match[] = [
  makeMatch({ id: '1', home_team: 'Arsenal FC', away_team: 'Chelsea FC', result: 'H', home_goals: 2, away_goals: 1 }),
  makeMatch({ id: '2', home_team: 'Liverpool FC', away_team: 'Man City FC', result: 'D', home_goals: 1, away_goals: 1, date: '2026-01-16T15:00:00Z' }),
  makeMatch({ id: '3', home_team: 'Tottenham FC', away_team: 'Brighton FC', result: null, home_goals: null, away_goals: null, date: '2026-02-01T15:00:00Z' }),
];

describe('MatchList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataService.getAllSeasons).mockResolvedValue([makeSeason()]);
    vi.mocked(dataService.getMatchesBySeason).mockResolvedValue(mockMatches);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    render(MatchList);
    expect(screen.getByText('Match Schedule')).toBeInTheDocument();
  });

  it('shows skeleton loading state initially', () => {
    // Keep onMount pending so the skeleton stays visible
    vi.mocked(dataService.getAllSeasons).mockReturnValue(new Promise(() => {}));
    render(MatchList);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('shows error when season load fails', async () => {
    vi.mocked(dataService.getAllSeasons).mockRejectedValue(new Error('API error'));
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await act();
    expect(screen.getByText(/Failed to load seasons/)).toBeInTheDocument();
  });

  it('shows error when match load fails', async () => {
    vi.mocked(dataService.getMatchesBySeason).mockRejectedValue(new Error('API error'));
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    expect(screen.getByText(/Failed to load matches/)).toBeInTheDocument();
  });

  it('renders match cards after successful load', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    // Team names appear in match cards (spans) and in filter dropdown options
    expect(screen.getAllByText('Arsenal FC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chelsea FC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Liverpool FC').length).toBeGreaterThan(0);
  });

  it('shows match count after loading', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    expect(screen.getByText(/Showing 3 of 3 matches/)).toBeInTheDocument();
  });

  it('displays scores for completed matches', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    // Arsenal 2-1 Chelsea
    expect(screen.getByText(/2 - 1/)).toBeInTheDocument();
  });

  it('displays kick-off time for upcoming matches', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    // Upcoming match should show mocked time
    expect(screen.getAllByText('15:00').length).toBeGreaterThan(0);
  });

  it('extracts unique teams from matches', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    const teamFilter = document.querySelector('#team-filter');
    expect(teamFilter).toBeInTheDocument();
  });

  it('renders filter controls when matches are loaded', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    // "Team" appears in both the filter label and sort button; check the select by id
    expect(document.querySelector('#team-filter')).toBeInTheDocument();
    expect(screen.getByText('Sort By')).toBeInTheDocument();
    expect(screen.getByText('Quick Filters')).toBeInTheDocument();
  });

  it('has sort buttons for Date and Team', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    // Sort buttons are <button> elements — use role query to distinguish from label text
    const buttons = screen.getAllByRole('button');
    const dateButton = buttons.find(b => /^Date/.test(b.textContent?.trim() ?? ''));
    const teamButton = buttons.find(b => /^Team/.test(b.textContent?.trim() ?? ''));
    expect(dateButton).toBeInTheDocument();
    expect(teamButton).toBeInTheDocument();
  });

  it('has quick filter buttons', async () => {
    const { component } = render(MatchList);
    await (component as any).loadSeasons();
    await (component as any).loadMatches();
    await act();
    expect(screen.getByText('Next Fixtures')).toBeInTheDocument();
    expect(screen.getByText('Recent Results')).toBeInTheDocument();
  });
});
