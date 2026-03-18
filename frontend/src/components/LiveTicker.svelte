<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dataService } from '../services/dataService';
  import { format } from 'date-fns';

  interface TickerItem {
    text: string;
    type: 'live' | 'result' | 'fixture' | 'update';
    priority: number; // lower = higher priority
  }

  let tickerContent = '';
  let hasLiveMatches = false;
  let pollInterval: ReturnType<typeof setInterval>;

  onMount(async () => {
    await buildTicker();
    // Refresh ticker every 60s to pick up live score changes
    pollInterval = setInterval(buildTicker, 60_000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  async function buildTicker() {
    try {
      const items: TickerItem[] = [];

      // Priority 1: Live scores (highest priority)
      try {
        const liveMatches = await dataService.getLiveMatches();
        liveMatches.forEach(match => {
          const minute = match.minute != null ? `${match.minute}'` :
                         match.status === 'PAUSED' ? 'HT' : '';
          items.push({
            text: `${match.home_team} ${match.home_goals ?? 0}-${match.away_goals ?? 0} ${match.away_team} (${minute})`,
            type: 'live',
            priority: 0
          });
        });
      } catch {
        // Live endpoint may not be available
      }

      // Priority 2: Recent results (last 24h)
      const recentMatches = await dataService.getMatches({ recent: true, days: 1 });
      const finishedRecent = recentMatches.filter(m => m.result);
      finishedRecent.slice(0, 4).forEach(match => {
        const winner = match.result === 'H' ? match.home_team :
                       match.result === 'A' ? match.away_team : 'Draw';
        items.push({
          text: `Result: ${match.home_team} ${match.home_goals}-${match.away_goals} ${match.away_team} (${winner}${match.result === 'D' ? '' : ' win'})`,
          type: 'result',
          priority: 1
        });
      });

      // Priority 3: Upcoming fixtures (next 48h)
      const upcomingMatches = await dataService.getMatches({ upcoming: true, days: 2 });
      upcomingMatches.slice(0, 4).forEach(match => {
        const dateStr = format(new Date(match.date), 'EEEE h:mmaaa');
        items.push({
          text: `Upcoming: ${match.home_team} vs ${match.away_team} - ${dateStr}`,
          type: 'fixture',
          priority: 2
        });
      });

      // Sort by priority
      items.sort((a, b) => a.priority - b.priority);
      hasLiveMatches = items.some(item => item.type === 'live');

      if (items.length === 0) {
        tickerContent = 'Premier League Oracle — No matches scheduled in the next 48 hours';
        hasLiveMatches = false;
        return;
      }

      // Build ticker with type-appropriate icons
      const iconMap: Record<string, string> = {
        live: '\u26BD',     // football
        result: '\u2705',   // check
        fixture: '\uD83D\uDCC5', // calendar
        update: '\uD83D\uDCCA'   // chart
      };

      const tickerTexts = items.map(item => `${iconMap[item.type] || ''} ${item.text}`);
      // Duplicate for seamless CSS scroll loop
      tickerContent = tickerTexts.join(' \u2022 ') + ' \u2022 ' + tickerTexts.join(' \u2022 ');
    } catch {
      tickerContent = 'Premier League Oracle — Live Predictions — Real-time Analysis';
    }
  }
</script>

<div class="live-ticker bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 dark:from-primary/20 dark:via-accent/20 dark:to-primary/20 py-2 border-y border-border" role="marquee" aria-live="off" aria-label="Live match updates ticker">
  {#if hasLiveMatches}
    <!-- Pulsing indicator when live matches are showing -->
    <span class="live-dot" aria-hidden="true"></span>
  {/if}
  <div class="ticker-content text-sm font-medium text-foreground" aria-hidden="true">
    {tickerContent}
  </div>
  <!-- Screen reader gets a static summary instead of scrolling text -->
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
