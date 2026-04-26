<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let suffix: string | undefined = undefined;
  export let delta: { value: number; format?: 'pct' | 'abs' } | undefined = undefined;
  export let state: 'default' | 'highlight' | 'muted' = 'default';

  $: deltaSign = delta && delta.value > 0 ? '+' : '';
  $: deltaText = delta ? `${deltaSign}${delta.value}${delta.format === 'pct' ? '%' : ''}` : '';
  $: deltaClass = delta
    ? delta.value > 0
      ? 'text-accent'
      : delta.value < 0
        ? 'text-destructive'
        : 'text-text-dim'
    : '';

  $: stateClass =
    state === 'highlight'
      ? 'border-primary/30 ring-1 ring-primary/10'
      : state === 'muted'
        ? 'opacity-60'
        : '';
</script>

<div class="rounded-lg bg-card border border-border p-4 flex flex-col gap-2 {stateClass}">
  <span class="text-eyebrow">{label}</span>
  <span class="flex items-baseline gap-1">
    <span class="text-metric">{value}</span>
    {#if suffix}<span class="text-metric-sm text-text-dim">{suffix}</span>{/if}
  </span>
  {#if delta}
    <span data-delta class="text-body-sm font-mono {deltaClass}">{deltaText}</span>
  {/if}
</div>
