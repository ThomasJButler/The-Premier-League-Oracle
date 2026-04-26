<script lang="ts">
  import { iconRegistry, type IconName } from './icons';

  export let name: IconName;
  export let size: number = 16;
  export let strokeWidth: number = 2;

  let className = '';
  export { className as class };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class={className}
>
  <path d={iconRegistry[name]} stroke-width={strokeWidth} />
</svg>
