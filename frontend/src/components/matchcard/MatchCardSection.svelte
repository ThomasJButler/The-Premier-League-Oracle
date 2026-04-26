<script lang="ts">
  import Icon from '../atoms/Icon.svelte';

  export let id: string;
  export let label: string;
  export let open: boolean = false;
  export let onToggle: (id: string, next: boolean) => void = () => {};

  function toggle() {
    onToggle(id, !open);
  }
</script>

<section class="border-t border-border" data-section={id}>
  <button
    type="button"
    class="w-full flex items-center justify-between py-3 px-4 hover:bg-surface-hover text-left"
    on:click={toggle}
    aria-expanded={open}
  >
    <span class="text-eyebrow">{label}</span>
    <span class="motion-safe:transition-transform motion-safe:duration-150 {open ? 'rotate-180' : ''}">
      <Icon name="chevron-down" size={16} />
    </span>
  </button>

  {#if open}
    <div class="bg-bg-inset px-4 py-4">
      <slot />
    </div>
  {/if}
</section>
