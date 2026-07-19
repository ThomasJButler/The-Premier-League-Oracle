<script lang="ts">
  import { onMount } from "svelte";
  import KickerShell from "$lib/components/shell/KickerShell.svelte";
  import MobileHeader from "$lib/components/shell/MobileHeader.svelte";
  import MobileNav from "$lib/components/shell/MobileNav.svelte";
  import MobilePersonaPill from "$lib/components/persona/MobilePersonaPill.svelte";
  import Rule from "$lib/components/atoms/Rule.svelte";
  import MatchRow from "$lib/components/fixtures/MatchRow.svelte";
  import { personaStore } from "$lib/stores/persona";
  import type { PersonaId } from "$lib/personas";
  import { getEmptyStateCopy } from "$lib/copy/emptyStates";
  import { dataService } from "../../services/dataService";
  import { predictionTracker } from "../../services/predictionTracker";
  import { getTeamColor } from "../../utils/teamLogos";
  import { tvTeamsFrom, isTvPick } from "$lib/fixtureFilters";
  import type { Match, Standing } from "../../types";

  const DEFAULT_PROBS = { home: 0.4, draw: 0.3, away: 0.3 };

  function probsFor(matchId: string): { home: number; draw: number; away: number } {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    const pp = stored?.poissonProbs;
    if (pp) return { home: pp.homeWin, draw: pp.draw, away: pp.awayWin };
    return DEFAULT_PROBS;
  }

  const emptyCopy = $derived(getEmptyStateCopy("fixtures", $personaStore as PersonaId));

  type FilterId = "all" | "top6" | "relegation" | "tv";

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: "all", label: "ALL" },
    { id: "top6", label: "TOP 6" },
    { id: "relegation", label: "RELEGATION" },
    { id: "tv", label: "TV PICKS" },
  ];

  let matches = $state<Match[]>([]);
  let standings = $state<Standing[]>([]);
  let activeFilter = $state<FilterId>("all");

  const top6Teams = $derived(
    standings.filter((s) => s.position <= 6).map((s) => s.team.name)
  );
  const relegationTeams = $derived(
    standings.filter((s) => s.position >= 18).map((s) => s.team.name)
  );
  const tvTeams = $derived(tvTeamsFrom(standings));
  const upcomingMatches = $derived(matches.filter((m) => m.status !== "FINISHED"));

  const filteredMatches = $derived.by(() => {
    if (activeFilter === "top6" && top6Teams.length > 0)
      return upcomingMatches.filter((m) => top6Teams.includes(m.home_team) || top6Teams.includes(m.away_team));
    if (activeFilter === "relegation" && relegationTeams.length > 0)
      return upcomingMatches.filter((m) => relegationTeams.includes(m.home_team) || relegationTeams.includes(m.away_team));
    if (activeFilter === "tv" && tvTeams.length > 0)
      return upcomingMatches.filter((m) => isTvPick(m, tvTeams));
    return upcomingMatches;
  });

  type MatchGroup = { dateKey: string; label: string; matches: Match[] };

  const groupedByDate = $derived.by((): MatchGroup[] => {
    const groups = new Map<string, Match[]>();
    for (const m of filteredMatches) {
      const key = m.date.slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, ms]) => ({
        dateKey: key,
        label: formatDateLabel(key),
        matches: ms.sort((a, b) => a.date.localeCompare(b.date)),
      }));
  });

  function formatDateLabel(isoDay: string): string {
    const d = new Date(isoDay + "T12:00:00Z");
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    }).format(d).toUpperCase();
  }

  onMount(async () => {
    const [ms, st] = await Promise.all([
      dataService.getCurrentSeasonMatches().catch(() => [] as Match[]),
      dataService.getStandings().catch(() => [] as Standing[]),
    ]);
    matches = ms;
    standings = st;
  });
</script>

{#snippet body()}
  <div class="flex items-center gap-1 mb-6" data-filter-bar>
    {#each FILTERS as f (f.id)}
      {@const isActive = activeFilter === f.id}
      <button
        class="px-3 py-1.5 font-sans text-[11px] font-bold tracking-widest border transition-colors"
        class:bg-ink={isActive}
        class:text-paper={isActive}
        class:border-ink={isActive}
        class:text-ink-dim={!isActive}
        class:border-rule={!isActive}
        data-filter-chip={f.id}
        data-filter-active={isActive}
        onclick={() => (activeFilter = f.id)}
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if groupedByDate.length === 0}
    <div class="font-serif italic text-ink-dim text-[14px] py-8 text-center" data-fixtures-empty>
      {emptyCopy}
    </div>
  {:else}
    {#each groupedByDate as group (group.dateKey)}
      <div class="mb-8" data-date-group={group.dateKey}>
        <Rule kicker={group.label} title="{group.matches.length} fixture{group.matches.length !== 1 ? 's' : ''}" />
        <div class="space-y-2" data-match-list>
          {#each group.matches as match (match.id)}
            {@const p = probsFor(match.id)}
            <MatchRow
              {match}
              probH={p.home}
              probD={p.draw}
              probA={p.away}
              standings={standings}
              homeColor={getTeamColor(match.home_team)}
              awayColor={getTeamColor(match.away_team)}
            />
          {/each}
        </div>
      </div>
    {/each}
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="fixtures" kicker="FIXTURES" title="Fixtures">
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-fixtures-page>
  <MobileHeader title="Fixtures" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="fixtures" />
  </div>
</div>
