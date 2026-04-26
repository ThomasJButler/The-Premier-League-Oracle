<script lang="ts">
  import type { CalibrationBin } from '../../services/predictionTracker';

  export let bins: CalibrationBin[];
  export let width: number = 240;
  export let height: number = 160;

  const PAD = 8;

  $: isEmpty = bins.every((b) => b.sampleCount === 0);
  $: maxSamples = Math.max(1, ...bins.map((b) => b.sampleCount));

  const innerW = (w: number) => w - PAD * 2;
  const innerH = (h: number) => h - PAD * 2;

  $: toX = (predicted: number) => PAD + predicted * innerW(width);
  $: toY = (actual: number) => PAD + (1 - actual) * innerH(height);

  function radius(sampleCount: number, max: number): number {
    if (sampleCount === 0) return 0;
    const scale = Math.sqrt(sampleCount / max);
    return Math.max(2, Math.min(8, scale * 8));
  }
</script>

<svg
  {width}
  {height}
  viewBox="0 0 {width} {height}"
  role="img"
  aria-label="10-bin calibration curve: predicted confidence vs actual hit rate"
>
  <line
    data-curve-diagonal
    x1={toX(0)}
    y1={toY(0)}
    x2={toX(1)}
    y2={toY(1)}
    stroke="hsl(var(--border-strong))"
    stroke-width="1"
    stroke-dasharray="4 3"
  />

  {#if isEmpty}
    <text
      data-curve-empty
      x={width / 2}
      y={height / 2}
      text-anchor="middle"
      dominant-baseline="central"
      fill="hsl(var(--text-dim))"
      class="text-body-sm"
    >
      —
    </text>
  {:else}
    {#each bins as b (b.bin)}
      {#if b.sampleCount > 0}
        <circle
          data-curve-point
          data-bin={b.bin}
          cx={toX(b.predicted)}
          cy={toY(b.actual)}
          r={radius(b.sampleCount, maxSamples)}
          fill="hsl(var(--accent))"
          fill-opacity="0.85"
          stroke="hsl(var(--accent))"
          stroke-width="1"
        />
      {/if}
    {/each}
  {/if}
</svg>
