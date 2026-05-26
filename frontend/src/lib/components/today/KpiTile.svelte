<script lang="ts">
  interface Props {
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
  }

  const { label, value, sub, accent = false }: Props = $props();

  const noData = $derived(value === '—');
</script>

<div
  class="kicker-kpi-tile px-4 py-3 bg-paper-warm border border-rule-strong"
  data-kpi-tile
  data-kpi-accent={accent ? 'true' : 'false'}
  data-kpi-nodata={noData ? 'true' : 'false'}
>
  <div
    class="font-sans text-[9px] tracking-[0.25em] uppercase font-bold text-red mb-1"
    data-kpi-label
  >
    {label}
  </div>
  {#if noData}
    <div
      class="font-serif text-[14px] italic text-ink-dim leading-snug"
      data-kpi-nodata-line
    >
      no data yet
    </div>
  {:else}
    <div
      class="font-mono font-extrabold text-[28px] leading-none tracking-[-0.03em] {accent
        ? 'text-red'
        : 'text-ink'}"
      data-kpi-value
    >
      {value}
    </div>
    {#if sub}
      <div
        class="font-serif text-[10px] italic text-ink-dim mt-1"
        data-kpi-sub
      >
        {sub}
      </div>
    {/if}
  {/if}
</div>
