<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import { groupMatchesByDate } from '../../lib/fixtureGrouping';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import FilterChips, { type FilterId } from '../../components/fixtures/FilterChips.svelte';
  import type { Match } from '../../types';
  import type { MatchPrediction } from '../../types/redesign';

  const TOP_6 = new Set([
    'Manchester City',
    'Arsenal FC',
    'Liverpool FC',
    'Manchester United',
    'Chelsea FC',
    'Tottenham Hotspur',
  ]);

  // MVP placeholder: hardcoded bottom-3 candidates. A standings-derived set is
  // a P3c follow-up (the standings hub is the natural source of truth).
  const RELEGATION = new Set(['Sheffield United FC', 'Burnley FC', 'Luton Town FC']);

  let matches: Match[] = [];
  let loaded = false;
  let activeFilter: FilterId = 'all';

  function pickPredictionForMatch(matchId: string): MatchPrediction | undefined {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  function applyFilter(ms: Match[], f: FilterId): Match[] {
    if (f === 'all' || f === 'tv') return ms;
    if (f === 'top6') {
      return ms.filter((m) => TOP_6.has(m.home_team) || TOP_6.has(m.away_team));
    }
    if (f === 'relegation') {
      return ms.filter((m) => RELEGATION.has(m.home_team) || RELEGATION.has(m.away_team));
    }
    return ms;
  }

  $: filteredMatches = applyFilter(matches, activeFilter);
  $: groups = groupMatchesByDate(filteredMatches);

  export async function load(): Promise<void> {
    try {
      matches = await dataService.getCurrentSeasonMatches();
    } catch {
      matches = [];
    }
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-6 py-6" data-screen="fixtures-matches">
  <FilterChips active={activeFilter} onChange={(next) => (activeFilter = next)} />

  {#if loaded}
    {#if groups.length === 0}
      <div class="px-4 py-8 text-center text-text-dim" data-matches-empty>
        No fixtures match the current filter.
      </div>
    {:else}
      {#each groups as group (group.isoDate)}
        <section
          class="flex flex-col gap-3 px-4"
          data-fixture-group
          data-iso-date={group.isoDate}
        >
          <SectionHeader kicker={group.dateLabel} title={group.countLabel} />
          {#each group.matches as match (match.id)}
            {@const fx = matchToFixture(match)}
            <MatchCard fixture={fx} prediction={pickPredictionForMatch(match.id)} />
          {/each}
        </section>
      {/each}
    {/if}
  {/if}
</div>
