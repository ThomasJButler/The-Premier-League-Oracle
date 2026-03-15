<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import type { ButtonVariant, ButtonSize } from './index';
  import { createEventDispatcher } from 'svelte';

  let className: string = '';
  export { className as class };
  export let variant: ButtonVariant = 'default';
  export let size: ButtonSize = 'default';
  export let href: string | undefined = undefined;
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher();

  const variantClasses: Record<ButtonVariant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };

  $: buttonClass = cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  function handleClick(e: Event) {
    dispatch('click', e);
  }
</script>

{#if href}
  <a {href} class={buttonClass} {...$$restProps}>
    <slot />
  </a>
{:else}
  <button class={buttonClass} {disabled} on:click={handleClick} {...$$restProps}>
    <slot />
  </button>
{/if}
