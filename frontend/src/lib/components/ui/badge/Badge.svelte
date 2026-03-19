<script lang="ts">
  import { cn } from '$lib/utils';
  import type { BadgeVariant } from './index';

  let className: string = '';
  export { className as class };
  export let variant: BadgeVariant = 'default';

  const variantClasses: Record<BadgeVariant, string> = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'text-foreground',
    success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    info: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
</script>

<div
  class={cn(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    variantClasses[variant],
    className
  )}
  {...$$restProps}
>
  <slot />
</div>
