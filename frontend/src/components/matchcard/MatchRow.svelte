<script lang="ts">
  import type { Fixture, MatchPrediction } from '../../types/redesign';
  import Crest from '../atoms/Crest.svelte';
  import ProbBar from '../atoms/ProbBar.svelte';

  export let fixture: Fixture;
  export let prediction: MatchPrediction | undefined = undefined;

  $: kickoff = new Date(fixture.utcDate);
  $: dateStr = kickoff.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  $: timeStr = kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  $: isFinished = fixture.status === 'FINISHED' && fixture.score !== undefined;
  $: scoreOrV = isFinished && fixture.score
    ? `${fixture.score.home}-${fixture.score.away}`
    : 'v';

  $: actualOutcome = isFinished && fixture.score
    ? fixture.score.home > fixture.score.away ? 'HOME'
      : fixture.score.home < fixture.score.away ? 'AWAY'
        : 'DRAW'
    : null;

  $: isHit = prediction && actualOutcome ? prediction.pick === actualOutcome : null;
  $: pickLabel = prediction
    ? prediction.pick === 'HOME' ? fixture.home.abbr
      : prediction.pick === 'AWAY' ? fixture.away.abbr
        : 'DRAW'
    : '';
</script>

<div class="grid grid-cols-12 gap-2 items-center py-2 px-3 hover:bg-surface-hover border-b border-border">
  <span class="col-span-2 text-body-sm font-mono text-text-dim">{dateStr} {timeStr}</span>

  <span class="col-span-2 flex items-center gap-2">
    <Crest team={fixture.home} size="xs" />
    <span class="text-label">{fixture.home.abbr}</span>
  </span>

  <span class="col-span-1 text-center font-mono text-label">{scoreOrV}</span>

  <span class="col-span-2 flex items-center gap-2 justify-end">
    <span class="text-label">{fixture.away.abbr}</span>
    <Crest team={fixture.away} size="xs" />
  </span>

  <span class="col-span-3">
    {#if prediction}
      <ProbBar home={prediction.ensemble.home} draw={prediction.ensemble.draw} away={prediction.ensemble.away} />
    {/if}
  </span>

  <span class="col-span-2 text-right text-body-sm font-mono">
    {#if isFinished && isHit !== null}
      <span data-hit={String(isHit)} class={isHit ? 'text-accent' : 'text-destructive'}>
        {isHit ? '✓' : '✗'} {pickLabel}
      </span>
    {:else if prediction}
      <span class="text-text-dim">{pickLabel} · {Math.round(prediction.pickConfidence * 100)}%</span>
    {/if}
  </span>
</div>
