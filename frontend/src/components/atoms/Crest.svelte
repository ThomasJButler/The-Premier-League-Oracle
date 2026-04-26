<script lang="ts">
  import type { TeamSummary } from '../../types/redesign';

  export let team: TeamSummary;
  export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  const sizes = { xs: 16, sm: 20, md: 28, lg: 40 } as const;

  $: px = sizes[size];
  $: hasColors = !!team.primaryColor;
  $: gradient = hasColors
    ? `radial-gradient(circle, ${team.primaryColor} 0%, ${team.secondaryColor ?? team.primaryColor} 100%)`
    : '';
  $: classes = hasColors
    ? 'inline-flex items-center justify-center rounded-full text-white font-mono font-bold'
    : 'inline-flex items-center justify-center rounded-full bg-bg-inset text-text-muted font-mono font-bold';
  $: fontSize = Math.round(px * 0.42);
</script>

<span
  class={classes}
  style:width="{px}px"
  style:height="{px}px"
  style:background={gradient}
  style:font-size="{fontSize}px"
  aria-label={team.name}
>
  {team.abbr}
</span>
