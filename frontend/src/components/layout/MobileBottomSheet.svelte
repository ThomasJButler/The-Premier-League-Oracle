<script lang="ts">
  import Icon from '../atoms/Icon.svelte';

  export let open: boolean = false;
  export let onClose: () => void = () => {};

  // Svelte 4 types on:click / on:keydown as CustomEvent, not native DOM events — any is required here
  function handleScrimClick(e: any) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: any) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#if open}
  <div
    class="lg:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
    on:click={handleScrimClick}
    on:keydown={handleKeydown}
    role="presentation"
  >
    <div
      class="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="More options"
    >
      <header class="flex items-center justify-between mb-4">
        <span class="text-title">More</span>
        <button type="button" on:click={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </header>
      <slot />
    </div>
  </div>
{/if}
