<script lang="ts">
  import type { Fixture, MatchPrediction, Density, SectionId } from '../../types/redesign';
  import Crest from '../atoms/Crest.svelte';
  import FormDot from '../atoms/FormDot.svelte';
  import ProbBar from '../atoms/ProbBar.svelte';
  import MatchCardSection from './MatchCardSection.svelte';

  export let fixture: Fixture;
  export let prediction: MatchPrediction | undefined = undefined;
  export let variant: 'standard' | 'emphasised' = 'standard';
  export let density: Density = 'comfortable';
  export let defaultOpen: SectionId | SectionId[] | undefined = undefined;
  export let hideSections: SectionId[] = [];

  const initialOpen: Record<SectionId, boolean> = {
    analyse: false, probabilities: false, form: false, context: false,
  };
  const seedOpen = Array.isArray(defaultOpen) ? defaultOpen : defaultOpen ? [defaultOpen] : [];
  for (const id of seedOpen) initialOpen[id] = true;

  let openState: Record<SectionId, boolean> = initialOpen;

  function toggleSection(id: string, next: boolean) {
    openState = { ...openState, [id as SectionId]: next };
  }

  function isShown(id: SectionId): boolean {
    return !hideSections.includes(id);
  }

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
          <span class="{prediction.pick === 'HOME' ? (variant === 'emphasised' ? 'text-metric-xl' : 'text-metric-lg') : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.home)}</span>
          <span class="{prediction.pick === 'DRAW' ? (variant === 'emphasised' ? 'text-metric-xl' : 'text-metric-lg') : 'text-metric-sm'} text-text-dim">{pct(prediction.ensemble.draw)}</span>
          <span class="{prediction.pick === 'AWAY' ? (variant === 'emphasised' ? 'text-metric-xl' : 'text-metric-lg') : 'text-metric-sm'} text-foreground">{pct(prediction.ensemble.away)}</span>
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

  {#if isShown('analyse') && prediction}
    <MatchCardSection id="analyse" label="AI ANALYSIS" open={openState.analyse} onToggle={toggleSection}>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#if prediction.analyseText}
          <div>
            <span class="text-kicker block mb-1">MATCH ANALYSIS</span>
            <p class="text-body">{prediction.analyseText}</p>
          </div>
        {/if}
        {#if prediction.keyFactors?.length}
          <div>
            <span class="text-kicker block mb-1">KEY FACTORS</span>
            <ul class="text-body space-y-1">
              {#each prediction.keyFactors as factor}
                <li class="flex gap-2"><span class="text-accent">+</span><span>{factor}</span></li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if prediction.risks?.length}
          <div>
            <span class="text-kicker block mb-1">RISKS</span>
            <ul class="text-body space-y-1">
              {#each prediction.risks as risk}
                <li class="flex gap-2"><span class="text-warning">!</span><span>{risk}</span></li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </MatchCardSection>
  {/if}

  {#if isShown('probabilities') && prediction}
    <MatchCardSection id="probabilities" label="PROBABILITIES & MODELS" open={openState.probabilities} onToggle={toggleSection}>
      <div class="grid grid-cols-5 gap-3 mb-4">
        {#each prediction.models as model}
          <div class="text-center">
            <span class="text-eyebrow block">{model.name}</span>
            <span class="text-metric font-mono">{model.lean}</span>
            <div class="mt-1 h-1 rounded-full bg-bg-inset overflow-hidden">
              <span class="block h-full bg-primary" style:width="{Math.round(model.confidence * 100)}%"></span>
            </div>
          </div>
        {/each}
      </div>
      <div class="space-y-1 mb-4">
        <span class="text-kicker block">TOP-3 SCORELINES</span>
        {#each prediction.topScorelines as s}
          <div class="flex items-center justify-between text-body font-mono">
            <span>{s.home} - {s.away}</span>
            <span class="text-text-dim">{Math.round(s.prob * 100)}%</span>
          </div>
        {/each}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-md border border-border p-3 text-center">
          <span class="text-eyebrow block">xG</span>
          <span class="font-mono text-metric">{prediction.xg.home.toFixed(2)} - {prediction.xg.away.toFixed(2)}</span>
        </div>
        <div class="rounded-md border border-border p-3 text-center">
          <span class="text-eyebrow block">ELO</span>
          <span class="font-mono text-metric">{prediction.elo.home} vs {prediction.elo.away}</span>
        </div>
      </div>
    </MatchCardSection>
  {/if}

  {#if isShown('form')}
    <MatchCardSection id="form" label="FORM & H2H" open={openState.form} onToggle={toggleSection}>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <span class="text-kicker block mb-1">{fixture.home.abbr} FORM L5</span>
          <span class="flex gap-1">
            {#each fixture.home.formLast5 ?? [] as r}<FormDot result={r} size="md" />{/each}
          </span>
        </div>
        <div>
          <span class="text-kicker block mb-1">{fixture.away.abbr} FORM L5</span>
          <span class="flex gap-1">
            {#each fixture.away.formLast5 ?? [] as r}<FormDot result={r} size="md" />{/each}
          </span>
        </div>
      </div>
    </MatchCardSection>
  {/if}

  {#if isShown('context')}
    <MatchCardSection id="context" label="VENUE · REFEREE · TEMPO" open={openState.context} onToggle={toggleSection}>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="text-center"><span class="text-eyebrow block">HOME RECORD</span><span class="font-mono text-metric-sm">—</span></div>
        <div class="text-center"><span class="text-eyebrow block">AWAY RECORD</span><span class="font-mono text-metric-sm">—</span></div>
        <div class="text-center"><span class="text-eyebrow block">REFEREE</span><span class="text-body-sm">—</span></div>
        <div class="text-center"><span class="text-eyebrow block">TEMPO</span><span class="text-body-sm">—</span></div>
      </div>
    </MatchCardSection>
  {/if}
</article>
