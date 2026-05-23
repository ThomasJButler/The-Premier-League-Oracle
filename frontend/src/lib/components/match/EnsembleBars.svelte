<script lang="ts">
  import type { ModelBreakdown } from '../../../types/redesign';

  interface Props {
    models: ModelBreakdown[];
    homeAbbr: string;
    awayAbbr: string;
  }

  const { models, homeAbbr, awayAbbr }: Props = $props();

  function leanLabel(lean: ModelBreakdown['lean']): string {
    return lean === 'H' ? homeAbbr : lean === 'A' ? awayAbbr : 'DRAW';
  }

  function leanPct(confidence: number): number {
    return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  }
</script>

<section class="kicker-ensemble bg-paper-warm border border-ink p-5" data-ensemble-bars>
  <header
    class="flex items-center justify-between text-[10px] tracking-[0.3em] font-bold uppercase pb-2 mb-3 border-b border-ink text-ink"
  >
    <span data-ensemble-title>MODEL ENSEMBLE</span>
    <span class="text-ink-dim font-mono">{models.length} MODELS</span>
  </header>

  <ol class="grid gap-2" data-ensemble-list>
    {#each models as model (model.name)}
      <li
        class="grid grid-cols-[72px_60px_1fr_44px] items-center gap-3"
        data-ensemble-row
        data-ensemble-model={model.name}
      >
        <span
          class="font-sans text-[10px] tracking-[0.3em] font-bold uppercase text-ink"
          data-ensemble-row-name
        >
          {model.name}
        </span>
        <span
          class="font-mono text-[11px] tracking-widest font-bold uppercase text-red"
          data-ensemble-row-lean
        >
          {leanLabel(model.lean)}
        </span>
        <span
          class="block h-2 border border-ink overflow-hidden"
          aria-hidden="true"
          data-ensemble-row-bar
        >
          <span
            class="block h-full"
            style="width: {leanPct(model.confidence)}%; background: var(--persona-accent, var(--ink));"
            data-ensemble-row-fill
          ></span>
        </span>
        <span
          class="font-mono text-[11px] text-right text-ink"
          data-ensemble-row-pct
        >
          {leanPct(model.confidence)}%
        </span>
      </li>
    {/each}
  </ol>
</section>
