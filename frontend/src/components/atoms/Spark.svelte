<script lang="ts">
  export let data: number[];
  export let width: number = 80;
  export let height: number = 24;
  export let trend: 'up' | 'down' | 'flat' = 'flat';
  export let fill: boolean = false;

  const strokeMap = {
    up:   'hsl(var(--accent))',
    down: 'hsl(var(--destructive))',
    flat: 'hsl(var(--text-dim))',
  } as const;

  $: stroke = strokeMap[trend];

  $: pathD = (() => {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = data.length > 1 ? width / (data.length - 1) : 0;
    return data
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  })();

  $: fillD = fill && pathD ? `${pathD} L${width},${height} L0,${height} Z` : '';
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" preserveAspectRatio="none" aria-hidden="true">
  {#if fillD}
    <path d={fillD} fill={stroke} fill-opacity="0.15" />
  {/if}
  <path d={pathD} fill="none" {stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
