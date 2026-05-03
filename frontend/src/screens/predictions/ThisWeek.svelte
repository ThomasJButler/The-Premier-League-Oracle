<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { findCurrentGameweek } from '../../lib/gameweek';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import { exportPdf } from '../../lib/export/pdf';
  import { exportPngCard } from '../../lib/export/pngCard';
  import type { Match } from '../../types';
  import type { MatchPrediction } from '../../types/redesign';

  let allMatches: Match[] = [];
  let loaded = false;
  let gridEl: HTMLElement | undefined;
  let viewedGw: number | null = null;

  $: detectedGw = findCurrentGameweek(allMatches);
  $: availableGws = Array.from(
    new Set(
      allMatches
        .filter((m) => typeof m.matchday === 'number')
        .map((m) => m.matchday as number),
    ),
  ).sort((a, b) => a - b);
  $: minGw = availableGws[0] ?? null;
  $: maxGw = availableGws[availableGws.length - 1] ?? null;
  $: activeGw = viewedGw ?? detectedGw;
  $: gwFixtures =
    activeGw !== null
      ? allMatches
          .filter((m) => m.matchday === activeGw)
          .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      : [];
  $: canPrev = activeGw !== null && minGw !== null && activeGw > minGw;
  $: canNext = activeGw !== null && maxGw !== null && activeGw < maxGw;

  function readGwFromUrl(): number | null {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('gw');
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 38 ? n : null;
  }

  function setGw(next: number): void {
    viewedGw = next;
    navigate(`/predictions/this-week?gw=${next}`, { replace: false });
  }

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
    viewedGw = readGwFromUrl();
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-6 px-4 py-6" data-screen="predictions-this-week">
  <SectionHeader
    kicker={activeGw !== null ? `GAMEWEEK ${activeGw}` : 'PREDICTIONS'}
    title={activeGw !== null && detectedGw !== null && activeGw === detectedGw
      ? "This week's picks"
      : activeGw !== null
        ? `Gameweek ${activeGw}`
        : "This week's picks"}
  >
    <svelte:fragment slot="right">
      <div class="inline-flex items-center gap-1 mr-2" data-gw-nav>
        <button
          type="button"
          class="text-body-sm border border-border rounded px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-raised"
          data-gw-prev
          disabled={!canPrev}
          aria-label="Previous gameweek"
          on:click={() => activeGw !== null && setGw(activeGw - 1)}
        >
          ←
        </button>
        <button
          type="button"
          class="text-body-sm border border-border rounded px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-raised"
          data-gw-next
          disabled={!canNext}
          aria-label="Next gameweek"
          on:click={() => activeGw !== null && setGw(activeGw + 1)}
        >
          →
        </button>
      </div>
      <button
        type="button"
        class="text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded px-3 py-1.5"
        data-export="pdf"
        disabled={!loaded || activeGw === null || gwFixtures.length === 0 || !gridEl}
        on:click={() => gridEl && activeGw !== null && exportPdf({ kind: 'this-week', target: gridEl, gameweek: activeGw })}
      >
        Export PDF
      </button>
      <button
        type="button"
        class="text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded px-3 py-1.5 ml-2"
        data-export="png"
        disabled={!loaded || activeGw === null || gwFixtures.length === 0 || !gridEl}
        on:click={() => gridEl && activeGw !== null && exportPngCard({ kind: 'gw-grid', target: gridEl, gameweek: activeGw })}
      >
        Share PNG
      </button>
    </svelte:fragment>
  </SectionHeader>

  {#if loaded && activeGw === null}
    <div class="text-center text-text-dim py-8" data-no-gameweek>
      No fixtures available right now. Try refreshing once the API has caught up.
    </div>
  {:else if loaded && gwFixtures.length === 0}
    <div class="text-center text-text-dim py-8" data-empty>
      No fixtures in gameweek {activeGw}.
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" bind:this={gridEl}>
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
