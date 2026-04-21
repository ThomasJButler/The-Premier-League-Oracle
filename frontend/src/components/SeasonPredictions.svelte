<script lang="ts">
  import { onMount } from 'svelte';
  import { PREMIER_LEAGUE_GAMEWEEKS } from '../lib/constants';
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { CalendarCheck, Sparkles, Loader2 } from 'lucide-svelte';

  // Scaffold state — chunk 2 will wire these to real data.
  let isPredicting = false;
  let completed = 0;
  let total = 0;

  const gameweeks = Array.from({ length: PREMIER_LEAGUE_GAMEWEEKS }, (_, i) => i + 1);

  onMount(() => {
    // chunk 2: load dataService.getCurrentSeasonMatches() here.
  });

  function handlePredictAll() {
    // chunk 2 will implement the real batch loop.
  }
</script>

<section class="space-y-6" aria-labelledby="season-predictions-heading">
  <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 id="season-predictions-heading" class="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
        <CalendarCheck class="h-7 w-7 text-primary" aria-hidden="true" />
        Season Predictions
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Run the ensemble across every fixture in the 2025/26 Premier League season and browse the predictions by gameweek.
      </p>
    </div>

    <Button disabled={isPredicting} on:click={handlePredictAll} class="shrink-0">
      {#if isPredicting}
        <Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        Predicting {completed}/{total}
      {:else}
        <Sparkles class="mr-2 h-4 w-4" aria-hidden="true" />
        Predict Whole Season
      {/if}
    </Button>
  </header>

  <Card class="p-6">
    <div class="flex items-start gap-3">
      <Sparkles class="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div class="space-y-1 text-sm text-muted-foreground">
        <p class="font-medium text-foreground">Coming together over the next few commits</p>
        <p>
          This page will orchestrate predictions for all {PREMIER_LEAGUE_GAMEWEEKS} gameweeks
          (~380 fixtures) using the ensemble model, with cache-first resumability and a
          progress indicator. Each gameweek below will expand to show its predictions.
        </p>
      </div>
    </div>
  </Card>

  <ol class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Gameweeks">
    {#each gameweeks as gw (gw)}
      <li>
        <Card class="p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-foreground">Gameweek {gw}</span>
            <Badge variant="secondary" class="text-xs">—</Badge>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">No predictions yet</p>
        </Card>
      </li>
    {/each}
  </ol>
</section>
