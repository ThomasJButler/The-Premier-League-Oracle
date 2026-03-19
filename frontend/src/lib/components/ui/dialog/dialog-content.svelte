<script lang="ts">
  import { getContext } from 'svelte';
  import { cn } from '$lib/utils';
  import { focusTrap } from '$lib/utils';
  import { scale } from 'svelte/transition';

  let className = '';
  export { className as class };

  const { close } = getContext<{ close: () => void }>('dialog');

  // Svelte 4 types on:keydown as CustomEvent, not KeyboardEvent — any is required here
   
  function handleKeydown(e: any) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class={cn(
    'relative w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground shadow-lg',
    className
  )}
  role="dialog"
  aria-modal="true"
  use:focusTrap
  on:keydown={handleKeydown}
  transition:scale={{ start: 0.95, duration: 150 }}
>
  <slot />
</div>
