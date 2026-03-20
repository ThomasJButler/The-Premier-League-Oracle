<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { MatchEvent } from '../types';
  import { matchEventsStore } from '../services/liveService';
  import { getTeamLogo } from '../utils/teamLogos';

  // Subscribe to the shared events store
  $: events = $matchEventsStore;

  /** Colour and icon styling per event type */
  function getEventStyle(type: MatchEvent['type']): { border: string; bg: string } {
    switch (type) {
      case 'goal':
        return { border: 'border-green-500', bg: 'bg-green-500/10' };
      case 'kickoff':
      case 'second_half':
        return { border: 'border-emerald-500', bg: 'bg-emerald-500/10' };
      case 'half_time':
        return { border: 'border-amber-500', bg: 'bg-amber-500/10' };
      case 'full_time':
        return { border: 'border-blue-500', bg: 'bg-blue-500/10' };
      case 'extra_time':
      case 'penalties':
        return { border: 'border-red-500', bg: 'bg-red-500/10' };
      default:
        return { border: 'border-border', bg: 'bg-muted' };
    }
  }
</script>

{#if events.length > 0}
  <div
    class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    role="status"
    aria-live="polite"
    aria-label="Match event notifications"
  >
    {#each events as event (event.id)}
      {@const style = getEventStyle(event.type)}
      <div
        class="pointer-events-auto rounded-lg border-l-4 {style.border} {style.bg} bg-card shadow-lg p-3 backdrop-blur-sm"
        in:fly={{ x: 300, duration: 300 }}
        out:fly={{ x: 300, duration: 200 }}
      >
        <p class="text-sm font-semibold text-foreground leading-snug">
          {event.message}
        </p>
        {#if event.score}
          <p class="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
            <img src={getTeamLogo(event.homeTeam, 16)} alt="" class="w-4 h-4 rounded-full" />
            {event.homeTeam} {event.score} {event.awayTeam}
            <img src={getTeamLogo(event.awayTeam, 16)} alt="" class="w-4 h-4 rounded-full" />
          </p>
        {/if}
      </div>
    {/each}
  </div>
{/if}
