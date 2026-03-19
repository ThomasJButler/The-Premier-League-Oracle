import { writable, derived, get } from 'svelte/store';
import type { Match } from '../types';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIVE_POLL_MS = 30_000; // 30s when matches are live
const MATCHDAY_POLL_MS = 5 * 60_000; // 5min on match days with no live games
const IDLE_POLL_MS = 30 * 60_000; // 30min otherwise
const MAX_EMPTY_POLLS = 3; // Back off after 3 consecutive empty polls

// ---------------------------------------------------------------------------
// LiveService — singleton that owns the polling loop
// ---------------------------------------------------------------------------

class LiveService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveEmptyPolls = 0;
  private running = false;

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

  /** Stop the service — cleans up all timers. */
  stop(): void {
    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
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
    } catch {
      // Stores retain last known values on error
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

  /** Schedule (or reschedule) the next polling cycle. */
  private scheduleNextPoll(): void {
    if (!this.running) return;
    if (this.pollTimer) clearInterval(this.pollTimer);

    const interval = this.getPollingInterval();

    this.pollTimer = setInterval(async () => {
      await this.poll();
      // Re-evaluate interval after each poll (adaptive)
      this.scheduleNextPoll();
    }, interval);
  }
}

/** Singleton instance — import this in components */
export const liveService = new LiveService();
