<script lang="ts">
  import type { Fixture, MatchPrediction, Density } from '../../types/redesign';
  import Crest from '../atoms/Crest.svelte';
  import FormDot from '../atoms/FormDot.svelte';
  import ProbBar from '../atoms/ProbBar.svelte';

  export let fixture: Fixture;
  export let prediction: MatchPrediction | undefined = undefined;
  export let variant: 'standard' | 'emphasised' = 'standard';
  export let density: Density = 'comfortable';

  $: pad = density === 'compact' ? 'p-3' : 'p-4';
  $: homeColor = fixture.home.primaryColor ?? '#666';
  $: awayColor = fixture.away.primaryColor ?? '#666';

  $: kickoff = new Date(fixture.utcDate);
  $: dateStr = kickoff
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
    .toUpperCase();
  $: timeStr = kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  $: pickStr = prediction
    ? prediction.pick === 'HOME'
      ? fixture.home.abbr
      : prediction.pick === 'AWAY'
        ? fixture.away.abbr
        : 'DRAW'
    : '';
  $: pickPctStr = prediction ? `${Math.round(prediction.pickConfidence * 100)}%` : '';

  $: pct = (n: number) => `${Math.round(n * 100)}%`;
  $: isFinished = fixture.status === 'FINISHED' || kickoff < new Date();
</script>

<article
  class="rounded-lg border border-border bg-card overflow-hidden {pad} {variant === 'emphasised' ? 'shadow-emphasised' : ''}"
  style:--home-color={homeColor}
  style:--away-color={awayColor}
  style:background-image="linear-gradient(90deg, color-mix(in srgb, {homeColor} 12%, transparent) 0%, transparent 35%, transparent 65%, color-mix(in srgb, {awayColor} 12%, transparent) 100%)"
>
  <!-- Top meta row -->
  <div class="flex items-center justify-between text-body-sm font-mono text-text-dim mb-3" data-meta>
    <span class="uppercase">
      {dateStr} · {timeStr}{fixture.venue ? ` · ${fixture.venue}` : ''}{fixture.tv?.length ? ` · ${fixture.tv.join(', ')}` : ''}
    </span>
    {#if prediction}
      <span data-pick>
        <span class="text-primary font-bold">PICK</span>
        <span class="text-foreground"> {pickStr} · {pickPctStr}</span>
      </span>
    {/if}
  </div>

  <!-- Body grid: home / center / away -->
  <div class="grid grid-cols-12 gap-3 items-center">
    <!-- Home block -->
    <div class="col-span-4 flex items-center gap-3" data-block="home">
      <Crest team={fixture.home} size="md" />
      <div class="flex flex-col gap-1">
        <span class="text-label">{fixture.home.name}</span>
        {#if fixture.home.formLast5?.length}
          <span class="flex gap-1">
            {#each fixture.home.formLast5 as r}<FormDot result={r} />{/each}
          </span>
        {/if}
      </div>
    </div>

    <!-- Center block -->
    <div class="col-span-4 flex flex-col items-center gap-2" data-block="center">
      {#if prediction}
        <span class="text-eyebrow">HOME · DRAW · AWAY</span>
        <span class="flex items-baseline justify-center gap-3 font-mono">
          <span class="{prediction.pick === 'HOME' ? 'text-metric-lg' : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.home)}</span>
          <span class="{prediction.pick === 'DRAW' ? 'text-metric-lg' : 'text-metric-sm'} text-text-dim">{pct(prediction.ensemble.draw)}</span>
          <span class="{prediction.pick === 'AWAY' ? 'text-metric-lg' : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.away)}</span>
        </span>
        <ProbBar
          home={prediction.ensemble.home}
          draw={prediction.ensemble.draw}
          away={prediction.ensemble.away}
        />
      {:else}
        <span class="text-eyebrow">{isFinished ? 'FT' : 'KICKOFF'}</span>
        <span class="font-mono text-metric-lg">{timeStr}</span>
      {/if}
    </div>

    <!-- Away block -->
    <div class="col-span-4 flex items-center justify-end gap-3" data-block="away">
      <div class="flex flex-col gap-1 items-end">
        <span class="text-label">{fixture.away.name}</span>
        {#if fixture.away.formLast5?.length}
          <span class="flex gap-1">
            {#each fixture.away.formLast5 as r}<FormDot result={r} />{/each}
          </span>
        {/if}
      </div>
      <Crest team={fixture.away} size="md" />
    </div>
  </div>
</article>
