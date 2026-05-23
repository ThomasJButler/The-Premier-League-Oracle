<script lang="ts">
  interface Props {
    label: string;
    value: string;
    sub?: string;
  }

  const { label, value, sub }: Props = $props();
</script>

<div class="border border-rule p-4 flex flex-col gap-1" data-stat-tile>
  <p class="font-sans text-[10px] tracking-[0.25em] uppercase text-ink-dim" data-stat-label>
    {label}
  </p>
  <p class="font-serif text-[32px] leading-none text-ink tabular-nums" data-stat-value>
    {value}
  </p>
  {#if sub}
    <p class="font-mono text-[11px] text-ink-soft" data-stat-sub>{sub}</p>
  {/if}
</div>
