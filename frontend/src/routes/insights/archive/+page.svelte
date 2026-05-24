<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import SeasonRow from '$lib/components/insights/SeasonRow.svelte';
  import SeasonDetail from '$lib/components/insights/SeasonDetail.svelte';
  import { LEAGUE_HISTORY, getSeasonRecord, seasonStartYear } from '$lib/fixtures/leagueHistory';
  import { statsPack } from '$lib/data/statsPack';
  import { readVerdict } from '$lib/stores/verdictsStore';
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';
  import { dataService } from '../../../services/dataService';

  const personaId = $derived($personaStore as PersonaId);
  const persona = $derived(getPersona(personaId));

  const SEASONS_DESC = [...LEAGUE_HISTORY].slice().reverse();
  const DEFAULT_SEASON = SEASONS_DESC[0].season;

  let activeSeason = $state(DEFAULT_SEASON);

  const record = $derived(getSeasonRecord(activeSeason) ?? SEASONS_DESC[0]);
  const seasonStats = $derived(statsPack.seasonStats?.[activeSeason]);
  const verdictBody = $derived.by(() => {
    const entry = readVerdict(activeSeason, personaId);
    return entry ? entry.body : null;
  });

  function selectSeason(season: string) {
    activeSeason = season;
    if (typeof window !== 'undefined') {
      const search = `?season=${encodeURIComponent(season)}`;
      history.replaceState(null, '', `${window.location.pathname}${search}`);
    }
    // Best-effort warm of historical match cache — silent failure is fine.
    const year = seasonStartYear(season);
    if (year !== null) {
      void dataService.getHistoricalMatches(year).catch(() => {});
    }
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('season');
    if (requested && getSeasonRecord(requested)) {
      activeSeason = requested;
    }
    // Warm cache for the initially active season.
    const year = seasonStartYear(activeSeason);
    if (year !== null) {
      void dataService.getHistoricalMatches(year).catch(() => {});
    }
  });
</script>

{#snippet body()}
  <section data-archive-page>
    <Rule kicker="ARCHIVE" title="33 seasons on file" action="READ-ONLY" />

    <div class="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]" data-archive-layout>
      <aside class="border-r border-rule lg:pr-4" data-season-rail>
        {#each SEASONS_DESC as r (r.season)}
          <SeasonRow
            season={r.season}
            champion={r.champion?.team ?? null}
            points={r.champion?.points ?? null}
            goalDifference={r.champion?.goalDifference ?? null}
            inProgress={r.inProgress ?? false}
            active={r.season === activeSeason}
            onselect={selectSeason}
          />
        {/each}
      </aside>

      <div data-season-detail-pane>
        <SeasonDetail
          {record}
          {seasonStats}
          verdictBody={verdictBody}
          personaName={persona.name}
        />
      </div>
    </div>

    <p class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim mt-6" data-archive-footer>
      Verdict copy generated per persona via /api/broadsheet · cached locally · live generation lands in K1e
    </p>
  </section>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="insights" kicker="INSIGHTS · ARCHIVE" title="Archive">
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-archive-page-mobile>
  <MobileHeader title="Archive" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
