import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Match, MatchEvent } from '../types';

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
  matchEventsStore,
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
    matchEventsStore.set([]);
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

  // ---------------------------------------------------------------------------
  // Match event detection (polling-diff)
  // ---------------------------------------------------------------------------

  describe('match event detection', () => {
    it('should detect a home team goal between polls', async () => {
      // First poll: match at 0-0
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 0, away_goals: 0 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      // Second poll: home team scores, now 1-0
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('goal');
      expect(events[0].team).toBe('Arsenal'); // home_team from makeMatch default
      expect(events[0].score).toBe('1-0');
      expect(events[0].message).toContain('GOAL');
    });

    it('should detect an away team goal between polls', async () => {
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 0, away_goals: 0 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 0, away_goals: 1 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('goal');
      expect(events[0].team).toBe('Liverpool'); // away_team from makeMatch default
      expect(events[0].score).toBe('0-1');
    });

    it('should detect multiple goals scored between polls', async () => {
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 0, away_goals: 0 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      // Two goals scored between polls (home 2, away 1)
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 2, away_goals: 1 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      // 2 home goals + 1 away goal = 3 events
      expect(events).toHaveLength(3);
      const goalEvents = events.filter((e: MatchEvent) => e.type === 'goal');
      expect(goalEvents).toHaveLength(3);
      expect(goalEvents.filter((e: MatchEvent) => e.team === 'Arsenal')).toHaveLength(2);
      expect(goalEvents.filter((e: MatchEvent) => e.team === 'Liverpool')).toHaveLength(1);
    });

    it('should detect kickoff for a newly appearing live match', async () => {
      // First poll: no live matches
      mockGetLiveMatches.mockResolvedValue([]);
      await liveService.start();

      // Second poll: match just kicked off
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 0, away_goals: 0 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('kickoff');
      expect(events[0].message).toContain('Kick-off');
    });

    it('should detect half-time status change', async () => {
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'PAUSED', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('half_time');
      expect(events[0].score).toBe('1-0');
      expect(events[0].message).toContain('Half-time');
    });

    it('should detect second half restart', async () => {
      // Match at half-time
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'PAUSED', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.start();

      // Second half begins
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('second_half');
      expect(events[0].message).toContain('Second half');
    });

    it('should detect full-time', async () => {
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 2, away_goals: 1 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'FINISHED', home_goals: 2, away_goals: 1 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('full_time');
      expect(events[0].score).toBe('2-1');
      expect(events[0].message).toContain('Full-time');
    });

    it('should detect extra time', async () => {
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 1, away_goals: 1 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'EXTRA_TIME', home_goals: 1, away_goals: 1 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('extra_time');
      expect(events[0].message).toContain('Extra time');
    });

    it('should detect penalty shootout', async () => {
      // Start with EXTRA_TIME — no kickoff event emitted (only IN_PLAY triggers kickoff)
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'EXTRA_TIME', home_goals: 2, away_goals: 2 }),
      ]);
      await liveService.start();

      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'PENALTY_SHOOTOUT', home_goals: 2, away_goals: 2 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('penalties');
      expect(events[0].message).toContain('Penalty shootout');
    });

    it('should not emit spurious events on first poll for in-progress matches', async () => {
      // First poll sees a match already at 2-1 — should only emit kickoff, not goals
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 2, away_goals: 1 }),
      ]);
      await liveService.start();

      const events = get(matchEventsStore);
      // Should see a kickoff event, not 3 goal events
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('kickoff');
    });

    it('should prune expired events', async () => {
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 0, away_goals: 0 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      // Goal scored
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.refresh();
      expect(get(matchEventsStore)).toHaveLength(1);

      // Advance time past expiry (30s)
      vi.advanceTimersByTime(31_000);

      // Another poll with no changes — should prune expired events
      await liveService.refresh();
      expect(get(matchEventsStore)).toHaveLength(0);
    });

    it('should handle goal and status change in same poll', async () => {
      // Match at 1-0 in play
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'IN_PLAY', home_goals: 1, away_goals: 0 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff event from first poll

      // Goal scored AND half-time whistle in same poll interval
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', status: 'PAUSED', home_goals: 2, away_goals: 0 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(2);
      const types = events.map((e: MatchEvent) => e.type);
      expect(types).toContain('goal');
      expect(types).toContain('half_time');
    });

    it('should track events across multiple matches independently', async () => {
      // Two matches in play
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', home_team: 'Arsenal', away_team: 'Chelsea', status: 'IN_PLAY', home_goals: 0, away_goals: 0 }),
        makeMatch({ id: 'm2', home_team: 'Spurs', away_team: 'Liverpool', status: 'IN_PLAY', home_goals: 1, away_goals: 1 }),
      ]);
      await liveService.start();
      matchEventsStore.set([]); // clear kickoff events from first poll

      // Arsenal scores, Spurs match goes to half-time
      mockGetLiveMatches.mockResolvedValue([
        makeMatch({ id: 'm1', home_team: 'Arsenal', away_team: 'Chelsea', status: 'IN_PLAY', home_goals: 1, away_goals: 0 }),
        makeMatch({ id: 'm2', home_team: 'Spurs', away_team: 'Liverpool', status: 'PAUSED', home_goals: 1, away_goals: 1 }),
      ]);
      await liveService.refresh();

      const events = get(matchEventsStore);
      expect(events).toHaveLength(2);

      const arsenalGoal = events.find((e: MatchEvent) => e.matchId === 'm1');
      expect(arsenalGoal?.type).toBe('goal');
      expect(arsenalGoal?.team).toBe('Arsenal');

      const spursHT = events.find((e: MatchEvent) => e.matchId === 'm2');
      expect(spursHT?.type).toBe('half_time');
    });
  });
});
