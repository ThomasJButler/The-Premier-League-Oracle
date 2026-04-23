import { writable, derived, get } from 'svelte/store';
import type { Match, MatchEvent } from '../types';
import { dataService } from './dataService';
import { subDays, addDays, isAfter, isBefore } from 'date-fns';

// ---------------------------------------------------------------------------
// Stores — subscribe from any component via $liveMatchesStore etc.
// ---------------------------------------------------------------------------

/** Currently in-play matches (IN_PLAY, PAUSED, EXTRA_TIME, PENALTY_SHOOTOUT) */
export const liveMatchesStore = writable<Match[]>([]);

/** Completed matches from the last 3 days */
export const recentMatchesStore = writable<Match[]>([]);

/** Upcoming matches in the next 7 days */
export const upcomingMatchesStore = writable<Match[]>([]);

/** Derived convenience — true when at least one match is in play */
export const hasLiveMatches = derived(liveMatchesStore, ($m) => $m.length > 0);

/** Reactive poll interval label for display in the UI */
export const pollLabel = writable<string>('every 30 seconds');

/** Recent match events detected by polling-diff (goals, status changes) */
export const matchEventsStore = writable<MatchEvent[]>([]);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIVE_POLL_MS = 30_000; // 30s when matches are live
const MATCHDAY_POLL_MS = 5 * 60_000; // 5min on match days with no live games
const IDLE_POLL_MS = 30 * 60_000; // 30min otherwise
const MAX_EMPTY_POLLS = 3; // Back off after 3 consecutive empty polls
const EVENT_EXPIRY_MS = 30_000; // Events auto-expire after 30s

/** Snapshot of a match's state for diffing between polls */
interface MatchSnapshot {
  homeGoals: number | null;
  awayGoals: number | null;
  status: string | undefined;
}

// ---------------------------------------------------------------------------
// LiveService — singleton that owns the polling loop
// ---------------------------------------------------------------------------

class LiveService {
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveEmptyPolls = 0;
  private running = false;
  private previousStates = new Map<string, MatchSnapshot>();

  /**
   * Start the live data service.
   *
   * 1. Performs an immediate poll to populate stores.
   * 2. Starts the adaptive polling loop.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Initial data fetch
    await this.poll();

    // Always poll for live scores
    this.scheduleNextPoll();
  }

  /** Stop the service — cleans up all timers, event diff state, and stale events. */
  stop(): void {
    this.running = false;
    this.previousStates.clear();
    this.consecutiveEmptyPolls = 0;
    matchEventsStore.set([]);

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Force an immediate refresh (e.g. when user clicks "Refresh"). */
  async refresh(): Promise<void> {
    await this.poll();
    // Reset polling schedule after manual refresh
    if (this.running) {
      this.scheduleNextPoll();
    }
  }

  /** Whether the service is currently active. */
  isRunning(): boolean {
    return this.running;
  }

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------

  /** Fetch live, recent, and upcoming data from dataService into stores. */
  private async poll(): Promise<void> {
    try {
      // Live matches — non-fatal if this fails
      let live: Match[] = [];
      try {
        live = await dataService.getLiveMatches();
      } catch {
        // Live endpoint may fail if no API key — non-fatal
      }

      // Track consecutive empty live polls for adaptive backoff
      if (live.length === 0) {
        this.consecutiveEmptyPolls++;
      } else {
        this.consecutiveEmptyPolls = 0;
      }

      // Detect events by diffing against previous poll snapshot
      this.detectEvents(live);

      liveMatchesStore.set(live);

      // All matches for recent/upcoming filtering
      const allMatches = await dataService.getMatches();
      const now = new Date();
      const threeDaysAgo = subDays(now, 3);
      const sevenDaysFromNow = addDays(now, 7);

      const recent = allMatches
        .filter((m) => {
          const d = new Date(m.date);
          return m.result && isAfter(d, threeDaysAgo) && isBefore(d, now);
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const upcoming = allMatches
        .filter((m) => {
          const d = new Date(m.date);
          return !m.result && isAfter(d, now) && isBefore(d, sevenDaysFromNow);
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      recentMatchesStore.set(recent);
      upcomingMatchesStore.set(upcoming);
    } catch (error) {
      // Stores retain last known values on error. Surface the cause so
      // rate-limit throws from dataService.getMatches() are visible during
      // polling rather than vanishing silently.
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[liveService] poll failed:', msg);
    }

    // Update the poll label for UI display
    pollLabel.set(this.getPollLabel());
  }

  /** Determine the appropriate polling interval based on current state. */
  private getPollingInterval(): number {
    const live = get(liveMatchesStore);
    if (live.length > 0) return LIVE_POLL_MS;

    if (this.consecutiveEmptyPolls >= MAX_EMPTY_POLLS) return IDLE_POLL_MS;

    const upcoming = get(upcomingMatchesStore);
    const matchWithin3h = upcoming.some((m) => {
      const diff = new Date(m.date).getTime() - Date.now();
      return diff > 0 && diff < 3 * 60 * 60_000;
    });

    return matchWithin3h ? MATCHDAY_POLL_MS : IDLE_POLL_MS;
  }

  /** Human-readable label for the current polling rate. */
  private getPollLabel(): string {
    const interval = this.getPollingInterval();
    if (interval === LIVE_POLL_MS) return 'every 30 seconds';
    if (interval === MATCHDAY_POLL_MS) return 'every 5 minutes';
    return 'every 30 minutes';
  }

  /**
   * Schedule the next polling cycle using setTimeout.
   *
   * setTimeout (not setInterval) ensures no overlapping polls — the next
   * poll is only scheduled after the current one completes, even if the
   * poll takes longer than the interval.
   */
  private scheduleNextPoll(): void {
    if (!this.running) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);

    const interval = this.getPollingInterval();

    this.pollTimer = setTimeout(async () => {
      await this.poll();
      // Re-evaluate interval after each poll (adaptive)
      this.scheduleNextPoll();
    }, interval);
  }

  // -------------------------------------------------------------------------
  // Match event detection (polling-diff)
  // -------------------------------------------------------------------------

  /**
   * Compare current live matches against previous poll snapshot to detect
   * goals and status changes. Since Football-Data.org free tier provides no
   * per-match events API, we infer events from score/status diffs.
   */
  private detectEvents(currentMatches: Match[]): void {
    const now = Date.now();
    const newEvents: MatchEvent[] = [];

    for (const match of currentMatches) {
      const prev = this.previousStates.get(match.id);
      const homeGoals = match.home_goals;
      const awayGoals = match.away_goals;
      const status = match.status;

      if (prev) {
        // Detect goals — score increased since last poll
        const prevHome = prev.homeGoals ?? 0;
        const prevAway = prev.awayGoals ?? 0;
        const currHome = homeGoals ?? 0;
        const currAway = awayGoals ?? 0;

        if (currHome > prevHome) {
          const goalsScored = currHome - prevHome;
          for (let i = 0; i < goalsScored; i++) {
            newEvents.push({
              id: `goal-${match.id}-h-${currHome - i}-${now}`,
              matchId: match.id,
              type: 'goal',
              team: match.home_team,
              homeTeam: match.home_team,
              awayTeam: match.away_team,
              score: `${currHome}-${currAway}`,
              message: `⚽ GOAL! ${match.home_team} score — ${match.home_team} ${currHome}-${currAway} ${match.away_team}`,
              timestamp: now,
            });
          }
        }

        if (currAway > prevAway) {
          const goalsScored = currAway - prevAway;
          for (let i = 0; i < goalsScored; i++) {
            newEvents.push({
              id: `goal-${match.id}-a-${currAway - i}-${now}`,
              matchId: match.id,
              type: 'goal',
              team: match.away_team,
              homeTeam: match.home_team,
              awayTeam: match.away_team,
              score: `${currHome}-${currAway}`,
              message: `⚽ GOAL! ${match.away_team} score — ${match.home_team} ${currHome}-${currAway} ${match.away_team}`,
              timestamp: now,
            });
          }
        }

        // Detect status transitions
        if (status !== prev.status) {
          const statusEvent = this.buildStatusEvent(match, prev.status, now);
          if (statusEvent) newEvents.push(statusEvent);
        }
      } else if (status === 'IN_PLAY') {
        // First time seeing this match live — it just kicked off
        newEvents.push({
          id: `kickoff-${match.id}-${now}`,
          matchId: match.id,
          type: 'kickoff',
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          message: `🟢 Kick-off! ${match.home_team} vs ${match.away_team}`,
          timestamp: now,
        });
      }

      // Update snapshot for next poll
      this.previousStates.set(match.id, { homeGoals, awayGoals, status });
    }

    if (newEvents.length > 0) {
      // Merge new events with existing, then prune expired
      matchEventsStore.update((existing) => {
        const merged = [...existing, ...newEvents];
        return merged.filter((e) => now - e.timestamp < EVENT_EXPIRY_MS);
      });
    } else {
      // Still prune expired events each poll
      matchEventsStore.update((existing) =>
        existing.filter((e) => now - e.timestamp < EVENT_EXPIRY_MS),
      );
    }
  }

  /**
   * Build a status-change event from a known transition.
   * Returns null for transitions we don't surface to the user.
   */
  private buildStatusEvent(
    match: Match,
    previousStatus: string | undefined,
    now: number,
  ): MatchEvent | null {
    const label = `${match.home_team} vs ${match.away_team}`;
    const score =
      match.home_goals != null && match.away_goals != null
        ? `${match.home_goals}-${match.away_goals}`
        : undefined;

    switch (match.status) {
      case 'IN_PLAY':
        if (previousStatus === 'PAUSED') {
          return {
            id: `second_half-${match.id}-${now}`,
            matchId: match.id,
            type: 'second_half',
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            score,
            message: `▶️ Second half underway — ${label}`,
            timestamp: now,
          };
        }
        return {
          id: `kickoff-${match.id}-${now}`,
          matchId: match.id,
          type: 'kickoff',
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          message: `🟢 Kick-off! ${label}`,
          timestamp: now,
        };
      case 'PAUSED':
        return {
          id: `half_time-${match.id}-${now}`,
          matchId: match.id,
          type: 'half_time',
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          score,
          message: `⏸️ Half-time — ${label} ${score ?? ''}`,
          timestamp: now,
        };
      case 'FINISHED':
        return {
          id: `full_time-${match.id}-${now}`,
          matchId: match.id,
          type: 'full_time',
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          score,
          message: `🏁 Full-time — ${label} ${score ?? ''}`,
          timestamp: now,
        };
      case 'EXTRA_TIME':
        return {
          id: `extra_time-${match.id}-${now}`,
          matchId: match.id,
          type: 'extra_time',
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          score,
          message: `⏱️ Extra time — ${label} ${score ?? ''}`,
          timestamp: now,
        };
      case 'PENALTY_SHOOTOUT':
        return {
          id: `penalties-${match.id}-${now}`,
          matchId: match.id,
          type: 'penalties',
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          score,
          message: `🎯 Penalty shootout — ${label}`,
          timestamp: now,
        };
      default:
        return null;
    }
  }
}

/** Singleton instance — import this in components */
export const liveService = new LiveService();
