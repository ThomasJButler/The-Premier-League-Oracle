import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import LiveMatches from './LiveMatches.svelte';
import type { Match } from '../types';
import {
  liveMatchesStore,
  recentMatchesStore,
  upcomingMatchesStore,
  pollLabel,
  liveService,
} from '../services/liveService';

// Mock liveService — the component now delegates all fetching to it
vi.mock('../services/liveService', async () => {
  const { writable, derived } = await import('svelte/store');

  const liveMatchesStore = writable<import('../types').Match[]>([]);
  const recentMatchesStore = writable<import('../types').Match[]>([]);
  const upcomingMatchesStore = writable<import('../types').Match[]>([]);
  const hasLiveMatches = derived(liveMatchesStore, ($m) => $m.length > 0);
  const pollLabel = writable('every 30 seconds');

  const matchEventsStore = writable<import('../types').MatchEvent[]>([]);

  return {
    liveMatchesStore,
    recentMatchesStore,
    upcomingMatchesStore,
    matchEventsStore,
    hasLiveMatches,
    pollLabel,
    liveService: {
      start: vi.fn(() => Promise.resolve()),
      stop: vi.fn(),
      refresh: vi.fn(() => Promise.resolve()),
      isRunning: vi.fn(() => true),
    },
  };
});

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Mocked Date'),
  formatDistanceToNow: vi.fn(() => 'in 2 hours'),
}));

// Mock svelte/transition
vi.mock('svelte/transition', () => ({
  scale: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
}));

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => 'mock-logo.png'),
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
        root: opts?.target || document.createElement('div'),
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  };
  return {
    Activity: stub, Clock: stub, AlertCircle: stub,
    Tv: stub, Calendar: stub, Check: stub,
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
    ...overrides,
  };
}

/** Helper: set stores and flush Svelte's update cycle */
async function flushStoreUpdates() {
  await tick();
  await act();
}

describe('LiveMatches Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores to empty state
    liveMatchesStore.set([]);
    recentMatchesStore.set([]);
    upcomingMatchesStore.set([]);
    pollLabel.set('every 30 seconds');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render Match Centre header', () => {
    render(LiveMatches);
    expect(screen.getByText('Match Centre')).toBeInTheDocument();
  });

  it('should show tabs after loading completes', async () => {
    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    expect(screen.getByText('Live (0)')).toBeInTheDocument();
    expect(screen.getByText('Recent (0)')).toBeInTheDocument();
    expect(screen.getByText('Upcoming (0)')).toBeInTheDocument();
  });

  it('should show No Live Matches when live tab selected with no live games', async () => {
    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    // Click the Live tab
    const liveTab = screen.getByText('Live (0)');
    await fireEvent.click(liveTab);
    await flushStoreUpdates();

    expect(screen.getByText('No Live Matches')).toBeInTheDocument();
    expect(screen.getByText(/no Premier League matches in play/i)).toBeInTheDocument();
  });

  it('should display live match count from store', async () => {
    // Pre-populate store before render
    const liveMatch = makeMatch({
      id: 'live1',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      home_goals: 2,
      away_goals: 1,
      status: 'IN_PLAY',
      minute: 67,
    });
    liveMatchesStore.set([liveMatch]);

    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    // Tab count should reflect the store
    expect(screen.getByText('Live (1)')).toBeInTheDocument();
  });

  it('should show recent match count from store', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const recentMatch = makeMatch({
      id: 'r1',
      date: yesterday,
      home_team: 'Chelsea',
      away_team: 'Spurs',
      home_goals: 3,
      away_goals: 1,
      result: 'H',
    });
    recentMatchesStore.set([recentMatch]);

    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    expect(screen.getByText('Recent (1)')).toBeInTheDocument();
  });

  it('should show upcoming match count from store', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const upcomingMatch = makeMatch({
      id: 'u1',
      date: tomorrow,
      home_team: 'Man City',
      away_team: 'Newcastle',
    });

    // Also populate liveMatchesStore so loadMatches() doesn't set loading=true
    // (loading = liveMatches.length === 0 && recentMatches.length === 0).
    // When loading toggles true, the {#if !loading} tab block is torn down
    // and re-created, losing the reactive upcoming count in jsdom.
    liveMatchesStore.set([makeMatch({ id: 'live-dummy', status: 'IN_PLAY', home_goals: 0, away_goals: 0 })]);
    upcomingMatchesStore.set([upcomingMatch]);

    const { component } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    expect(screen.getByText('Upcoming (1)')).toBeInTheDocument();
  });

  it('should call liveService.refresh when loadMatches is invoked', async () => {
    const { component } = render(LiveMatches);
    await (component as any).loadMatches();

    expect(liveService.refresh).toHaveBeenCalledTimes(1);
  });

  it('should call liveService.stop on unmount', async () => {
    const { component, unmount } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    unmount();

    expect(liveService.stop).toHaveBeenCalled();
  });

  it('should register cleanup callbacks on destroy', async () => {
    const { component, unmount } = render(LiveMatches);
    await (component as any).loadMatches();
    await flushStoreUpdates();

    expect(component.$$.on_destroy.length).toBeGreaterThanOrEqual(1);
    expect(() => unmount()).not.toThrow();
  });
});
