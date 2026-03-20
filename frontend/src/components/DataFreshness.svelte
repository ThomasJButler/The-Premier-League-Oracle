<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Clock } from 'lucide-svelte';

  /** Unix timestamp (ms) of the last data fetch — null hides the indicator */
  export let timestamp: number | null = null;

  let displayText = '';
  let interval: ReturnType<typeof setInterval>;

  function formatRelativeTime(ts: number): string {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function updateDisplay() {
    displayText = timestamp ? formatRelativeTime(timestamp) : '';
  }

  onMount(() => {
    updateDisplay();
    interval = setInterval(updateDisplay, 30_000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  // Re-compute when timestamp prop changes (e.g. after a refresh)
  $: timestamp, updateDisplay(); // eslint-disable-line @typescript-eslint/no-unused-expressions -- Svelte 4 reactive dependency
</script>

{#if displayText}
  <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Data freshness">
    <Clock class="w-3 h-3" />
    <span>Updated {displayText}</span>
  </span>
{/if}
