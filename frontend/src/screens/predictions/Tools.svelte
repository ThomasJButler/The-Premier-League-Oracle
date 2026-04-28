<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import KellyCalculator from '../../components/predictions/KellyCalculator.svelte';

  type UtilityId = 'kelly' | 'value';

  const UTILITIES: Array<{ id: UtilityId; label: string }> = [
    { id: 'kelly', label: 'Kelly Calculator' },
    { id: 'value', label: 'Value Scanner' },
  ];

  function readUtility(): UtilityId {
    if (typeof window === 'undefined') return 'kelly';
    const raw = new URLSearchParams(window.location.search).get('utility');
    return raw === 'value' ? 'value' : 'kelly';
  }

  let active: UtilityId = readUtility();

  function setUtility(next: UtilityId): void {
    if (next === active) return;
    active = next;
    navigate(`/predictions/tools?utility=${next}`, { replace: false });
  }

  onMount(() => {
    active = readUtility();
  });
</script>

<div class="flex flex-col gap-4 px-4 py-6" data-screen="predictions-tools">
  <div
    role="tablist"
    aria-label="Predictions tools"
    class="inline-flex rounded-md border border-border bg-bg-inset p-1 self-start"
    data-tools-switcher
  >
    {#each UTILITIES as util (util.id)}
      <button
        type="button"
        role="tab"
        class="px-3 py-1 rounded-sm text-label transition-colors {util.id === active
          ? 'bg-card text-foreground'
          : 'text-text-muted hover:text-foreground'}"
        aria-selected={util.id === active}
        data-utility={util.id}
        on:click={() => setUtility(util.id)}
      >
        {util.label}
      </button>
    {/each}
  </div>

  {#if active === 'kelly'}
    <KellyCalculator />
  {:else}
    <div data-tool-placeholder="value">Value Scanner placeholder (Task 3)</div>
  {/if}
</div>
