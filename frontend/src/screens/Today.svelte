<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { findCurrentGameweek, nextKickoff } from '../lib/gameweek';
  import { matchToFixture, predictionToV3 } from '../lib/adapters/v3';
  import MatchCard from '../components/matchcard/MatchCard.svelte';
  import CommandStrip from '../components/today/CommandStrip.svelte';
  import type { Match } from '../types';
  import type { Fixture, MatchPrediction } from '../types/redesign';

  let matches: Match[] = [];
  let loaded = false;

  $: gameweek = loaded ? findCurrentGameweek(matches) : null;
  $: heroMatch = loaded ? nextKickoff(matches) : null;
  $: heroFixture = heroMatch ? matchToFixture(heroMatch) : null;
  $: heroPrediction = pickPredictionForMatch(heroFixture);
  $: kickoffIso = heroMatch?.date ?? null;

  $: stats = predictionTracker.getAccuracyStats();
  $: apiHealthy = isApiHealthy(loaded);

  function isApiHealthy(_loaded: boolean): boolean {
    const last = dataService.getLastFetched('matches');
    if (!last) return false;
    return Date.now() - last < 5 * 60 * 1000;
  }

  function pickPredictionForMatch(fx: Fixture | null): MatchPrediction | undefined {
    if (!fx) return undefined;
    const stored = predictionTracker.getMatchPredictions(fx.id)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

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

<div class="flex flex-col gap-6">
  <CommandStrip
    {gameweek}
    {kickoffIso}
    accuracyPct={stats.accuracy}
    {apiHealthy}
  />

  {#if heroFixture}
    <div class="px-4" data-zone="hero">
      <MatchCard
        fixture={heroFixture}
        prediction={heroPrediction}
        variant="emphasised"
        defaultOpen="analyse"
      />
    </div>
  {:else if loaded}
    <div class="px-4 py-8 text-center text-text-dim" data-zone="hero-empty">
      No upcoming fixtures. Check back when the next gameweek opens.
    </div>
  {/if}
</div>
