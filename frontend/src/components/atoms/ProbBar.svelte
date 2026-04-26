<script lang="ts">
  export let home: number;
  export let draw: number;
  export let away: number;
  export let showLabels: boolean = false;

  $: total = home + draw + away;
  $: invalid = total < 0.999 || total > 1.001;
  $: pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

<div
  class="flex w-full overflow-hidden rounded-full {invalid ? 'bg-warning' : ''}"
  style:height="6px"
  aria-invalid={invalid ? 'true' : undefined}
>
  <span data-seg class="bg-primary" style:width={pct(home)} />
  <span data-seg class="bg-text-faint" style:width={pct(draw)} />
  <span data-seg class="bg-text-dim" style:width={pct(away)} />
</div>

{#if showLabels}
  <div class="flex w-full justify-between text-body-sm font-mono mt-1">
    <span data-label>{pct(home)}</span>
    <span data-label>{pct(draw)}</span>
    <span data-label>{pct(away)}</span>
  </div>
{/if}
