<script lang="ts">
  import { onMount } from 'svelte';
  
  interface TickerItem {
    text: string;
    type: 'match' | 'prediction' | 'update';
  }

  const tickerItems: TickerItem[] = [
    { text: "🔴 Man United vs Liverpool - Saturday 3PM", type: 'match' },
    { text: "⚡ Latest Prediction: Arsenal 78% win probability vs Chelsea", type: 'prediction' },
    { text: "📊 Updated: Man City maintains 85% title probability", type: 'update' },
    { text: "🎯 Top Form: Newcastle - 5 wins in last 6 matches", type: 'update' },
    { text: "🔥 Hot Streak: Haaland - 12 goals in 8 games", type: 'update' },
    { text: "⚽ Upcoming: Tottenham vs West Ham - Sunday 2PM", type: 'match' },
    { text: "📈 Betting Tip: Over 2.5 goals in Brighton vs Brentford", type: 'prediction' },
  ];

  let tickerContent = '';
  
  onMount(() => {
    // Duplicate content for seamless loop
    tickerContent = tickerItems.map(item => item.text).join(' • ') + ' • ' + tickerItems.map(item => item.text).join(' • ');
  });
</script>

<div class="live-ticker bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 dark:from-primary/20 dark:via-accent/20 dark:to-primary/20 py-2 border-y border-slate-200 dark:border-slate-700">
  <div class="ticker-content text-sm font-medium text-slate-700 dark:text-slate-300">
    {tickerContent}
  </div>
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
  }
</style>