import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Match } from '../types';

// Mock dataService
const mockGetLiveMatches = vi.fn(() => Promise.resolve([] as Match[]));
const mockGetMatches = vi.fn(() => Promise.resolve([] as Match[]));

vi.mock('./dataService', () => ({
  dataService: {
    getLiveMatches: () => mockGetLiveMatches(),
    getMatches: () => mockGetMatches(),
  },
}));


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

// Import the module once — tests use stop() to reset between runs
import {
  liveMatchesStore,
  recentMatchesStore,
  upcomingMatchesStore,
  hasLiveMatches,
  pollLabel,
  liveService,
} from './liveService';

describe('LiveService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetLiveMatches.mockResolvedValue([]);
    mockGetMatches.mockResolvedValue([]);

    // Reset stores to empty
    liveMatchesStore.set([]);
    recentMatchesStore.set([]);
    upcomingMatchesStore.set([]);
    pollLabel.set('every 30 seconds');

    // Ensure service is stopped between tests
    liveService.stop();
  });

  afterEach(() => {
    liveService.stop();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Store initialisation
  // ---------------------------------------------------------------------------

  it('should export empty stores by default', () => {
    expect(get(liveMatchesStore)).toEqual([]);
    expect(get(recentMatchesStore)).toEqual([]);
    expect(get(upcomingMatchesStore)).toEqual([]);
    expect(get(hasLiveMatches)).toBe(false);
    expect(get(pollLabel)).toBe('every 30 seconds');
  });

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  it('should populate stores after start()', async () => {
    const liveMatch = makeMatch({ id: 'live1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 });
    const recentMatch = makeMatch({
      id: 'recent1',
      date: new Date(Date.now() - 86400000).toISOString(),
      result: 'H',
      home_goals: 2,
      away_goals: 0,
    });
    const upcomingMatch = makeMatch({
      id: 'upcoming1',
      date: new Date(Date.now() + 86400000).toISOString(),
    });

    mockGetLiveMatches.mockResolvedValue([liveMatch]);
    mockGetMatches.mockResolvedValue([recentMatch, upcomingMatch]);

    await liveService.start();

    expect(get(liveMatchesStore)).toEqual([liveMatch]);
    expect(get(recentMatchesStore)).toHaveLength(1);
    expect(get(upcomingMatchesStore)).toHaveLength(1);
    expect(get(hasLiveMatches)).toBe(true);
  });

  it('should be idempotent — calling start() twice is a no-op', async () => {
    await liveService.start();
    await liveService.start(); // second call should not re-fetch

    expect(mockGetLiveMatches).toHaveBeenCalledTimes(1);
  });

  it('should refresh data when refresh() is called', async () => {
    await liveService.start();

    mockGetLiveMatches.mockResolvedValue([makeMatch({ status: 'IN_PLAY', home_goals: 2, away_goals: 1 })]);

    await liveService.refresh();

    expect(get(liveMatchesStore)).toHaveLength(1);
    expect(mockGetLiveMatches).toHaveBeenCalledTimes(2); // initial + refresh
  });

  it('should handle getLiveMatches failure gracefully', async () => {
    mockGetLiveMatches.mockRejectedValue(new Error('API error'));
    mockGetMatches.mockResolvedValue([]);

    await liveService.start();

    // Should not throw, stores should be empty
    expect(get(liveMatchesStore)).toEqual([]);
    expect(get(recentMatchesStore)).toEqual([]);
  });

  it('should handle getMatches failure gracefully', async () => {
    mockGetLiveMatches.mockResolvedValue([]);
    mockGetMatches.mockRejectedValue(new Error('Network error'));

    await liveService.start();

    // Live store should be populated but recent/upcoming retain defaults
    expect(get(liveMatchesStore)).toEqual([]);
  });

  it('should sort recent matches newest first and upcoming matches soonest first', async () => {
    const older = makeMatch({
      id: 'r1',
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      result: 'H', home_goals: 1, away_goals: 0,
    });
    const newer = makeMatch({
      id: 'r2',
      date: new Date(Date.now() - 86400000).toISOString(),
      result: 'A', home_goals: 0, away_goals: 1,
    });
    const soon = makeMatch({
      id: 'u1',
      date: new Date(Date.now() + 86400000).toISOString(),
    });
    const later = makeMatch({
      id: 'u2',
      date: new Date(Date.now() + 3 * 86400000).toISOString(),
    });

    mockGetMatches.mockResolvedValue([older, newer, soon, later]);

    await liveService.start();

    const recent = get(recentMatchesStore);
    expect(recent[0].id).toBe('r2'); // newer first
    expect(recent[1].id).toBe('r1');

    const upcoming = get(upcomingMatchesStore);
    expect(upcoming[0].id).toBe('u1'); // sooner first
    expect(upcoming[1].id).toBe('u2');
  });

  // ---------------------------------------------------------------------------
  // Adaptive polling intervals
  // ---------------------------------------------------------------------------

  it('should set poll label to "every 30 seconds" when live matches exist', async () => {
    mockGetLiveMatches.mockResolvedValue([makeMatch({ status: 'IN_PLAY', home_goals: 1, away_goals: 0 })]);

    await liveService.start();

    expect(get(pollLabel)).toBe('every 30 seconds');
  });

  it('should set poll label to "every 30 minutes" when idle', async () => {
    await liveService.start();

    expect(get(pollLabel)).toBe('every 30 minutes');
  });

  // ---------------------------------------------------------------------------
  // Stop and cleanup
  // ---------------------------------------------------------------------------

  it('should stop polling on stop()', async () => {
    await liveService.start();

    expect(liveService.isRunning()).toBe(true);

    liveService.stop();

    expect(liveService.isRunning()).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Derived store
  // ---------------------------------------------------------------------------

  it('hasLiveMatches should be reactive', () => {
    expect(get(hasLiveMatches)).toBe(false);

    liveMatchesStore.set([makeMatch({ status: 'IN_PLAY' })]);
    expect(get(hasLiveMatches)).toBe(true);

    liveMatchesStore.set([]);
    expect(get(hasLiveMatches)).toBe(false);
  });
});
