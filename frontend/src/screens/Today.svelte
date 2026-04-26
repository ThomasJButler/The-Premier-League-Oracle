<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { findCurrentGameweek, fixturesForGameweek, nextKickoff } from '../lib/gameweek';
  import { matchToFixture, predictionToV3 } from '../lib/adapters/v3';
  import MatchCard from '../components/matchcard/MatchCard.svelte';
  import KpiTile from '../components/atoms/KpiTile.svelte';
  import CommandStrip from '../components/today/CommandStrip.svelte';
  import type { Match } from '../types';
  import type { Fixture, MatchPrediction } from '../types/redesign';

  const BRIER_HIGHLIGHT_THRESHOLD = 0.25;

  let matches: Match[] = [];
  let loaded = false;
  let brierState: 'default' | 'highlight' = 'default';

  $: gameweek = loaded ? findCurrentGameweek(matches) : null;
  $: heroMatch = loaded ? nextKickoff(matches) : null;
  $: heroFixture = heroMatch ? matchToFixture(heroMatch) : null;
  $: heroPrediction = pickPredictionForMatch(heroFixture);
  $: kickoffIso = heroMatch?.date ?? null;

  $: stats = predictionTracker.getAccuracyStats();
  $: apiHealthy = isApiHealthy(loaded);
  $: gridFixtures =
    gameweek !== null && loaded
      ? fixturesForGameweek(matches, gameweek).filter((m) => m.id !== heroFixture?.id)
      : [];
  $: brierState = stats.brierScore > BRIER_HIGHLIGHT_THRESHOLD ? 'highlight' : 'default';


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

  {#if loaded}
    <div class="px-4 grid grid-cols-2 lg:grid-cols-4 gap-3" data-zone="kpi-strip">
      <div data-tile="picks">
        <KpiTile label="Picks" value={String(stats.totalPredictions)} />
      </div>
      <div data-tile="accuracy">
        <KpiTile label="Accuracy" value={`${Math.round(stats.accuracy)}%`} />
      </div>
      <div data-tile="brier" data-state={brierState}>
        <KpiTile
          label="Brier"
          value={stats.brierScore.toFixed(2)}
          state={brierState}
        />
      </div>
      <div data-tile="avg-confidence">
        <KpiTile
          label="Avg Confidence"
          value={`${Math.round(stats.averageConfidence * 100)}%`}
        />
      </div>
    </div>

    {#if gridFixtures.length > 0}
      <div class="px-4 grid grid-cols-1 lg:grid-cols-2 gap-3" data-zone="grid">
        {#each gridFixtures as match (match.id)}
          {@const fx = matchToFixture(match)}
          <MatchCard fixture={fx} prediction={pickPredictionForMatch(fx)} />
        {/each}
      </div>
    {:else}
      <div class="px-4 text-text-dim text-body-sm" data-zone="grid-empty">
        No more fixtures in this gameweek.
      </div>
    {/if}
  {/if}
</div>
