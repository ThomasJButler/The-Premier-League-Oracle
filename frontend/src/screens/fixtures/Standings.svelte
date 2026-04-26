<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { dataService } from '../../services/dataService';
  import {
    classifyZone,
    zoneRowClass,
    parseFormString,
    pointsPerGame,
  } from '../../lib/standingsHelpers';
  import Crest from '../../components/atoms/Crest.svelte';
  import FormDot from '../../components/atoms/FormDot.svelte';
  import Spark from '../../components/atoms/Spark.svelte';
  import type { Standing, Match } from '../../types';
  import type { TeamSummary } from '../../types/redesign';

  let standings: Standing[] = [];
  let allMatches: Match[] = [];
  let loaded = false;

  function findNextFixtureForTeam(matches: Match[], teamName: string): string | null {
    const now = Date.now();
    const future = matches
      .filter(
        (m) =>
          (m.home_team === teamName || m.away_team === teamName) &&
          new Date(m.date).getTime() > now &&
          !m.result,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    return future[0]?.id ?? null;
  }

  function toTeamSummary(team: Standing['team']): TeamSummary {
    return { abbr: team.tla, name: team.name, crestUrl: team.crest || undefined };
  }

  function handleRowClick(nextId: string | null): void {
    if (!nextId) return;
    navigate(`/match/${nextId}`);
  }

  $: rows = standings.map((s) => ({
    s,
    zone: classifyZone(s.position),
    formDots: parseFormString(s.form),
    ppg: pointsPerGame(s.points, s.playedGames),
    nextFixtureId: findNextFixtureForTeam(allMatches, s.team.name),
  }));

  export async function load(): Promise<void> {
    try {
      [standings, allMatches] = await Promise.all([
        dataService.getStandings(),
        dataService.getCurrentSeasonMatches(),
      ]);
    } catch {
      standings = [];
      allMatches = [];
    }
    loaded = true;
  }

  onMount(load);
</script>

<div class="flex flex-col gap-1 px-4 py-6" data-screen="fixtures-standings">
  <div
    class="grid grid-cols-[2rem_2rem_1fr_2rem_2rem_2rem_2rem_3rem_3rem_3rem_3rem_8rem_4rem] gap-2 px-3 pb-2 text-eyebrow text-text-dim uppercase tracking-wide"
  >
    <div data-col="pos">Pos</div>
    <div data-col="crest" aria-hidden="true"></div>
    <div data-col="team">Team</div>
    <div data-col="p" class="text-right">P</div>
    <div data-col="w" class="text-right">W</div>
    <div data-col="d" class="text-right">D</div>
    <div data-col="l" class="text-right">L</div>
    <div data-col="gf" class="text-right">GF</div>
    <div data-col="ga" class="text-right">GA</div>
    <div data-col="gd" class="text-right">GD</div>
    <div data-col="pts" class="text-right">Pts</div>
    <div data-col="form">Form</div>
    <div data-col="ppg">PPG</div>
  </div>

  {#if loaded}
    {#each rows as row (row.s.team.id)}
      <button
        type="button"
        class="grid grid-cols-[2rem_2rem_1fr_2rem_2rem_2rem_2rem_3rem_3rem_3rem_3rem_8rem_4rem] gap-2 items-center px-3 py-2 rounded text-body-sm hover:bg-surface-hover transition-colors text-left {zoneRowClass(
          row.zone,
        )}"
        data-standings-row
        data-zone={row.zone}
        on:click={() => handleRowClick(row.nextFixtureId)}
      >
        <span data-col="pos" class="font-semibold tabular-nums">{row.s.position}</span>
        <span data-col="crest"><Crest team={toTeamSummary(row.s.team)} size="sm" /></span>
        <span data-col="team" class="truncate">{row.s.team.name}</span>
        <span data-col="p" class="tabular-nums text-right">{row.s.playedGames}</span>
        <span data-col="w" class="tabular-nums text-right">{row.s.won}</span>
        <span data-col="d" class="tabular-nums text-right">{row.s.draw}</span>
        <span data-col="l" class="tabular-nums text-right">{row.s.lost}</span>
        <span data-col="gf" class="tabular-nums text-right">{row.s.goalsFor}</span>
        <span data-col="ga" class="tabular-nums text-right">{row.s.goalsAgainst}</span>
        <span data-col="gd" class="tabular-nums text-right"
          >{row.s.goalDifference > 0 ? '+' : ''}{row.s.goalDifference}</span
        >
        <span data-col="pts" class="font-semibold tabular-nums text-right">{row.s.points}</span>
        <span data-col="form" class="flex gap-1 items-center">
          {#each row.formDots as dot, i (i)}
            {#if dot === 'pending'}
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                style="background-color: hsl(var(--text-faint) / 0.3)"
                data-form-indicator
                data-form-state="pending"
                aria-label="Match pending"
              ></span>
            {:else}
              <span data-form-indicator data-form-state={dot}>
                <FormDot result={dot} />
              </span>
            {/if}
          {/each}
        </span>
        <span data-col="ppg"><Spark data={[row.ppg]} width={48} height={20} /></span>
      </button>
    {/each}
  {/if}
</div>
