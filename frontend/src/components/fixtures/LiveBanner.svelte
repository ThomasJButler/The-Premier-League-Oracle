<script lang="ts">
  export let minute: number;
  export let score: string;
  export let xgHome: number | undefined = undefined;
  export let xgAway: number | undefined = undefined;
  export let probShift:
    | { home: number; draw: number; away: number }
    | undefined = undefined;

  $: hasXg = typeof xgHome === 'number' && typeof xgAway === 'number';
  $: hasProbShift = probShift !== undefined;
  $: clampedMinute = Math.min(Math.max(minute, 0), 120);
  $: xgHomeText = typeof xgHome === 'number' ? xgHome.toFixed(2) : '';
  $: xgAwayText = typeof xgAway === 'number' ? xgAway.toFixed(2) : '';
  $: probShiftHomePct = probShift ? Math.round(probShift.home * 100) : 0;
  $: probShiftDrawPct = probShift ? Math.round(probShift.draw * 100) : 0;
  $: probShiftAwayPct = probShift ? Math.round(probShift.away * 100) : 0;
</script>

<div
  class="flex items-center gap-3 px-4 py-2 bg-bg-raised border-l-2 border-destructive"
  data-live-banner
>
  <span
    class="w-2 h-2 rounded-full bg-destructive motion-safe:animate-pulse"
    data-pulse
    aria-hidden="true"
  ></span>
  <span class="text-eyebrow tracking-wide text-text-dim" data-minute>MIN {clampedMinute}'</span>
  <span class="text-metric-lg font-semibold tabular-nums" data-score>{score}</span>

  {#if hasXg}
    <span class="text-body-sm text-text-dim ml-auto" data-xg>
      xG <span class="tabular-nums">{xgHomeText}</span>
      —
      <span class="tabular-nums">{xgAwayText}</span>
    </span>
  {/if}

  {#if hasProbShift}
    <span class="text-body-sm text-text-dim" data-prob-shift>
      Δ {probShiftHomePct}% / {probShiftDrawPct}% / {probShiftAwayPct}%
    </span>
  {/if}
</div>
