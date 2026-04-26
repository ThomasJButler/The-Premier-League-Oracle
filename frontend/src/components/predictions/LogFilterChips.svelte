<script lang="ts" context="module">
  import type { LogFilterId } from '../../lib/predictionFilters';
  export type { LogFilterId };
</script>

<script lang="ts">
  export let active: LogFilterId;
  export let onChange: (next: LogFilterId) => void;

  const CHIPS: Array<{ id: LogFilterId; label: string }> = [
    { id: 'last30', label: 'Last 30' },
    { id: 'season', label: 'This season' },
    { id: 'all',    label: 'All' },
  ];

  function handleClick(id: LogFilterId): void {
    if (id === active) return;
    onChange(id);
  }
</script>

<div class="flex gap-2 px-4" role="group" aria-label="Filter prediction log">
  {#each CHIPS as chip (chip.id)}
    <button
      type="button"
      class="px-3 py-1.5 rounded-full text-body-sm border transition-colors"
      class:bg-primary={chip.id === active}
      class:text-primary-foreground={chip.id === active}
      class:border-primary={chip.id === active}
      class:border-border={chip.id !== active}
      class:hover:bg-surface-hover={chip.id !== active}
      data-chip={chip.id}
      aria-pressed={chip.id === active}
      on:click={() => handleClick(chip.id)}
    >
      {chip.label}
    </button>
  {/each}
</div>
