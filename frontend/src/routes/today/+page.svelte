<script lang="ts">
  import { onMount } from 'svelte';
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import KpiTile from '$lib/components/today/KpiTile.svelte';
  import MatchSheetCard from '$lib/components/match/MatchSheetCard.svelte';
  import PunditQuoteBlock from '$lib/components/match/PunditQuoteBlock.svelte';
  import CheersGeoffCallout from '$lib/components/match/CheersGeoffCallout.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { parseGeoffResponse } from '$lib/utils/parseGeoffResponse';
  import {
    bulkPersistGameweekPredictions,
    isGameweekFullyPredicted,
  } from '$lib/bulkPersistGameweekPredictions';
  import { findCurrentGameweek, fixturesForGameweek } from '$lib/gameweek';
  import { displayTeam } from '$lib/utils/displayTeam';
  import { getTeamColor } from '../../utils/teamLogos';
  import type { Match } from '../../types';

  const persona = $derived(getPersona($personaStore as PersonaId));
  const attribution = $derived(
    persona.short.toUpperCase() +
    ', ' +
    (persona.region.includes('·')
      ? persona.region.split('·')[1].trim().toUpperCase()
      : persona.region.split(',')[0].trim().toUpperCase())
  );

  let matches = $state<Match[]>([]);
  let nextKickoff = $state('—');
  let modelAccuracy = $state('—');
  let modelAccuracySub = $state<string | undefined>(undefined);
  let modelEdge = $state('—');
  let streak = $state('—');
  let cheers = $state<{ stat: string; label: string; gloriouslyUseless: string } | null>(null);
  let predictBusy = $state(false);
  let predictTick = $state(0);

  const heroMatch = $derived(matches[0] ?? null);
  const slateMatches = $derived(matches.slice(1, 4));
  const currentGw = $derived(findCurrentGameweek(matches));
  const gwFixtures = $derived(
    currentGw !== null ? fixturesForGameweek(matches, currentGw) : [],
  );
  const gwFullyPredicted = $derived(
    predictTick >= 0 && gwFixtures.length > 0 && isGameweekFullyPredicted(gwFixtures),
  );
  const predictDisabled = $derived(
    predictBusy || gwFixtures.length === 0 || gwFullyPredicted,
  );

  async function handlePredictGw(): Promise<void> {
    if (predictDisabled) return;
    predictBusy = true;
    try {
      await bulkPersistGameweekPredictions(gwFixtures);
    } finally {
      predictBusy = false;
      predictTick += 1;
    }
  }

  function formatKickoff(date: string): string {
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    })
      .format(d)
      .toUpperCase();
  }

  function matchToCardProps(m: Match) {
    const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'EXTRA_TIME';
    const isFinished = m.status === 'FINISHED' || m.result !== null;
    const hasGoals = m.home_goals !== null && m.away_goals !== null;
    const score =
      hasGoals && (isFinished || isLive)
        ? { home: m.home_goals as number, away: m.away_goals as number }
        : null;
    const scoreLabel = isLive ? (m.minute ? `LIVE · ${m.minute}'` : 'LIVE') : 'FINAL';
    return {
      home: displayTeam(m.home_team),
      homeAbbr: m.home_team.slice(0, 3).toUpperCase(),
      homeColor: getTeamColor(m.home_team),
      away: displayTeam(m.away_team),
      awayAbbr: m.away_team.slice(0, 3).toUpperCase(),
      awayColor: getTeamColor(m.away_team),
      kickoff: formatKickoff(m.date),
      venue: 'PREMIER LEAGUE',
      probH: 0.4,
      probD: 0.3,
      probA: 0.3,
      score,
      scoreLabel
    };
  }

  async function fetchCheers(pid: PersonaId): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `kicker:cheers:${today}:${pid}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        cheers = JSON.parse(cached);
        return;
      }
    } catch {}

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          personaId: pid,
          messages: [
            {
              role: 'user',
              content: 'Give me one gloriously useless football stat. Format: [[CHEERS:stat|label|body]]'
            }
          ]
        })
      });
      if (!resp.ok || !resp.body) return;

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let full = '';
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        for (const line of dec.decode(result.value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') break;
          try {
            const msg = JSON.parse(d);
            if (msg.delta) full += msg.delta;
          } catch {}
        }
      }

      const part = parseGeoffResponse(full).find((p) => p.type === 'cheers');
      if (part?.type === 'cheers') {
        const result = { stat: part.stat, label: part.label, gloriouslyUseless: part.content };
        cheers = result;
        try {
          localStorage.setItem(key, JSON.stringify(result));
        } catch {}
      }
    } catch {}
  }

  onMount(async () => {
    const stats = predictionTracker.getAccuracyStats();

    modelAccuracy =
      stats.totalPredictions > 0 ? Math.round(stats.accuracy) + '%' : '—';
    modelAccuracySub =
      stats.totalPredictions > 0 ? stats.totalPredictions + ' predictions' : undefined;

    // `highConfidenceAccuracy` is already a percentage (0–100), not a 0–1 fraction.
    const edgePp = Math.round(stats.highConfidenceAccuracy - 50);
    modelEdge =
      stats.totalPredictions > 0
        ? (edgePp >= 0 ? '+' : '') + edgePp + 'pp'
        : '—';

    const s = stats.streak.current;
    streak = s !== 0 ? Math.abs(s) + (s > 0 ? 'W' : 'L') : '—';

    try {
      const upcoming = await dataService.getMatches({ upcoming: true, days: 3 });
      matches = upcoming;
      if (upcoming[0]) nextKickoff = formatKickoff(upcoming[0].date);
    } catch {}

    await fetchCheers($personaStore as PersonaId);
  });
</script>

{#snippet body()}
  <div class="mb-3 flex justify-end">
    <button
      type="button"
      class="border border-black px-3 py-1 text-[10px] font-mono uppercase tracking-widest hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-black"
      data-predict-gw
      data-predict-gw-disabled={predictDisabled ? 'true' : 'false'}
      disabled={predictDisabled}
      aria-disabled={predictDisabled}
      onclick={handlePredictGw}
    >
      {#if predictBusy}
        Predicting…
      {:else if gwFullyPredicted}
        GW {currentGw ?? ''} predicted
      {:else if currentGw !== null}
        Predict GW {currentGw}
      {:else}
        AWAITING SCHEDULE
      {/if}
    </button>
  </div>
  <div
    class="kicker-today-kpi grid grid-cols-2 gap-px lg:grid-cols-4 mb-8"
    data-kpi-strip
  >
    <KpiTile label="NEXT KICKOFF" value={nextKickoff} />
    <KpiTile label="MODEL ACCURACY" value={modelAccuracy} sub={modelAccuracySub} />
    <KpiTile label="MODEL EDGE" value={modelEdge} sub="vs market · L10 GW" accent />
    <KpiTile label="STREAK" value={streak} accent />
  </div>

  {#if heroMatch}
    <div data-hero-match><MatchSheetCard {...matchToCardProps(heroMatch)} /></div>
    <PunditQuoteBlock {attribution}>
      If there's one game I'm fancying this week, it's {displayTeam(heroMatch.home_team)} vs {displayTeam(heroMatch.away_team)}.
      {persona.tic}
    </PunditQuoteBlock>
  {/if}

  {#if slateMatches.length > 0}
    <Rule kicker="TODAY" title="REST OF SLATE" />
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4" data-slate-grid>
      {#each slateMatches as match (match.id)}
        <MatchSheetCard {...matchToCardProps(match)} />
      {/each}
    </div>
  {/if}

  {#if cheers}
    <CheersGeoffCallout
      stat={cheers.stat}
      label={cheers.label}
      gloriouslyUseless={cheers.gloriouslyUseless}
    />
  {:else}
    <CheersGeoffCallout
      stat="17"
      label="YEARS"
      gloriouslyUseless="It has been exactly 17 years since a goalkeeper scored in a Premier League match. Nobody asked."
    />
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="today" kicker="TODAY" title="TODAY'S PAPER">
    {@render body()}
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-today-page>
  <MobileHeader title="Today's Paper" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="today" />
  </div>
</div>
