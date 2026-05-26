<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import KpiTile from '$lib/components/today/KpiTile.svelte';
  import KpiSnapDots from '$lib/components/predictions/KpiSnapDots.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import PredictionPickRow from '$lib/components/predictions/PredictionPickRow.svelte';
  import SettledResultRow from '$lib/components/predictions/SettledResultRow.svelte';
  import { buildKickerContext } from '$lib/context/buildKickerContext';
  import { defaultPorts } from '$lib/context/defaultPorts';
  import { personaStore } from '$lib/stores/persona';
  import type { PersonaId } from '$lib/personas';
  import { getEmptyStateCopy } from '$lib/copy/emptyStates';
  import type { FixtureContext } from '$lib/context/types';
  import { predictionTracker, type StoredPrediction } from '../../services/predictionTracker';
  import { calibrationIndex } from '$lib/calibrationIndex';
  import { dataService } from '../../services/dataService';
  import { findCurrentGameweek } from '$lib/gameweek';
  import type { Match } from '../../types';
  import { getTeamColor } from '../../utils/teamLogos';
  import { displayTeam } from '$lib/utils/displayTeam';

  let modelAccuracy = $state('—');
  let modelAccuracySub = $state<string | undefined>(undefined);
  let brier = $state('—');
  let calibration = $state('—');
  let modelEdge = $state('—');

  let fixtures = $state<FixtureContext[]>([]);
  let settled = $state<StoredPrediction[]>([]);
  let matches = $state<Match[]>([]);
  let activeKpi = $state(0);

  const KPI_COUNT = 4;

  const currentGw = $derived(findCurrentGameweek(matches));
  const gwKicker = $derived(currentGw !== null ? `GW ${currentGw}` : 'AWAITING SCHEDULE');

  const PICK_LETTER = { H: 'HOME', D: 'DRAW', A: 'AWAY' } as const;

  function bestPick(p: { home: number; draw: number; away: number }): {
    letter: 'H' | 'D' | 'A';
    conf: number;
  } {
    if (p.home >= p.draw && p.home >= p.away) return { letter: 'H', conf: p.home };
    if (p.away >= p.draw) return { letter: 'A', conf: p.away };
    return { letter: 'D', conf: p.draw };
  }

  function rowProps(f: FixtureContext) {
    const { letter, conf } = bestPick(f.ourProb);
    return {
      home: displayTeam(f.home),
      away: displayTeam(f.away),
      homeColor: getTeamColor(f.home),
      awayColor: getTeamColor(f.away),
      probH: f.ourProb.home,
      probD: f.ourProb.draw,
      probA: f.ourProb.away,
      marketImpliedH: f.marketImplied?.home,
      marketImpliedD: f.marketImplied?.draw,
      marketImpliedA: f.marketImplied?.away,
      pick: PICK_LETTER[letter],
      conf: Math.round(conf * 100),
      valueEdge: f.valueEdge,
      status: 'pending' as const
    };
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Europe/London'
    })
      .format(d)
      .toUpperCase();
  }

  function settledProps(p: StoredPrediction) {
    const predictedScore = `${p.predictedHomeGoals}-${p.predictedAwayGoals}`;
    const actualScore =
      p.actualHomeGoals !== undefined && p.actualAwayGoals !== undefined
        ? `${p.actualHomeGoals}-${p.actualAwayGoals}`
        : '—';
    const hit = p.isCorrect === true;
    const exact =
      p.actualHomeGoals === p.predictedHomeGoals &&
      p.actualAwayGoals === p.predictedAwayGoals;
    return {
      fixture: `${displayTeam(p.homeTeam)} v ${displayTeam(p.awayTeam)}`,
      predicted: predictedScore,
      actual: actualScore,
      hit,
      exact,
      date: formatDate(p.matchDate)
    };
  }

  onMount(async () => {
    const stats = predictionTracker.getAccuracyStats();
    const factors = predictionTracker.getCalibrationFactors();

    modelAccuracy =
      stats.totalPredictions > 0 ? Math.round(stats.accuracy) + '%' : '—';
    modelAccuracySub =
      stats.totalPredictions > 0 ? stats.totalPredictions + ' predictions' : undefined;

    brier = stats.totalPredictions > 0 ? stats.brierScore.toFixed(3) : '—';

    calibration =
      stats.totalPredictions > 0 ? calibrationIndex(factors).toFixed(2) : '—';

    const edgePp = Math.round((stats.highConfidenceAccuracy - 50));
    modelEdge =
      stats.totalPredictions > 0
        ? (edgePp >= 0 ? '+' : '') + edgePp + 'pp'
        : '—';

    try {
      const ctx = await buildKickerContext(defaultPorts(), { daysAhead: 7 });
      fixtures = ctx.fixtures;
    } catch {}

    try {
      matches = await dataService.getMatches({ upcoming: true, days: 14 });
    } catch {}

    try {
      settled = predictionTracker
        .getRecentPredictions(50)
        .filter((p) => p.actualResult !== undefined)
        .slice(0, 10);
    } catch {}
  });

  $effect(() => {
    if (typeof document === 'undefined') return;
    const strips = Array.from(
      document.querySelectorAll<HTMLElement>('[data-kpi-strip]')
    );
    const handlers: Array<() => void> = [];
    for (const strip of strips) {
      const onScroll = () => {
        const tileWidth = strip.clientWidth;
        if (tileWidth <= 0) return;
        const idx = Math.round(strip.scrollLeft / tileWidth);
        activeKpi = Math.max(0, Math.min(KPI_COUNT - 1, idx));
      };
      strip.addEventListener('scroll', onScroll, { passive: true });
      handlers.push(() => strip.removeEventListener('scroll', onScroll));
    }
    return () => handlers.forEach((cleanup) => cleanup());
  });
</script>

{#snippet body()}
  <div
    class="kicker-predictions-kpi flex overflow-x-auto snap-x snap-mandatory gap-px pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 mb-8"
    data-kpi-strip
  >
    <div class="flex-none w-[55vw] snap-center lg:w-auto">
      <KpiTile label="MODEL ACCURACY" value={modelAccuracy} sub={modelAccuracySub} />
    </div>
    <div class="flex-none w-[55vw] snap-center lg:w-auto">
      <KpiTile label="BRIER SCORE" value={brier} sub="lower is better" />
    </div>
    <div class="flex-none w-[55vw] snap-center lg:w-auto">
      <KpiTile label="CALIBRATION INDEX" value={calibration} sub="0–1 scalar" />
    </div>
    <div class="flex-none w-[55vw] snap-center lg:w-auto">
      <KpiTile label="MODEL EDGE" value={modelEdge} sub="high-conf vs random" accent />
    </div>
  </div>

  <div class="lg:hidden mb-6" data-kpi-dots-wrapper>
    <KpiSnapDots count={KPI_COUNT} activeIndex={activeKpi} />
  </div>

  <Rule kicker={gwKicker} title="THIS WEEK'S PICKS" action="UPDATED LIVE" />

  {#if fixtures.length === 0}
    <p class="font-serif italic text-ink-dim mb-8" data-picks-empty>
      {getEmptyStateCopy('predictions', $personaStore as PersonaId)}
    </p>
  {:else}
    <div class="flex flex-col gap-2 mb-10" data-picks-grid>
      {#each fixtures as f (f.id)}
        <PredictionPickRow {...rowProps(f)} />
      {/each}
    </div>
  {/if}

  <Rule kicker="LOG" title="SETTLED RESULTS" action="LAST 10" />

  {#if settled.length === 0}
    <p class="font-serif italic text-ink-dim" data-settled-empty>
      No settled predictions yet.
    </p>
  {:else}
    <div class="border border-rule" data-settled-log>
      {#each settled as s, i (s.id)}
        <SettledResultRow {...settledProps(s)} isLast={i === settled.length - 1} />
      {/each}
    </div>
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="predictions" kicker="THE MOAT" title="PREDICTIONS">
    {@render body()}
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-predictions-page>
  <MobileHeader title="Predictions" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="predictions" />
  </div>
</div>
