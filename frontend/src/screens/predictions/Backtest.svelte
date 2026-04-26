<script lang="ts">
  import { predictionTracker } from '../../services/predictionTracker';
  import { calibrationIndex } from '../../lib/calibrationIndex';
  import SectionHeader from '../../components/atoms/SectionHeader.svelte';
  import KpiTile from '../../components/atoms/KpiTile.svelte';
  import Spark from '../../components/atoms/Spark.svelte';
  import CalibrationCurve from '../../components/predictions/CalibrationCurve.svelte';

  $: stats = predictionTracker.getAccuracyStats(365);
  $: gwHistory = predictionTracker.getAccuracyByGameweek();
  $: factors = predictionTracker.getCalibrationFactors();
  $: curve = predictionTracker.getCalibrationCurve(10);
  $: calIndex = calibrationIndex(factors);
  $: hasHistory = stats.totalPredictions > 0;
</script>

<div class="flex flex-col gap-6 px-4 py-6" data-screen="predictions-backtest">
  <SectionHeader kicker="MODEL PERFORMANCE" title="Backtest">
    <svelte:fragment slot="right">
      <button
        type="button"
        class="text-body-sm text-text-dim border border-border rounded px-3 py-1.5 cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
        data-export-placeholder
        data-export="csv"
      >
        Export CSV
      </button>
    </svelte:fragment>
  </SectionHeader>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" data-kpi-grid>
    <div data-kpi="brier">
      <KpiTile label="Brier" value={hasHistory ? stats.brierScore.toFixed(3) : '—'} />
    </div>
    <div data-kpi="calibration-index">
      <KpiTile label="Calibration Index" value={hasHistory ? calIndex.toFixed(2) : '—'} />
    </div>
    <div data-kpi="roi">
      <KpiTile label="ROI per market" value="—" />
      <span class="sr-only" data-roi-placeholder>
        ROI requires odds data — pending P4 follow-up
      </span>
    </div>
    <div data-kpi="outcome-accuracy">
      <KpiTile
        label="Outcome accuracy"
        value={hasHistory ? `${stats.accuracy.toFixed(1)}%` : '—'}
      />
    </div>
  </div>

  {#if !hasHistory}
    <div class="text-center text-text-dim py-8" data-no-history>
      No settled predictions on record yet. Run a gameweek's predictions and revisit after
      results land.
    </div>
  {/if}

  <div class="rounded-lg border border-border bg-bg-raised p-4" data-calibration-curve>
    <h3 class="text-eyebrow text-text-dim mb-2">10-BIN CALIBRATION CURVE</h3>
    <CalibrationCurve bins={curve} />
  </div>

  <div class="rounded-lg border border-border bg-bg-raised p-4" data-gw-spark>
    <h3 class="text-eyebrow text-text-dim mb-2">ACCURACY BY GAMEWEEK</h3>
    {#if gwHistory.length === 0}
      <p class="text-body-sm text-text-dim" data-spark-empty>
        No gameweek-tagged accuracy data yet.
      </p>
    {:else}
      <Spark data={gwHistory.map((g) => g.accuracy)} width={240} height={48} />
    {/if}
  </div>

  <div class="rounded-lg border border-border bg-bg-raised overflow-hidden" data-roi-table>
    <table class="w-full text-body-sm">
      <thead class="text-eyebrow text-text-dim">
        <tr>
          <th class="text-left px-4 py-2">MARKET</th>
          <th class="text-right px-4 py-2">SETTLED</th>
          <th class="text-right px-4 py-2">ROI</th>
        </tr>
      </thead>
      <tbody>
        {#each ['1X2', 'BTTS', 'Over 2.5', 'Correct Score'] as market (market)}
          <tr class="border-t border-border">
            <td class="px-4 py-2 text-text">{market}</td>
            <td class="px-4 py-2 text-right text-text-dim" data-roi-placeholder>—</td>
            <td class="px-4 py-2 text-right text-text-dim" data-roi-placeholder>—</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
