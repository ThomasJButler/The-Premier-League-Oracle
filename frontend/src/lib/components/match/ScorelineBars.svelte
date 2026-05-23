<script lang="ts">
  interface Scoreline {
    home: number;
    away: number;
    prob: number;
  }

  interface Props {
    scorelines: Scoreline[];
    homeAbbr: string;
    awayAbbr: string;
    limit?: number;
  }

  const { scorelines, homeAbbr, awayAbbr, limit = 7 }: Props = $props();

  const rows = $derived(scorelines.slice(0, limit));
  const maxProb = $derived(
    rows.length > 0 ? Math.max(...rows.map((r) => r.prob)) : 0
  );

  function pct(prob: number): number {
    return Math.round(Math.max(0, Math.min(1, prob)) * 100);
  }

  function relWidth(prob: number): number {
    if (maxProb <= 0) return 0;
    return Math.round((prob / maxProb) * 100);
  }
</script>

<section class="kicker-scoreline bg-paper-warm border border-ink p-5" data-scoreline-bars>
  <header
    class="flex items-center justify-between text-[10px] tracking-[0.3em] font-bold uppercase pb-2 mb-3 border-b border-ink text-ink"
  >
    <span data-scoreline-title>SCORELINE GRID</span>
    <span class="text-ink-dim font-mono">{homeAbbr} · {awayAbbr}</span>
  </header>

  {#if rows.length === 0}
    <p
      class="font-serif italic text-[13px] text-ink-dim"
      data-scoreline-empty
    >
      No scoreline distribution available.
    </p>
  {:else}
    <ol class="grid gap-2" data-scoreline-list>
      {#each rows as row, idx (`${row.home}-${row.away}-${idx}`)}
        <li
          class="grid grid-cols-[60px_1fr_44px] items-center gap-3"
          data-scoreline-row
          data-scoreline-score="{row.home}-{row.away}"
        >
          <span
            class="font-mono font-extrabold text-[16px] tracking-[-0.02em] text-ink"
            data-scoreline-row-score
          >
            {row.home}<span class="text-ink-faint px-1">·</span>{row.away}
          </span>
          <span
            class="block h-2 border border-ink overflow-hidden"
            aria-hidden="true"
            data-scoreline-row-bar
          >
            <span
              class="block h-full bg-ink"
              style="width: {relWidth(row.prob)}%;"
              data-scoreline-row-fill
            ></span>
          </span>
          <span
            class="font-mono text-[11px] text-right text-ink-dim"
            data-scoreline-row-pct
          >
            {pct(row.prob)}%
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</section>
