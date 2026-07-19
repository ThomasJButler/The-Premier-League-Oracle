<script lang="ts">
  interface Props {
    home: string;
    away: string;
    homeColor: string;
    awayColor: string;
    probH: number;
    probD: number;
    probA: number;
    marketImpliedH?: number;
    marketImpliedD?: number;
    marketImpliedA?: number;
    pick: string;
    conf: number;
    valueEdge?: number;
    status?: 'pending' | 'settled';
  }

  const {
    home,
    away,
    homeColor,
    awayColor,
    probH,
    probD,
    probA,
    marketImpliedH,
    marketImpliedD,
    marketImpliedA,
    pick,
    conf,
    valueEdge,
    status = 'pending'
  }: Props = $props();

  const homePct = $derived(Math.round(probH * 100));
  const drawPct = $derived(Math.round(probD * 100));
  const awayPct = $derived(Math.round(probA * 100));

  const hasGhost = $derived(
    marketImpliedH !== undefined &&
      marketImpliedD !== undefined &&
      marketImpliedA !== undefined
  );

  const edgePct = $derived(
    valueEdge !== undefined ? Math.round(valueEdge * 100) : null
  );
  const edgeSign = $derived(
    edgePct === null ? null : edgePct > 0 ? 'positive' : edgePct < 0 ? 'negative' : 'zero'
  );
  const edgeLabel = $derived(
    edgePct === null
      ? ''
      : `${edgePct > 0 ? '+' : ''}${edgePct}pp`
  );
</script>

{#snippet bars()}
  <div
    class="relative h-1.5 flex border border-rule-strong overflow-hidden"
    data-prediction-bar
    aria-label="Model probability: home {homePct}%, draw {drawPct}%, away {awayPct}%"
  >
    <div
      data-prediction-bar-home
      style="width: {probH * 100}%; background-color: {homeColor};"
    ></div>
    <div
      class="bg-ink-faint"
      style="width: {probD * 100}%;"
      data-prediction-bar-draw
    ></div>
    <div
      data-prediction-bar-away
      style="width: {probA * 100}%; background-color: {awayColor};"
    ></div>
  </div>

  {#if hasGhost}
    <div
      class="relative h-1 flex mt-0.5 opacity-40"
      data-prediction-ghost-bar
      aria-label="Market implied: home {Math.round(marketImpliedH! * 100)}%, draw {Math.round(marketImpliedD! * 100)}%, away {Math.round(marketImpliedA! * 100)}%"
    >
      <div
        data-prediction-ghost-home
        style="width: {marketImpliedH! * 100}%; background-color: {homeColor};"
      ></div>
      <div
        class="bg-ink-faint"
        style="width: {marketImpliedD! * 100}%;"
        data-prediction-ghost-draw
      ></div>
      <div
        data-prediction-ghost-away
        style="width: {marketImpliedA! * 100}%; background-color: {awayColor};"
      ></div>
    </div>
  {/if}

  <div
    class="flex justify-between mt-1 text-[9px] font-mono text-ink-dim"
    data-prediction-prob-readout
  >
    <span>{homePct}%</span>
    <span>{drawPct}%</span>
    <span>{awayPct}%</span>
  </div>
{/snippet}

{#snippet trailingChip()}
  {#if edgePct !== null}
    <div
      class="text-center font-mono text-[10px] tracking-widest font-bold px-2 py-1 border {edgeSign ===
      'positive'
        ? 'text-green border-green'
        : edgeSign === 'negative'
          ? 'text-red border-red'
          : 'text-ink-dim border-rule'}"
      data-prediction-edge
      data-prediction-edge-sign={edgeSign}
    >
      {edgeLabel}
    </div>
  {:else}
    <div
      class="text-[9px] tracking-widest font-bold px-2 py-1 text-center bg-paper-inset text-ink-dim border border-rule"
      data-prediction-status-chip
    >
      {status === 'settled' ? 'SETTLED' : 'PENDING'}
    </div>
  {/if}
{/snippet}

<!-- Mobile layout (below lg): two-column stack -->
<div
  class="lg:hidden flex flex-col gap-2 px-3 py-3 bg-paper-warm border border-rule"
  data-prediction-row
  data-prediction-status={status}
  data-prediction-layout="mobile"
>
  <div class="flex justify-between items-start gap-3">
    <div
      class="font-serif text-[15px] font-bold text-ink leading-tight"
      data-prediction-fixture
    >
      {home} v {away}
    </div>
    <div class="flex flex-col items-end leading-none shrink-0">
      <span
        class="font-mono font-extrabold text-[15px] text-red tracking-[-0.02em]"
        data-prediction-pick
      >
        {pick}
      </span>
      <span
        class="font-mono text-[9px] text-ink-dim mt-1"
        data-prediction-conf
      >
        {conf}% CONF
      </span>
    </div>
  </div>

  <div data-prediction-bars>
    {@render bars()}
  </div>

  <div class="flex justify-end">
    {@render trailingChip()}
  </div>
</div>

<!-- Desktop layout (lg and up): original 5-column grid -->
<div
  class="hidden lg:grid gap-4 items-center px-4 py-3 bg-paper-warm border border-rule"
  style="grid-template-columns: 1fr 80px 180px 100px 80px;"
  data-prediction-row
  data-prediction-status={status}
  data-prediction-layout="desktop"
>
  <div
    class="font-serif text-[16px] font-bold text-ink leading-none"
    data-prediction-fixture
  >
    {home} v {away}
  </div>

  <div
    class="font-mono font-extrabold text-[18px] text-red text-center tracking-[-0.02em]"
    data-prediction-pick
  >
    {pick}
  </div>

  <div data-prediction-bars>
    {@render bars()}
  </div>

  <div
    class="text-center font-mono text-[10px] text-ink-dim"
    data-prediction-conf
  >
    {conf}% CONF
  </div>

  {@render trailingChip()}
</div>
