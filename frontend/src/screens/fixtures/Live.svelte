<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import LiveBanner from '../../components/fixtures/LiveBanner.svelte';
  import type { Match } from '../../types';
  import type { MatchPrediction } from '../../types/redesign';

  const POLL_INTERVAL_MS = 30_000;

  let liveMatches: Match[] = [];
  let loaded = false;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;

  function pickPredictionForMatch(matchId: string): MatchPrediction | undefined {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  function bannerScore(m: Match): string {
    const h = m.home_goals ?? 0;
    const a = m.away_goals ?? 0;
    return `${h}-${a}`;
  }

  function bannerMinute(m: Match): number {
    return m.minute ?? 0;
  }

  async function poll(): Promise<void> {
    if (document.hidden) return;
    try {
      liveMatches = await dataService.getLiveMatches();
    } catch {
      // Keep current state on transient failure — UI shouldn't blank out mid-session.
    }
  }

  function startPolling(): void {
    if (pollIntervalId !== null) return;
    pollIntervalId = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  export async function load(): Promise<void> {
    try {
      liveMatches = await dataService.getLiveMatches();
    } catch {
      liveMatches = [];
    }
    loaded = true;
    startPolling();
  }

  onMount(load);

  onDestroy(stopPolling);
</script>

<div class="flex flex-col gap-4 px-4 py-6" data-screen="fixtures-live">
  {#if loaded && liveMatches.length === 0}
    <div class="text-center text-text-dim py-8" data-live-empty>
      No matches in play right now. Check back during a kickoff window.
    </div>
  {:else}
    {#each liveMatches as match (match.id)}
      {@const fx = matchToFixture(match)}
      <div data-live-row>
        <LiveBanner minute={bannerMinute(match)} score={bannerScore(match)} />
        <MatchCard fixture={fx} prediction={pickPredictionForMatch(match.id)} />
      </div>
    {/each}
  {/if}
</div>
