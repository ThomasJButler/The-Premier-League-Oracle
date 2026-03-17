<script lang="ts">
  import { cn } from '$lib/utils/cn';

  let className: string = '';
  export { className as class };
</script>

<div class={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...$$restProps}>
  <slot />
</div>
