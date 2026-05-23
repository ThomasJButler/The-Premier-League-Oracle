<script lang="ts">
  interface Props {
    season: string;
    reasons: string[];
  }

  const { season, reasons }: Props = $props();
</script>

<div
  class="grid items-baseline gap-4 border-b border-rule py-3"
  style="grid-template-columns: 96px minmax(0, 1fr);"
  data-anomaly-row
  data-anomaly-season={season}
>
  <span class="font-mono text-[12px] tracking-[0.15em] text-red font-bold" data-anomaly-season-label>
    {season}
  </span>
  <ul class="font-serif text-[14px] text-ink space-y-1" data-anomaly-reasons>
    {#each reasons as reason (reason)}
      <li data-anomaly-reason>{reason}</li>
    {/each}
  </ul>
</div>
