<script lang="ts">
  interface Props {
    count: number;
    activeIndex?: number;
  }

  const { count, activeIndex = 0 }: Props = $props();
</script>

<div
  class="flex justify-center gap-1.5 py-2"
  data-kpi-dots
  aria-hidden="true"
>
  {#each Array.from({ length: count }) as _, i}
    <span
      class="inline-block w-1.5 h-1.5 rounded-full {i === activeIndex
        ? 'bg-ink'
        : 'bg-ink-ghost'}"
      data-kpi-dot
      data-kpi-dot-active={i === activeIndex ? 'true' : 'false'}
    ></span>
  {/each}
</div>
