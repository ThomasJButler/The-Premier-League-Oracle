<script lang="ts">
  import { getContext } from 'svelte';
  import { cn } from '$lib/utils';
  import { focusTrap } from '$lib/utils';
  import { fly } from 'svelte/transition';

  export let side: 'left' | 'right' | 'top' | 'bottom' = 'right';
  let className = '';
  export { className as class };

  const { close } = getContext<{ close: () => void }>('sheet');

  // Svelte 4 types on:keydown as CustomEvent, not KeyboardEvent — any is required here
   
  function handleKeydown(e: any) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  const flyParams = {
    left: { x: -300, duration: 200 },
    right: { x: 300, duration: 200 },
    top: { y: -300, duration: 200 },
    bottom: { y: 300, duration: 200 },
  };

  const positionClasses = {
    left: 'inset-y-0 left-0 h-full border-r',
    right: 'inset-y-0 right-0 h-full border-l',
    top: 'inset-x-0 top-0 w-full border-b',
    bottom: 'inset-x-0 bottom-0 w-full border-t',
  };
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class={cn(
    'fixed z-50 bg-card shadow-lg',
    positionClasses[side],
    className
  )}
  role="dialog"
  aria-modal="true"
  use:focusTrap
  on:keydown={handleKeydown}
  transition:fly={flyParams[side]}
>
  <slot />
</div>
