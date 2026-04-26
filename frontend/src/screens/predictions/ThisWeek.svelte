<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { findCurrentGameweek, fixturesForGameweek } from '../../lib/gameweek';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import type { Match } from '../../types';
  import type { MatchPrediction } from '../../types/redesign';

  let allMatches: Match[] = [];
  let loaded = false;

  $: currentGw = findCurrentGameweek(allMatches);
  $: gwFixtures = currentGw !== null ? fixturesForGameweek(allMatches, currentGw) : [];

  function pickPredictionForMatch(matchId: string): MatchPrediction | undefined {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  export async function load(): Promise<void> {
    try {
      allMatches = await dataService.getCurrentSeasonMatches();
    } catch {
      allMatches = [];
    }
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-6 px-4 py-6" data-screen="predictions-this-week">
  <SectionHeader
    kicker={currentGw !== null ? `GAMEWEEK ${currentGw}` : 'PREDICTIONS'}
    title="This week's picks"
  >
    <svelte:fragment slot="right">
      <button
        type="button"
        class="text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="pdf"
      >
        Export PDF
      </button>
      <button
        type="button"
        class="text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60 ml-2"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="png"
      >
        Share PNG
      </button>
    </svelte:fragment>
  </SectionHeader>

  {#if loaded && currentGw === null}
    <div class="text-center text-text-dim py-8" data-no-gameweek>
      No fixtures available right now. Try refreshing once the API has caught up.
    </div>
  {:else if loaded && gwFixtures.length === 0}
    <div class="text-center text-text-dim py-8" data-empty>
      No fixtures left in gameweek {currentGw}.
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {#each gwFixtures as match (match.id)}
        {@const fx = matchToFixture(match)}
        {@const pred = pickPredictionForMatch(match.id)}
        <div data-card-row>
          {#if pred?.divergenceFlag}
            <div
              class="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-eyebrow"
              data-divergence-chip
            >
              ML divergence
            </div>
          {/if}
          <MatchCard fixture={fx} prediction={pred} />
        </div>
      {/each}
    </div>
  {/if}
</div>
