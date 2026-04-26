<script lang="ts">
  export let result: 'W' | 'D' | 'L';
  export let size: 'sm' | 'md' = 'sm';

  const labelMap = { W: 'Win', D: 'Draw', L: 'Loss' } as const;
  const colorMap = { W: 'bg-accent', D: 'bg-text-faint', L: 'bg-destructive' } as const;
  const px = { sm: 6, md: 8 } as const;

  $: classes = `inline-block rounded-full ${colorMap[result]}`;
</script>

<span
  class={classes}
  style:width="{px[size]}px"
  style:height="{px[size]}px"
  aria-label={labelMap[result]}
/>
