import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/svelte';
import LiveMatches from './LiveMatches.svelte';
import { dataService } from '../services/dataService';
import type { Match } from '../types';

// Mock dataService
vi.mock('../services/dataService', () => ({
  dataService: {
    getLiveMatches: vi.fn(() => Promise.resolve([])),
    getMatches: vi.fn(() => Promise.resolve([]))
  }
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Mocked Date'),
  subDays: vi.fn((date: Date, days: number) => new Date(date.getTime() - days * 86400000)),
  isAfter: vi.fn((a: Date, b: Date) => a.getTime() > b.getTime()),
  isBefore: vi.fn((a: Date, b: Date) => a.getTime() < b.getTime()),
  formatDistanceToNow: vi.fn(() => 'in 2 hours')
}));

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  scale: () => ({ duration: 0 })
}));

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png')
}));

// Mock lucide-svelte icons as simple stub components
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
    Activity: stub, Clock: stub, AlertCircle: stub,
    Tv: stub, Calendar: stub, Check: stub
  };
});

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: '1', season_id: 's1', date: new Date().toISOString(),
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
    ...overrides
  };
}

describe('LiveMatches Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataService.getLiveMatches).mockResolvedValue([]);
    vi.mocked(dataService.getMatches).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render Match Centre header', () => {
    render(LiveMatches);
    expect(screen.getByText('Match Centre')).toBeInTheDocument();
  });

  it('should show loading spinner initially', () => {
    render(LiveMatches);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show tabs after loading completes', async () => {
    // onMount scheduling does not complete in jsdom — call loadMatches directly
    // (same pattern as Dashboard.test.ts calling refresh())
    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByText('Live (0)')).toBeInTheDocument();
    expect(screen.getByText('Recent (0)')).toBeInTheDocument();
    expect(screen.getByText('Upcoming (0)')).toBeInTheDocument();
  });

  it('should show No Live Matches when live tab selected with no live games', async () => {
    // loadMatches auto-switches away from "live" when there are no live matches,
    // so we click the Live tab button to switch back and see the empty state
    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await act();

    // Click the Live tab
    const liveTab = screen.getByText('Live (0)');
    await fireEvent.click(liveTab);
    await act();

    expect(screen.getByText('No Live Matches')).toBeInTheDocument();
    expect(screen.getByText(/no Premier League matches in play/i)).toBeInTheDocument();
  });

  it('should show error message and Try Again button when API fails', async () => {
    vi.mocked(dataService.getMatches).mockRejectedValue(new Error('API down'));

    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await act();

    expect(screen.getByText(/Failed to load matches/i)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should show recent matches when available and auto-switch tab', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const recentMatch = makeMatch({
      id: 'r1',
      date: yesterday,
      home_team: 'Chelsea',
      away_team: 'Spurs',
      home_goals: 3,
      away_goals: 1,
      result: 'H'
    });

    vi.mocked(dataService.getMatches).mockResolvedValue([recentMatch]);

    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await act();

    // Auto-switches to recent when no live matches but recent exist
    expect(screen.getByText('Recent (1)')).toBeInTheDocument();
    expect(screen.getByText('Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Spurs')).toBeInTheDocument();
  });

  it('should clean up intervals on destroy', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { component, unmount } = render(LiveMatches);
    await (component as any).loadMatches();
    await act();

    // onMount's async work doesn't complete in jsdom, so scheduleNextPoll
    // and startCountdown never fire. Call them directly to create intervals.
    (component as any).scheduleNextPoll();
    (component as any).startCountdown();

    unmount();

    // onDestroy clears both refreshInterval and countdownInterval
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
