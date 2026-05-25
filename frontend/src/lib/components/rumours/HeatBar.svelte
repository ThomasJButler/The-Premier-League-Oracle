<script lang="ts">
  interface Props {
    heat: number;
    max?: number;
  }

  const { heat, max = 5 }: Props = $props();

  const cells = $derived(Array.from({ length: max }, (_, i) => i < Math.max(0, Math.min(heat, max))));
</script>

<div class="flex gap-1" data-heat-bar data-heat-value={heat}>
  {#each cells as filled, i (i)}
    <span
      class="kicker-heat-cell inline-block w-4 h-4"
      class:is-filled={filled}
      data-heat-cell={filled ? 'filled' : 'empty'}
    ></span>
  {/each}
</div>

<style>
  .kicker-heat-cell {
    background: var(--paper-inset);
    border: 1px solid var(--rule-strong);
  }
  .kicker-heat-cell.is-filled {
    background: var(--red);
  }
</style>
