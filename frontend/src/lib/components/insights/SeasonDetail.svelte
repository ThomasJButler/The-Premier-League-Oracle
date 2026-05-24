<script lang="ts">
  import type { SeasonRecord } from '$lib/fixtures/leagueHistory';
  import type { SeasonStats } from '$lib/data/statsPack';

  interface Props {
    record: SeasonRecord;
    seasonStats?: SeasonStats;
    /** Cached persona-voiced verdict body, or null when no verdict on file. */
    verdictBody?: string | null;
    personaName: string;
    /** Click handler for the "Generate verdict" / "Regenerate" CTA. */
    onGenerate?: () => void;
    /** When true, the CTA renders a disabled "Filing copy…" label. */
    generating?: boolean;
    /** Surfaced inline under the verdict when the last generation attempt failed. */
    generateError?: string | null;
  }

  const {
    record,
    seasonStats,
    verdictBody,
    personaName,
    onGenerate,
    generating = false,
    generateError = null
  }: Props = $props();

  const formatPct = (v: number): string => `${Math.round(v * 100)}%`;
</script>

<article class="border border-rule p-5 space-y-5" data-season-detail data-season={record.season}>
  <header class="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
    <div>
      <p class="font-mono text-[10px] tracking-[0.3em] uppercase text-red font-bold" data-detail-kicker>SEASON ON FILE</p>
      <h3 class="font-serif text-[36px] leading-none font-bold text-ink" data-detail-season>{record.season}</h3>
    </div>
    {#if record.inProgress}
      <span class="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft" data-detail-status>IN PROGRESS</span>
    {/if}
  </header>

  {#if record.champion && record.runnerUp}
    <section class="space-y-3" data-detail-trophy>
      <div class="grid items-baseline gap-3" style="grid-template-columns: 96px minmax(0, 1fr) auto;">
        <span class="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-dim">CHAMPION</span>
        <span class="font-serif text-[20px] text-ink" data-detail-champion>{record.champion.team}</span>
        <span class="font-mono text-[12px] text-ink-soft tabular-nums" data-detail-champion-meta>
          {record.champion.points} pts · GD {record.champion.goalDifference >= 0 ? '+' : ''}{record.champion.goalDifference}
        </span>
      </div>
      <div class="grid items-baseline gap-3" style="grid-template-columns: 96px minmax(0, 1fr) auto;">
        <span class="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-dim">RUNNER-UP</span>
        <span class="font-serif text-[16px] text-ink-soft" data-detail-runnerup>{record.runnerUp.team}</span>
        <span class="font-mono text-[12px] text-ink-soft tabular-nums" data-detail-runnerup-meta>
          {record.runnerUp.points} pts
        </span>
      </div>
    </section>
  {:else}
    <section class="space-y-2" data-detail-trophy-pending>
      <p class="font-serif italic text-ink-dim text-[14px]">No champion crowned yet — this season is still in progress.</p>
    </section>
  {/if}

  {#if seasonStats}
    <section class="grid grid-cols-2 sm:grid-cols-4 gap-2" data-detail-stats>
      <div class="border border-rule p-3" data-detail-stat="matches">
        <p class="font-sans text-[10px] tracking-[0.22em] uppercase text-ink-dim">MATCHES</p>
        <p class="font-serif text-[22px] leading-none text-ink tabular-nums">{seasonStats.matches}</p>
      </div>
      <div class="border border-rule p-3" data-detail-stat="goals">
        <p class="font-sans text-[10px] tracking-[0.22em] uppercase text-ink-dim">GOALS / MATCH</p>
        <p class="font-serif text-[22px] leading-none text-ink tabular-nums">{seasonStats.avgTotalGoals.toFixed(2)}</p>
      </div>
      <div class="border border-rule p-3" data-detail-stat="home">
        <p class="font-sans text-[10px] tracking-[0.22em] uppercase text-ink-dim">HOME WIN RATE</p>
        <p class="font-serif text-[22px] leading-none text-ink tabular-nums">{formatPct(seasonStats.homeWinRate)}</p>
      </div>
      <div class="border border-rule p-3" data-detail-stat="btts">
        <p class="font-sans text-[10px] tracking-[0.22em] uppercase text-ink-dim">BTTS</p>
        <p class="font-serif text-[22px] leading-none text-ink tabular-nums">{formatPct(seasonStats.bttsRate)}</p>
      </div>
    </section>

    {#if seasonStats.isAnomalous && seasonStats.anomalyReasons.length > 0}
      <section class="border-l-4 border-red bg-paper-warm p-3" data-detail-anomaly>
        <p class="font-mono text-[10px] tracking-[0.25em] uppercase text-red font-bold mb-1">OUTLIER SEASON</p>
        <ul class="font-serif text-[14px] text-ink space-y-1">
          {#each seasonStats.anomalyReasons as reason (reason)}
            <li data-detail-anomaly-reason>{reason}</li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}

  <section class="border-t border-rule pt-4" data-detail-verdict>
    <div class="flex items-baseline justify-between gap-3 mb-2">
      <p class="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-dim">
        Verdict · {personaName}
      </p>
      {#if onGenerate}
        <button
          type="button"
          class="font-mono text-[10px] tracking-[0.25em] uppercase text-red font-bold disabled:text-ink-dim disabled:cursor-not-allowed"
          data-verdict-generate
          disabled={generating}
          onclick={onGenerate}
        >
          {#if generating}
            <span data-verdict-generating>Filing copy…</span>
          {:else if verdictBody}
            Regenerate
          {:else}
            Generate verdict
          {/if}
        </button>
      {/if}
    </div>
    {#if verdictBody}
      <p class="font-serif text-[16px] leading-snug text-ink" data-verdict-body>{verdictBody}</p>
    {:else}
      <p class="font-serif italic text-ink-dim text-[14px]" data-verdict-empty>
        No verdict on file yet. {personaName} hasn't filed copy for this season — tap Generate verdict to commission one.
      </p>
    {/if}
    {#if generateError}
      <p class="font-mono text-[11px] uppercase tracking-[0.15em] text-red mt-2" data-verdict-error>
        ⚠ {generateError}
      </p>
    {/if}
  </section>
</article>
