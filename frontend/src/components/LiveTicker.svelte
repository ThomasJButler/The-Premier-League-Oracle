<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { format } from 'date-fns';
  import {
    liveMatchesStore,
    recentMatchesStore,
    upcomingMatchesStore,
    hasLiveMatches as hasLiveStore,
    liveService,
  } from '../services/liveService';

  interface TickerItem {
    text: string;
    type: 'live' | 'result' | 'fixture' | 'update';
    priority: number; // lower = higher priority
  }

  let tickerContent = '';
  let hasLiveMatches = false;
  let paused = false;
  let unsubscribers: Array<() => void> = [];

  onMount(() => {
    // Ensure the service is started (idempotent — no-op if already running)
    liveService.start();

    // Subscribe to stores and rebuild ticker when data changes
    const unsubLive = liveMatchesStore.subscribe(() => buildTicker());
    const unsubRecent = recentMatchesStore.subscribe(() => buildTicker());
    const unsubUpcoming = upcomingMatchesStore.subscribe(() => buildTicker());
    const unsubHasLive = hasLiveStore.subscribe((v) => { hasLiveMatches = v; });

    unsubscribers = [unsubLive, unsubRecent, unsubUpcoming, unsubHasLive];
  });

  onDestroy(() => {
    unsubscribers.forEach((unsub) => unsub());
  });

  function buildTicker() {
    try {
      const items: TickerItem[] = [];

      // Priority 1: Live scores (highest priority) — from shared store
      const live = get(liveMatchesStore);

      live.forEach((match) => {
        const minute = match.minute != null ? `${match.minute}'` :
                       match.status === 'PAUSED' ? 'HT' : '';
        items.push({
          text: `${match.home_team} ${match.home_goals ?? 0}-${match.away_goals ?? 0} ${match.away_team} (${minute})`,
          type: 'live',
          priority: 0,
        });
      });

      // Priority 2: Recent results (last 24h) — filter from wider 3-day store
      const recent = get(recentMatchesStore);
      const oneDayAgo = Date.now() - 24 * 60 * 60_000;
      const recentToday = recent.filter((m) => new Date(m.date).getTime() > oneDayAgo);

      recentToday.slice(0, 4).forEach((match) => {
        const winner = match.result === 'H' ? match.home_team :
                       match.result === 'A' ? match.away_team : 'Draw';
        items.push({
          text: `Result: ${match.home_team} ${match.home_goals}-${match.away_goals} ${match.away_team} (${winner}${match.result === 'D' ? '' : ' win'})`,
          type: 'result',
          priority: 1,
        });
      });

      // Priority 3: Upcoming fixtures (next 48h) — filter from wider 7-day store
      const upcoming = get(upcomingMatchesStore);
      const twoDaysFromNow = Date.now() + 2 * 24 * 60 * 60_000;
      const soonUpcoming = upcoming.filter((m) => new Date(m.date).getTime() < twoDaysFromNow);

      soonUpcoming.slice(0, 4).forEach((match) => {
        const dateStr = format(new Date(match.date), 'EEEE h:mmaaa');
        items.push({
          text: `Upcoming: ${match.home_team} vs ${match.away_team} - ${dateStr}`,
          type: 'fixture',
          priority: 2,
        });
      });

      // Sort by priority
      items.sort((a, b) => a.priority - b.priority);

      if (items.length === 0) {
        tickerContent = 'Premier League Oracle — No matches scheduled in the next 48 hours';
        return;
      }

      // Build ticker with type-appropriate icons
      const iconMap: Record<string, string> = {
        live: '\u26BD',     // football
        result: '\u2705',   // check
        fixture: '\uD83D\uDCC5', // calendar
        update: '\uD83D\uDCCA',  // chart
      };

      const tickerTexts = items.map((item) => `${iconMap[item.type] || ''} ${item.text}`);
      // Duplicate for seamless CSS scroll loop
      tickerContent = tickerTexts.join(' \u2022 ') + ' \u2022 ' + tickerTexts.join(' \u2022 ');
    } catch {
      tickerContent = 'Premier League Oracle — Live Predictions — Real-time Analysis';
    }
  }
</script>

<div class="live-ticker bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 dark:from-primary/20 dark:via-accent/20 dark:to-primary/20 py-2 border-y border-border" role="marquee" aria-live="off" aria-label="Live match updates ticker">
  {#if hasLiveMatches}
    <span class="live-dot" aria-hidden="true"></span>
  {/if}
  <div class="ticker-content text-sm font-medium text-foreground" class:paused aria-hidden="true">
    {tickerContent}
  </div>
  <button
    class="ticker-pause"
    on:click={() => paused = !paused}
    aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
    title={paused ? 'Resume' : 'Pause'}
  >
    {#if paused}▶{:else}⏸{/if}
  </button>
  <span class="sr-only">{hasLiveMatches ? 'Live match updates are scrolling. ' : ''}{tickerContent.split(' • ').slice(0, 5).join('. ')}</span>
</div>

<style>
  .live-ticker {
    position: relative;
    overflow: hidden;
  }

  .ticker-content {
    padding-left: 100%;
    white-space: nowrap;
    display: inline-block;
    animation: ticker-scroll 60s linear infinite;
  }

  .ticker-content.paused {
    animation-play-state: paused;
  }

  .ticker-pause {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    background: hsl(var(--muted));
    border: 1px solid hsl(var(--border));
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.7rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    color: hsl(var(--foreground));
  }

  .live-ticker:hover .ticker-pause,
  .ticker-pause:focus-visible {
    opacity: 1;
  }

  .live-dot {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: hsl(var(--destructive));
    animation: pulse-dot 1.5s ease-in-out infinite;
    z-index: 1;
  }

  @keyframes ticker-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
