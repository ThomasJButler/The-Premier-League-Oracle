<script lang="ts">
  import { predictionTracker, type StoredPrediction } from '../../services/predictionTracker';
  import { storedPredictionToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import { filterPredictionLog, type LogFilterId } from '../../lib/predictionFilters';
  import { exportCsv } from '../../lib/export/csv';
  import { exportMarkdown } from '../../lib/export/markdown';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import MatchRow from '../../components/matchcard/MatchRow.svelte';
  import LogFilterChips from '../../components/predictions/LogFilterChips.svelte';

  // Tracker GCs entries > 90 days old at construction, so 1000 is "all available".
  const allPredictions: StoredPrediction[] = predictionTracker.getRecentPredictions(1000);

  let activeFilter: LogFilterId = 'last30';

  $: rows = filterPredictionLog(allPredictions, activeFilter);
  $: hasAnyStored = allPredictions.length > 0;
  $: hasFilteredRows = rows.length > 0;

  function handleFilterChange(next: LogFilterId): void {
    activeFilter = next;
  }
</script>

<div class="flex flex-col gap-4 px-4 py-6" data-screen="predictions-log">
  <SectionHeader kicker="HISTORICAL RECORD" title="Prediction log">
    <svelte:fragment slot="right">
      <button
        type="button"
        class="text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5"
        data-export="csv"
        on:click={() => exportCsv(rows)}
      >
        Export CSV
      </button>
      <button
        type="button"
        class="ml-2 text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="pdf"
      >
        Export PDF
      </button>
      <button
        type="button"
        class="ml-2 text-body-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5"
        data-export="markdown"
        on:click={() => exportMarkdown(rows)}
      >
        Export Markdown
      </button>
    </svelte:fragment>
  </SectionHeader>

  <LogFilterChips active={activeFilter} onChange={handleFilterChange} />

  {#if !hasAnyStored}
    <div class="text-center text-text-dim py-8" data-no-stored>
      No predictions on record yet. Generate a few from the Today screen and revisit.
    </div>
  {:else if !hasFilteredRows}
    <div class="text-center text-text-dim py-8" data-no-history>
      No predictions match the active filter. Try widening the date range.
    </div>
  {:else}
    <div class="rounded-lg border border-border bg-bg-raised overflow-hidden" data-log-table>
      {#each rows as pred (pred.id)}
        {@const fx = storedPredictionToFixture(pred)}
        {@const v3 = predictionToV3(pred)}
        <div data-card-row>
          <MatchRow fixture={fx} prediction={v3} />
        </div>
      {/each}
    </div>
  {/if}
</div>
