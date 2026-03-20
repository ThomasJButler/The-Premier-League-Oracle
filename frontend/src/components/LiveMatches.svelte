<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Activity, Clock, AlertCircle, Tv, Calendar, Check } from 'lucide-svelte';
  import type { Match } from '../types';
  import { scale } from 'svelte/transition';
  import { format, formatDistanceToNow } from 'date-fns';
  import DataFreshness from './DataFreshness.svelte';
  import { getTeamLogo } from '../utils/teamLogos';
  import {
    liveMatchesStore,
    recentMatchesStore,
    upcomingMatchesStore,
    pollLabel,
    liveService,
  } from '../services/liveService';
  import MatchEventToast from './MatchEventToast.svelte';

  // Subscribe to shared stores — $store syntax gives reactive values
  $: liveMatches = $liveMatchesStore;
  $: recentMatches = $recentMatchesStore;
  $: upcomingMatches = $upcomingMatchesStore;
  $: currentPollLabel = $pollLabel;

  let loading = true;
  let error = '';
  let lastRefresh = new Date();
  let showSection: 'live' | 'recent' | 'upcoming' = 'live';
  let nextKickoff: Date | null = null;
  let countdownText = '';
  let countdownInterval: ReturnType<typeof setInterval>;

  // Recompute nextKickoff when upcoming matches change
  $: nextKickoff = upcomingMatches.length > 0 ? new Date(upcomingMatches[0].date) : null;

  // Auto-switch tab on initial load only — don't override explicit user clicks
  let hasAutoSwitched = false;
  $: if (!loading && !hasAutoSwitched && liveMatches.length === 0 && showSection === 'live') {
    hasAutoSwitched = true; // eslint-disable-line no-useless-assignment -- guards next reactive run
    showSection = recentMatches.length > 0 ? 'recent' : 'upcoming';
  }

  onMount(async () => {
    try {
      await liveService.start();
      lastRefresh = new Date();
    } catch {
      error = 'Failed to load matches. Please check your API configuration.';
    } finally {
      loading = false;
    }
    startCountdown();
  });

  onDestroy(() => {
    liveService.stop();
    if (countdownInterval) clearInterval(countdownInterval);
  });

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
      await liveService.refresh();
      lastRefresh = new Date();
    } catch {
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
    const liveStatuses = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];
    if (liveStatuses.includes(match.status ?? '')) {
      if (match.status === 'PAUSED') return "HT";
      if (match.status === 'PENALTY_SHOOTOUT') return "PEN";
      const kickoff = new Date(match.date).getTime();
      const elapsed = Math.floor((Date.now() - kickoff) / 60_000);
      if (match.status === 'EXTRA_TIME') {
        return elapsed >= 90 ? `${elapsed}'` : "ET";
      }
      if (elapsed >= 0 && elapsed <= 120) return `${elapsed}'`;
    }
    return '';
  }

  /**
   * Extract a numeric minute from the match for the timeline progress bar.
   * Falls back to estimating from kickoff time when the API doesn't provide it.
   */
  function getNumericMinute(match: Match): number {
    if (match.minute != null) return match.minute;
    const liveStatuses = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];
    if (liveStatuses.includes(match.status ?? '')) {
      if (match.status === 'PAUSED') return 45;
      const kickoff = new Date(match.date).getTime();
      const elapsed = Math.floor((Date.now() - kickoff) / 60_000);
      return Math.max(0, Math.min(120, elapsed));
    }
    return 0;
  }

  /**
   * Calculate match progress as a percentage (0–100).
   * Normal time maps 0–90' to 0–100%. Half-time clamps at 50%.
   * Extra time/penalties show as 100% (full bar).
   */
  function getMatchProgress(match: Match): number {
    if (match.status === 'EXTRA_TIME' || match.status === 'PENALTY_SHOOTOUT') return 100;
    if (match.status === 'PAUSED') return 50;
    const minute = getNumericMinute(match);
    return Math.min(100, Math.max(0, (minute / 90) * 100));
  }

  /**
   * Return the progress bar colour based on match phase.
   * First half = green, second half transitions to amber/red for tension.
   */
  function getProgressColour(match: Match): string {
    if (match.status === 'EXTRA_TIME' || match.status === 'PENALTY_SHOOTOUT') {
      return 'bg-red-500';
    }
    const minute = getNumericMinute(match);
    if (minute <= 45) return 'bg-green-500';
    if (minute <= 70) return 'bg-amber-500';
    return 'bg-red-500';
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

<!-- Match event notifications (goals, status changes) — fixed-position toasts -->
<MatchEventToast />

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
        <DataFreshness timestamp={lastRefresh.getTime()} />
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
          id="tab-live"
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
          id="tab-recent"
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
          id="tab-upcoming"
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
    <!-- Skeleton cards matching the live match card layout -->
    <div class="grid gap-4">
      {#each Array(3) as _, i}
        <div class="rounded-xl border border-border bg-card shadow-sm p-6" style="animation-delay: {i * 100}ms">
          <!-- Status badge + activity icon -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="skeleton h-5 w-16 rounded-full"></div>
              <div class="skeleton h-4 w-10 rounded"></div>
            </div>
            <div class="skeleton h-5 w-5 rounded-full"></div>
          </div>
          <!-- Match info: 7-col grid (home / score / away) -->
          <div class="grid grid-cols-7 gap-4 items-center">
            <div class="col-span-3 flex items-center justify-end gap-2">
              <div class="skeleton h-5 w-24 rounded"></div>
              <div class="skeleton h-8 w-8 rounded-lg"></div>
            </div>
            <div class="text-center">
              <div class="flex items-center justify-center gap-2">
                <div class="skeleton h-8 w-6 rounded"></div>
                <span class="text-muted-foreground/30">-</span>
                <div class="skeleton h-8 w-6 rounded"></div>
              </div>
            </div>
            <div class="col-span-3 flex items-center gap-2">
              <div class="skeleton h-8 w-8 rounded-lg"></div>
              <div class="skeleton h-5 w-24 rounded"></div>
            </div>
          </div>
        </div>
      {/each}
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
    <div id="panel-live" role="tabpanel" aria-labelledby="tab-live" class="grid gap-4">
      {#each liveMatches as match, index}
        <div
          class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 motion-safe:hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-l-4 border-red-500"
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

            <!-- Score (animated on goal) -->
            <div class="text-center">
              <div class="text-3xl font-bold flex items-center justify-center gap-2">
                {#key match.home_goals}
                  <span class="text-primary inline-block animate-score-pop">{match.home_goals ?? 0}</span>
                {/key}
                <span class="text-muted-foreground">-</span>
                {#key match.away_goals}
                  <span class="text-primary inline-block animate-score-pop">{match.away_goals ?? 0}</span>
                {/key}
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

          <!-- Match Timeline Progress Bar -->
          <div class="mt-4 pt-3 border-t border-border">
            <div class="relative" role="progressbar" aria-label="Match progress" aria-valuenow={getNumericMinute(match)} aria-valuemin={0} aria-valuemax={90}>
              <!-- Track -->
              <div class="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-1000 {getProgressColour(match)}"
                  style="width: {getMatchProgress(match)}%"
                ></div>
              </div>
              <!-- Half-time marker -->
              <div class="absolute top-0 left-1/2 -translate-x-px w-0.5 h-1.5 bg-muted-foreground/40 rounded-full"></div>
              <!-- Time labels -->
              <div class="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
                <span>0'</span>
                <span>45'</span>
                <span>{match.status === 'EXTRA_TIME' || match.status === 'PENALTY_SHOOTOUT' ? '120' : '90'}'</span>
              </div>
            </div>
          </div>

          <!-- Half-time score if available -->
          {#if match.first_half_home_goals != null && match.first_half_away_goals != null}
            <div class="mt-2">
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
    <div id="panel-recent" role="tabpanel" aria-labelledby="tab-recent">
    {#if recentMatches.length > 0}
      <div class="grid gap-4">
        {#each recentMatches as match, index}
          <div
            class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 motion-safe:hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
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
    </div>
  {:else if showSection === 'upcoming'}
    <!-- Upcoming Matches -->
    <div id="panel-upcoming" role="tabpanel" aria-labelledby="tab-upcoming">
    {#if upcomingMatches.length > 0}
      <div class="grid gap-4">
        {#each upcomingMatches as match, index}
          <div
            class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 motion-safe:hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
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
    </div>
  {:else}
    <!-- No live matches — show countdown to next kickoff -->
    <div id="panel-live" role="tabpanel" aria-labelledby="tab-live" class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-12 text-center">
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
