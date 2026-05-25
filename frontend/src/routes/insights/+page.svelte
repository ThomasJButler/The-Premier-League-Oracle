<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import TopScorerRow from '$lib/components/insights/TopScorerRow.svelte';
  import StatTile from '$lib/components/insights/StatTile.svelte';
  import SeasonAnomalyRow from '$lib/components/insights/SeasonAnomalyRow.svelte';
  import { dataService } from '../../services/dataService';
  import { statsPack } from '$lib/data/statsPack';
  import type { FDScorer } from '../../services/api/footballData';

  let scorers = $state<FDScorer[]>([]);
  let scorersLoading = $state(true);
  let scorersError = $state(false);

  const era = statsPack.leagueEra;
  const anomalies = statsPack.anomalies ?? [];

  const STAT_TILES: { label: string; value: string; sub?: string }[] = [
    {
      label: 'GOALS PER MATCH',
      value: era.avgTotalGoalsOverall.toFixed(2),
      sub: '33-season mean'
    },
    {
      label: 'HOME GOALS',
      value: era.avgHomeGoalsOverall.toFixed(2),
      sub: 'per match · overall'
    },
    {
      label: 'AWAY GOALS',
      value: era.avgAwayGoalsOverall.toFixed(2),
      sub: 'per match · overall'
    },
    {
      label: 'OVER 2.5',
      value: `${Math.round(era.avgOver25Overall * 100)}%`,
      sub: 'of matches'
    },
    {
      label: 'BTTS',
      value: `${Math.round(era.avgBTTSOverall * 100)}%`,
      sub: 'both teams to score'
    },
    {
      label: 'SEASONS ON FILE',
      value: String(statsPack.totalSeasons),
      sub: `${statsPack.totalMatches.toLocaleString('en-GB')} matches`
    }
  ];

  onMount(async () => {
    try {
      const list = await dataService.getTopScorers(10);
      scorers = list;
    } catch {
      scorersError = true;
    } finally {
      scorersLoading = false;
    }
  });
</script>

{#snippet body()}
  <section class="mb-10" data-insights-section="scorers">
    <Rule kicker="GOLDEN BOOT" title="Top scorers" action="LIVE FEED" />
    {#if scorersLoading}
      <p class="font-serif italic text-ink-dim text-[14px] py-6" data-scorers-loading>
        Counting the goals…
      </p>
    {:else if scorersError || scorers.length === 0}
      <p class="font-serif italic text-ink-dim text-[14px] py-6" data-scorers-empty>
        No scorer feed available — add a Football-Data API key in Settings to populate this list.
      </p>
    {:else}
      <div data-scorers-list>
        {#each scorers as s, i (s.player.id ?? `${s.player.name}-${i}`)}
          <TopScorerRow
            rank={i + 1}
            player={s.player.name}
            team={s.team.name}
            goals={s.goals}
            assists={s.assists}
          />
        {/each}
      </div>
    {/if}
  </section>

  <section class="mb-10" data-insights-section="stats">
    <Rule kicker="THE NUMBERS" title="33-season league baseline" />
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-stats-grid>
      {#each STAT_TILES as tile (tile.label)}
        <StatTile label={tile.label} value={tile.value} sub={tile.sub} />
      {/each}
    </div>
  </section>

  <section class="mb-10" data-insights-section="story">
    <Rule kicker="SEASON STORY" title="Where the seasons broke the mould" />
    {#if anomalies.length === 0}
      <p class="font-serif italic text-ink-dim text-[14px] py-6" data-anomalies-empty>
        No outlier seasons on file.
      </p>
    {:else}
      <div data-anomalies-list>
        {#each anomalies as a (a.season)}
          <SeasonAnomalyRow season={a.season} reasons={a.reasons} />
        {/each}
      </div>
    {/if}
  </section>

  <a
    href="/insights/archive"
    class="inline-block font-mono text-[10px] tracking-[0.2em] uppercase text-red font-bold border-b border-red pb-0.5 hover:text-ink"
    data-insights-archive-link
  >
    Open archive · 33 seasons of detail →
  </a>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="insights" kicker="INSIGHTS" title="Insights">
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-insights-page>
  <MobileHeader title="Insights" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
