<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Activity, Clock, AlertCircle, Tv, Calendar, Check } from 'lucide-svelte';
  import { dataService } from '../services/dataService';
  import type { Match } from '../types';
  import { scale } from 'svelte/transition';
  import { format, subDays, addDays, isAfter, isBefore, formatDistanceToNow } from 'date-fns';
  import { getTeamLogo } from '../utils/teamLogos';

  let liveMatches: Match[] = [];
  let recentMatches: Match[] = [];
  let upcomingMatches: Match[] = [];
  let loading = true;
  let error = '';
  let refreshInterval: ReturnType<typeof setInterval>;
  let lastRefresh = new Date();
  let showSection: 'live' | 'recent' | 'upcoming' = 'live';
  let nextKickoff: Date | null = null;
  let countdownText = '';
  let countdownInterval: ReturnType<typeof setInterval>;

  // Smart polling intervals
  const LIVE_POLL_MS = 30_000;      // 30s when matches are live
  const MATCHDAY_POLL_MS = 5 * 60_000; // 5min on match days with no live games
  const IDLE_POLL_MS = 30 * 60_000;    // 30min otherwise
  let consecutiveEmptyPolls = 0;
  let currentPollLabel = 'every 30 seconds';

  onMount(async () => {
    await loadMatches();
    scheduleNextPoll();
    startCountdown();
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);
  });

  function scheduleNextPoll() {
    if (refreshInterval) clearInterval(refreshInterval);

    let interval: number;
    if (liveMatches.length > 0) {
      // Matches in play — poll frequently
      interval = LIVE_POLL_MS;
      consecutiveEmptyPolls = 0;
    } else if (consecutiveEmptyPolls >= 3) {
      // Adaptive backoff — 3 consecutive empty polls → slow down
      interval = IDLE_POLL_MS;
    } else if (upcomingMatches.some(m => {
      const diff = new Date(m.date).getTime() - Date.now();
      return diff > 0 && diff < 3 * 60 * 60_000; // match within 3h
    })) {
      // Match day with upcoming kickoff — moderate polling
      interval = MATCHDAY_POLL_MS;
    } else {
      interval = IDLE_POLL_MS;
    }

    currentPollLabel = interval === LIVE_POLL_MS ? 'every 30 seconds'
      : interval === MATCHDAY_POLL_MS ? 'every 5 minutes'
      : 'every 30 minutes';

    refreshInterval = setInterval(async () => {
      await loadMatches();
      scheduleNextPoll(); // re-evaluate interval after each poll
    }, interval);
  }

  function startCountdown() {
    countdownInterval = setInterval(() => {
      if (nextKickoff && nextKickoff.getTime() > Date.now()) {
        countdownText = formatDistanceToNow(nextKickoff, { addSuffix: true, includeSeconds: true });
      } else {
        countdownText = '';
      }
    }, 1000);
  }

  export async function loadMatches() {
    try {
      loading = liveMatches.length === 0 && recentMatches.length === 0;
      error = '';

      // Fetch live matches from the API
      let fetchedLive: Match[] = [];
      try {
        fetchedLive = await dataService.getLiveMatches();
      } catch {
        // Live endpoint may fail if no API key — non-fatal
      }

      // Get all matches for recent/upcoming filtering
      const allMatches = await dataService.getMatches();
      const now = new Date();
      const threeDaysAgo = subDays(now, 3);
      const sevenDaysFromNow = addDays(now, 7);

      liveMatches = fetchedLive;

      if (fetchedLive.length === 0) {
        consecutiveEmptyPolls++;
      } else {
        consecutiveEmptyPolls = 0;
      }

      // Recent matches (last 3 days, completed)
      recentMatches = allMatches.filter(match => {
        const matchDate = new Date(match.date);
        return match.result && isAfter(matchDate, threeDaysAgo) && isBefore(matchDate, now);
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Upcoming matches (next 7 days)
      upcomingMatches = allMatches.filter(match => {
        const matchDate = new Date(match.date);
        return !match.result && isAfter(matchDate, now) && isBefore(matchDate, sevenDaysFromNow);
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate next kickoff for countdown
      nextKickoff = upcomingMatches.length > 0 ? new Date(upcomingMatches[0].date) : null;

      lastRefresh = new Date();

      // Default to recent if no live matches
      if (liveMatches.length === 0 && showSection === 'live') {
        showSection = recentMatches.length > 0 ? 'recent' : 'upcoming';
      }
    } catch (err) {
      error = 'Failed to load matches. Please check your API configuration.';
    } finally {
      loading = false;
    }
  }

  function getMinute(match: Match): string {
    if (match.minute != null) {
      return `${match.minute}'`;
    }
    // Estimate from kick-off time if minute not provided
    if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
      const kickoff = new Date(match.date).getTime();
      const elapsed = Math.floor((Date.now() - kickoff) / 60_000);
      if (match.status === 'PAUSED') return "HT";
      if (elapsed >= 0 && elapsed <= 120) return `${elapsed}'`;
    }
    return '';
  }

  function getStatusBadge(match: Match): { text: string; class: string } {
    switch (match.status) {
      case 'IN_PLAY':
        return { text: 'LIVE', class: 'bg-red-500 animate-pulse' };
      case 'PAUSED':
        return { text: 'HALF TIME', class: 'bg-amber-500' };
      case 'EXTRA_TIME':
        return { text: 'EXTRA TIME', class: 'bg-red-600 animate-pulse' };
      case 'PENALTY_SHOOTOUT':
        return { text: 'PENALTIES', class: 'bg-amber-500 animate-pulse' };
      default:
        return { text: 'IN PLAY', class: 'bg-green-500' };
    }
  }
</script>

<div class="max-w-7xl mx-auto">
  <!-- Header -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center {liveMatches.length > 0 ? 'animate-pulse' : ''}">
          <Tv class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold font-display text-foreground">Match Centre</h1>
          <p class="text-sm text-muted-foreground">
            Live, recent and upcoming Premier League matches
          </p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-sm text-muted-foreground">
          Last update: {lastRefresh.toLocaleTimeString()}
        </div>
        <button
          on:click={loadMatches}
          class="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  {#if !loading}
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-2 mb-6">
      <div class="grid grid-cols-3 gap-2" role="tablist" aria-label="Match categories">
        <button
          role="tab"
          aria-selected={showSection === 'live'}
          aria-controls="panel-live"
          on:click={() => showSection = 'live'}
          class="px-4 py-3 rounded-lg transition-all {showSection === 'live'
            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold shadow-lg'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
        >
          <div class="flex items-center justify-center gap-2">
            <Activity class="w-4 h-4" />
            <span>Live ({liveMatches.length})</span>
          </div>
        </button>

        <button
          role="tab"
          aria-selected={showSection === 'recent'}
          aria-controls="panel-recent"
          on:click={() => showSection = 'recent'}
          class="px-4 py-3 rounded-lg transition-all {showSection === 'recent'
            ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold shadow-lg'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
        >
          <div class="flex items-center justify-center gap-2">
            <Check class="w-4 h-4" />
            <span>Recent ({recentMatches.length})</span>
          </div>
        </button>

        <button
          role="tab"
          aria-selected={showSection === 'upcoming'}
          aria-controls="panel-upcoming"
          on:click={() => showSection = 'upcoming'}
          class="px-4 py-3 rounded-lg transition-all {showSection === 'upcoming'
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
        >
          <div class="flex items-center justify-center gap-2">
            <Calendar class="w-4 h-4" />
            <span>Upcoming ({upcomingMatches.length})</span>
          </div>
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  {:else if error}
    <div class="rounded-xl border border-destructive/50 bg-destructive/10 shadow-sm p-6 text-center">
      <AlertCircle class="w-12 h-12 mx-auto mb-4 text-destructive" />
      <p class="text-destructive">{error}</p>
      <button
        on:click={loadMatches}
        class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if showSection === 'live' && liveMatches.length > 0}
    <div class="grid gap-4">
      {#each liveMatches as match, index}
        <div
          class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-l-4 border-red-500"
          in:scale={{ delay: index * 100, duration: 300 }}
        >
          <!-- Live Badge -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="{getStatusBadge(match).class} text-white text-xs px-2 py-1 rounded-full font-semibold">
                {getStatusBadge(match).text}
              </span>
              <span class="text-sm font-mono font-semibold text-muted-foreground">
                {getMinute(match)}
              </span>
            </div>
            <Activity class="w-5 h-5 text-green-500 animate-pulse" />
          </div>

          <!-- Match Info -->
          <div class="grid grid-cols-7 gap-4 items-center">
            <!-- Home Team -->
            <div class="col-span-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <span class="font-semibold text-lg">{match.home_team}</span>
                <img src={getTeamLogo(match.home_team)} alt="" class="w-8 h-8 object-contain" />
              </div>
              <div class="text-xs text-muted-foreground mt-1">Home</div>
            </div>

            <!-- Score -->
            <div class="text-center">
              <div class="text-3xl font-bold">
                <span class="text-primary">{match.home_goals ?? 0}</span>
                <span class="mx-2 text-muted-foreground">-</span>
                <span class="text-primary">{match.away_goals ?? 0}</span>
              </div>
            </div>

            <!-- Away Team -->
            <div class="col-span-3 text-left">
              <div class="flex items-center gap-2">
                <img src={getTeamLogo(match.away_team)} alt="" class="w-8 h-8 object-contain" />
                <span class="font-semibold text-lg">{match.away_team}</span>
              </div>
              <div class="text-xs text-muted-foreground mt-1">Away</div>
            </div>
          </div>

          <!-- Half-time score if available -->
          {#if match.first_half_home_goals != null && match.first_half_away_goals != null}
            <div class="mt-3 pt-3 border-t border-border">
              <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock class="w-4 h-4" />
                <span>HT: {match.first_half_home_goals} - {match.first_half_away_goals}</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Auto-refresh indicator -->
    <div class="mt-6 text-center">
      <p class="text-sm text-muted-foreground">
        Auto-refreshing {currentPollLabel}
      </p>
    </div>
  {:else if showSection === 'recent'}
    <!-- Recent Matches -->
    {#if recentMatches.length > 0}
      <div class="grid gap-4">
        {#each recentMatches as match, index}
          <div
            class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            in:scale={{ delay: index * 50, duration: 300 }}
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-muted-foreground">
                {format(new Date(match.date), 'EEEE, MMMM d, yyyy')}
              </span>
              <span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full font-semibold">
                FULL TIME
              </span>
            </div>

            <div class="grid grid-cols-7 gap-2 items-center">
              <!-- Home Team -->
              <div class="col-span-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <span class="font-semibold">{match.home_team}</span>
                  <img src={getTeamLogo(match.home_team)} alt="" class="w-6 h-6 object-contain" />
                </div>
              </div>

              <!-- Score -->
              <div class="text-center">
                <div class="text-2xl font-bold">
                  <span class="{match.result === 'H' ? 'text-green-600' : 'text-muted-foreground'}">{match.home_goals ?? 0}</span>
                  <span class="mx-1 text-muted-foreground">-</span>
                  <span class="{match.result === 'A' ? 'text-green-600' : 'text-muted-foreground'}">{match.away_goals ?? 0}</span>
                </div>
              </div>

              <!-- Away Team -->
              <div class="col-span-3">
                <div class="flex items-center gap-2">
                  <img src={getTeamLogo(match.away_team)} alt="" class="w-6 h-6 object-contain" />
                  <span class="font-semibold">{match.away_team}</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-8 text-center">
        <Calendar class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p class="text-muted-foreground">No recent matches in the last 3 days</p>
      </div>
    {/if}
  {:else if showSection === 'upcoming'}
    <!-- Upcoming Matches -->
    {#if upcomingMatches.length > 0}
      <div class="grid gap-4">
        {#each upcomingMatches as match, index}
          <div
            class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            in:scale={{ delay: index * 50, duration: 300 }}
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-muted-foreground">
                {format(new Date(match.date), 'EEEE, MMMM d')}
              </span>
              <span class="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded-full font-semibold">
                {format(new Date(match.date), 'HH:mm')}
              </span>
            </div>

            <div class="grid grid-cols-7 gap-2 items-center">
              <!-- Home Team -->
              <div class="col-span-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <span class="font-semibold">{match.home_team}</span>
                  <img src={getTeamLogo(match.home_team)} alt="" class="w-6 h-6 object-contain" />
                </div>
              </div>

              <!-- VS -->
              <div class="text-center">
                <div class="text-lg font-bold text-muted-foreground">VS</div>
              </div>

              <!-- Away Team -->
              <div class="col-span-3">
                <div class="flex items-center gap-2">
                  <img src={getTeamLogo(match.away_team)} alt="" class="w-6 h-6 object-contain" />
                  <span class="font-semibold">{match.away_team}</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-8 text-center">
        <Calendar class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p class="text-muted-foreground">No upcoming matches in the next 7 days</p>
      </div>
    {/if}
  {:else}
    <!-- No live matches — show countdown to next kickoff -->
    <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-12 text-center">
      <Tv class="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
      <h3 class="text-xl font-semibold font-display mb-2 text-foreground">No Live Matches</h3>
      <p class="text-muted-foreground">
        There are no Premier League matches in play right now.
      </p>
      {#if nextKickoff && countdownText}
        <div class="mt-4 p-4 bg-primary/5 rounded-lg">
          <p class="text-sm text-muted-foreground">Next kickoff</p>
          <p class="text-lg font-semibold text-primary mt-1">{countdownText}</p>
          <p class="text-xs text-muted-foreground mt-1">
            {format(nextKickoff, 'EEEE d MMMM, HH:mm')}
          </p>
        </div>
      {:else}
        <p class="text-sm text-muted-foreground dark:text-slate-500 mt-2">
          Check back during match times for live updates.
        </p>
      {/if}
    </div>
  {/if}
</div>

