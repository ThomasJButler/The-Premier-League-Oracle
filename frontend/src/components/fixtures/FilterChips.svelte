<script lang="ts" context="module">
  export type FilterId = 'all' | 'top6' | 'relegation' | 'tv';
</script>

<script lang="ts">
  export let active: FilterId;
  export let onChange: (next: FilterId) => void;

  const CHIPS: Array<{ id: FilterId; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'top6', label: 'Top 6' },
    { id: 'relegation', label: 'Relegation' },
    { id: 'tv', label: 'TV picks' },
  ];

  function handleClick(id: FilterId): void {
    if (id === active) return;
    onChange(id);
  }
</script>

<div class="flex gap-2 px-4" role="group" aria-label="Filter fixtures">
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
