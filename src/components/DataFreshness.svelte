<script lang="ts">
  import { Database, RefreshCw, AlertCircle } from 'lucide-svelte';
  import { onMount } from 'svelte';
  
  let lastUpdated = new Date();
  let isStale = false;
  let isRefreshing = false;
  
  $: timeSinceUpdate = getTimeSinceUpdate(lastUpdated);
  $: isStale = getIsStale(lastUpdated);
  
  function getTimeSinceUpdate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
  
  function getIsStale(date: Date): boolean {
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / 3600000;
    return diffHours > 24; // Data is stale after 24 hours
  }
  
  async function refreshData() {
    isRefreshing = true;
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    lastUpdated = new Date();
    isRefreshing = false;
  }
  
  onMount(() => {
    // Update the time display every minute
    const interval = setInterval(() => {
      timeSinceUpdate = getTimeSinceUpdate(lastUpdated);
    }, 60000);
    
    return () => clearInterval(interval);
  });
</script>

<div class="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
  <Database class="w-4 h-4 {isStale ? 'text-amber-500' : 'text-emerald-500'}" />
  
  <div class="flex-1">
    <p class="text-xs font-medium text-slate-600 dark:text-slate-400">
      Data freshness
    </p>
    <p class="text-sm font-semibold {isStale ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}">
      Updated {timeSinceUpdate}
    </p>
  </div>
  
  {#if isStale}
    <AlertCircle class="w-4 h-4 text-amber-500" />
  {/if}
</div>

