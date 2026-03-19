<script lang="ts">
  import { createEventDispatcher, setContext, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  let previousActiveElement: HTMLElement | null = null;

  function close() {
    dispatch('close');
  }

  setContext('dialog', { close });

  $: if (typeof document !== 'undefined') {
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement) {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4"
    transition:fade={{ duration: 150 }}
    on:click|self={close}
    role="presentation"
  >
    <slot />
  </div>
{/if}
