<script lang="ts">
  import { cn } from '$lib/utils/cn';

  let className: string = '';
  export { className as class };
</script>

<div class={cn('animate-pulse rounded-md bg-muted', className)} {...$$restProps} />
