<script lang="ts">
  import { cn } from '$lib/utils/cn';

  let className: string = '';
  export { className as class };
</script>

<h3 class={cn('text-lg font-semibold leading-none tracking-tight', className)} {...$$restProps}>
  <slot />
</h3>
