<script lang="ts">
  import { onMount } from 'svelte';
  import MatchSheetCard from '$lib/components/match/MatchSheetCard.svelte';
  import { dataService } from '../../../services/dataService';
  import { getTeamColor } from '../../../utils/teamLogos';
  import type { Match } from '../../../types';

  let matches = $state<Match[]>([]);
  let loaded = $state(false);

  function formatKickoff(date: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    })
      .format(new Date(date))
      .toUpperCase();
  }

  function toCard(m: Match) {
    return {
      home: m.home_team,
      homeAbbr: m.home_team.slice(0, 3).toUpperCase(),
      homeColor: getTeamColor(m.home_team),
      away: m.away_team,
      awayAbbr: m.away_team.slice(0, 3).toUpperCase(),
      awayColor: getTeamColor(m.away_team),
      kickoff: formatKickoff(m.date),
      venue: 'PREMIER LEAGUE',
      probH: 0.4,
      probD: 0.3,
      probA: 0.3
    };
  }

  onMount(async () => {
    try {
      const upcoming = await dataService.getMatches({ upcoming: true, days: 3 });
      matches = upcoming.slice(0, 4);
    } catch {
      // Swallow — rail just stays empty if the API key isn't configured.
    }
    loaded = true;
  });
</script>

<section class="kicker-today-fixture-rail" data-today-fixture-rail>
  <div class="flex items-center justify-between border-b border-ink pb-2 mb-3">
    <h3 class="font-sans text-[10px] tracking-[0.3em] uppercase font-bold text-red">
      Up Next
    </h3>
    <span class="font-mono text-[9px] tracking-[0.25em] uppercase text-ink-dim">
      72h Window
    </span>
  </div>

  {#if !loaded}
    <p
      class="font-serif italic text-[12px] text-ink-dim"
      data-today-fixture-loading
    >
      Loading the slate…
    </p>
  {:else if matches.length === 0}
    <p
      class="font-serif italic text-[12px] text-ink-dim"
      data-today-fixture-empty
    >
      No upcoming fixtures in the next 72 hours.
    </p>
  {:else}
    <div class="flex flex-col" data-today-fixture-stack>
      {#each matches as m (m.id)}
        <MatchSheetCard {...toCard(m)} />
      {/each}
    </div>
  {/if}
</section>
