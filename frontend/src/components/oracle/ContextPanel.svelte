<script lang="ts">
  import KpiTile from '../atoms/KpiTile.svelte';
  import MatchRow from '../matchcard/MatchRow.svelte';
  import type { Fixture } from '../../types/redesign';

  export let stats: { totalPicks: number; accuracy: number; brierScore: number } | null = null;
  export let recentFixtures: Fixture[] = [];

  const FIXTURE_CAP = 3;

  $: cappedFixtures = recentFixtures.slice(0, FIXTURE_CAP);
  $: hasStats = stats !== null;
  $: hasFixtures = cappedFixtures.length > 0;
  $: isEmpty = !hasStats && !hasFixtures;
  $: accuracyDisplay = stats ? Number(stats.accuracy.toFixed(1)) : 0;
</script>

<aside
  data-context-panel
  class="flex flex-col gap-4 p-3 bg-bg-raised border-l border-border/40 h-full overflow-y-auto"
  aria-label="Oracle context"
>
  {#if isEmpty}
    <div data-context-empty class="flex flex-col items-center justify-center text-center py-8 gap-2 text-text-dim">
      <p class="text-body font-medium text-foreground">No context yet</p>
      <p class="text-body-sm">Predictions and discussed fixtures will appear here.</p>
    </div>
  {/if}

  {#if hasStats && stats}
    <section aria-label="Prediction stats">
      <div data-kpi-grid class="grid grid-cols-2 gap-2">
        <KpiTile label="Picks" value={stats.totalPicks} />
        <KpiTile label="Accuracy" value={accuracyDisplay} suffix="%" />
      </div>
    </section>
  {/if}

  {#if hasFixtures}
    <section data-recent-fixtures aria-label="Recently discussed fixtures" class="flex flex-col gap-2">
      <h3 class="text-eyebrow">Recently discussed</h3>
      <div class="rounded-lg border border-border/40 overflow-hidden">
        {#each cappedFixtures as fixture (fixture.id)}
          <div data-fixture-row>
            <MatchRow {fixture} />
          </div>
        {/each}
      </div>
    </section>
  {/if}
</aside>
