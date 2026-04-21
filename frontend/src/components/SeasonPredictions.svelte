<script lang="ts">
  import { onMount } from 'svelte';
  import { PREMIER_LEAGUE_GAMEWEEKS } from '../lib/constants';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { OptimizedPredictor } from '../lib/optimizedPredictions';
  import type { Match } from '../types';
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { CalendarCheck, Sparkles, Loader2, AlertTriangle } from 'lucide-svelte';

  const gameweeks = Array.from({ length: PREMIER_LEAGUE_GAMEWEEKS }, (_, i) => i + 1);

  let matches: Match[] = [];
  let countByGameweek = new Map<number, number>();
  let loadError: string | null = null;
  let isLoading = true;
  let isPredicting = false;
  let completed = 0;
  let total = 0;
  let statusMessage = '';

  onMount(async () => {
    try {
      matches = await dataService.getCurrentSeasonMatches();
      countByGameweek = tally(matches);
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Failed to load season matches';
    } finally {
      isLoading = false;
    }
  });

  function tally(ms: Match[]): Map<number, number> {
    const counts = new Map<number, number>();
    for (const m of ms) {
      const gw = m.matchday;
      if (typeof gw !== 'number') continue;
      counts.set(gw, (counts.get(gw) ?? 0) + 1);
    }
    return counts;
  }

  async function handlePredictAll() {
    if (isPredicting || matches.length === 0) return;

    isPredicting = true;
    completed = 0;
    total = matches.length;
    statusMessage = 'Starting…';

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      statusMessage = `Gameweek ${match.matchday ?? '?'} — ${match.home_team} vs ${match.away_team}`;

      try {
        // Pass the pre-fetched season matches as historicalMatches.
        // This activates the ensemble's backtest-mode data path which skips
        // every internal dataService.* call (getStandings, getMatches,
        // getTeamForm, etc.) and uses the provided array for form, H2H, and
        // fatigue calculations. One API fetch on mount, zero during the loop.
        // Trade-off: standings positions come from ELO-derived ranking instead
        // of the live PL table — acceptable for season-wide browsing.
        const result = await OptimizedPredictor.predictMatch(
          match.home_team,
          match.away_team,
          matches,
          match.referee ?? null,
          match.date,
        );

        predictionTracker.storePrediction(
          match.id,
          match.home_team,
          match.away_team,
          {
            predictedResult: result.predictedResult,
            predictedHomeGoals: result.predictedHomeGoals,
            predictedAwayGoals: result.predictedAwayGoals,
            confidence: result.confidence,
          },
          match.date,
          match.matchday ?? 0,
        );
      } catch (err) {
        console.warn(`Prediction failed for match ${match.id}:`, err);
      }

      completed = i + 1;
      // Yield the event loop between predictions so the UI stays responsive.
      await new Promise((r) => setTimeout(r, 0));
    }

    statusMessage = `Predicted ${completed} of ${total} fixtures.`;
    isPredicting = false;
  }

  $: progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
</script>

<section class="space-y-6" aria-labelledby="season-predictions-heading">
  <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 id="season-predictions-heading" class="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
        <CalendarCheck class="h-7 w-7 text-primary" aria-hidden="true" />
        Season Predictions
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Run the ensemble across every fixture in the current Premier League season. {matches.length > 0 ? `${matches.length} fixtures loaded across ${countByGameweek.size} gameweeks.` : ''}
      </p>
    </div>

    <Button
      disabled={isPredicting || isLoading || matches.length === 0}
      on:click={handlePredictAll}
      class="shrink-0"
    >
      {#if isPredicting}
        <Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        Predicting {completed}/{total}
      {:else}
        <Sparkles class="mr-2 h-4 w-4" aria-hidden="true" />
        Predict Whole Season
      {/if}
    </Button>
  </header>

  {#if loadError}
    <Card class="border-destructive/40 bg-destructive/10 p-4">
      <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div class="space-y-1 text-sm">
          <p class="font-medium text-foreground">Could not load season fixtures</p>
          <p class="text-muted-foreground">{loadError}</p>
        </div>
      </div>
    </Card>
  {/if}

  {#if isPredicting || completed > 0}
    <Card class="p-4" aria-live="polite" aria-label="Prediction progress">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium text-foreground">{progressPercent}% complete</span>
        <span class="text-muted-foreground">{completed}/{total}</span>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          class="h-full bg-primary transition-[width] duration-150"
          style="width: {progressPercent}%"
        ></div>
      </div>
      {#if statusMessage}
        <p class="mt-2 truncate text-xs text-muted-foreground">{statusMessage}</p>
      {/if}
    </Card>
  {/if}

  <ol class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Gameweeks">
    {#each gameweeks as gw (gw)}
      {@const fixtureCount = countByGameweek.get(gw) ?? 0}
      <li>
        <Card class="p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-foreground">Gameweek {gw}</span>
            <Badge variant={fixtureCount > 0 ? 'default' : 'secondary'} class="text-xs">
              {fixtureCount > 0 ? `${fixtureCount} matches` : '—'}
            </Badge>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {#if fixtureCount === 0}
              No fixtures loaded
            {:else}
              Predictions run on the button above
            {/if}
          </p>
        </Card>
      </li>
    {/each}
  </ol>
</section>
