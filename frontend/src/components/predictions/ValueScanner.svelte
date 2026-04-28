<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../../services/dataService';
  import {
    ValueBettingEngine,
    type ValueBet,
    type MarketOdds,
  } from '../../services/betting/value';
  import SectionHeader from '../atoms/SectionHeader.svelte';
  import type { Match } from '../../types';

  const BANKROLL_KEY = 'kelly_bankroll';

  function readSavedBankroll(): number {
    if (typeof localStorage === 'undefined') return 100;
    const saved = localStorage.getItem(BANKROLL_KEY);
    if (!saved) return 100;
    const parsed = parseFloat(saved);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
  }

  let upcomingMatches: Match[] = [];
  let selectedMatchId = '';
  let matchesLoading = true;
  let loading = false;
  let error: string | null = null;
  let valueBets: ValueBet[] = [];
  let hasScanned = false;

  let homeOdds = 0;
  let drawOdds = 0;
  let awayOdds = 0;
  let over25Odds = 0;
  let under25Odds = 0;
  let bttsOdds = 0;
  let bttsNoOdds = 0;
  let bankroll = readSavedBankroll();

  $: selectedMatch = upcomingMatches.find((m) => m.id === selectedMatchId) ?? null;
  $: hasBasicOdds = homeOdds > 1 && drawOdds > 1 && awayOdds > 1;

  function saveBankroll(): void {
    localStorage.setItem(BANKROLL_KEY, String(bankroll));
  }

  function handleBankrollInput(): void {
    saveBankroll();
  }

  export async function loadMatches(): Promise<void> {
    matchesLoading = true;
    error = null;
    try {
      const matches = await dataService.getMatches({ upcoming: true, days: 14 });
      upcomingMatches = matches.filter((m) => !m.result);
      if (upcomingMatches.length > 0 && !selectedMatchId) {
        selectedMatchId = upcomingMatches[0].id;
      }
    } catch {
      error = 'Could not load upcoming matches. Check your API key in Settings.';
    } finally {
      matchesLoading = false;
    }
  }

  export async function scanForValue(): Promise<void> {
    if (!selectedMatch || !hasBasicOdds) return;
    loading = true;
    hasScanned = true;
    valueBets = [];
    error = null;
    try {
      const marketOdds: MarketOdds = {
        home: homeOdds,
        draw: drawOdds,
        away: awayOdds,
        ...(over25Odds > 1 && under25Odds > 1
          ? { over25: over25Odds, under25: under25Odds }
          : {}),
        ...(bttsOdds > 1 && bttsNoOdds > 1
          ? { btts: bttsOdds, bttsNo: bttsNoOdds }
          : {}),
      };
      valueBets = await ValueBettingEngine.identifyValueBets(
        selectedMatch.id,
        selectedMatch.home_team,
        selectedMatch.away_team,
        new Date(selectedMatch.date),
        marketOdds,
        bankroll,
      );
    } catch {
      error = 'Failed to analyse odds. Please try again.';
    } finally {
      loading = false;
    }
  }

  function marketLabel(market: ValueBet['market']): string {
    switch (market) {
      case 'home':
        return 'Home win';
      case 'draw':
        return 'Draw';
      case 'away':
        return 'Away win';
      case 'over2.5':
        return 'Over 2.5';
      case 'under2.5':
        return 'Under 2.5';
      case 'btts':
        return 'BTTS yes';
      default:
        return market;
    }
  }

  function impliedPct(odds: number): string {
    return ((1 / odds) * 100).toFixed(1);
  }

  function fixtureLabel(bet: ValueBet): string {
    return `${bet.homeTeam} vs ${bet.awayTeam}`;
  }

  onMount(loadMatches);
</script>

<div
  class="rounded-lg border border-border bg-bg-raised p-6"
  data-testid="value-scanner"
>
  <SectionHeader kicker="VALUE SCAN" title="Where the model disagrees with consensus" />

  {#if matchesLoading}
    <p class="text-body-sm text-text-dim py-4">Loading matches…</p>
  {:else if upcomingMatches.length === 0}
    <p
      class="text-body-sm text-text-dim text-center py-6"
      data-no-matches
    >
      No upcoming matches in the next 14 days.
    </p>
  {:else}
    <div class="flex flex-col gap-4">
      <div>
        <label for="value-match-select" class="block text-label text-foreground mb-1.5">
          Select match
        </label>
        <select
          id="value-match-select"
          data-input="match-select"
          bind:value={selectedMatchId}
          class="w-full px-3 py-2.5 rounded-md border border-border bg-bg-inset text-foreground text-label"
        >
          {#each upcomingMatches as match (match.id)}
            <option value={match.id}>
              {match.home_team} vs {match.away_team}
            </option>
          {/each}
        </select>
      </div>

      <div>
        <p class="text-eyebrow text-text-dim mb-2">Match result (required)</p>
        <div class="grid grid-cols-3 gap-2">
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">Home</span>
            <input
              data-input="home-odds"
              type="number"
              bind:value={homeOdds}
              min="1.01"
              step="0.01"
              placeholder="2.10"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">Draw</span>
            <input
              data-input="draw-odds"
              type="number"
              bind:value={drawOdds}
              min="1.01"
              step="0.01"
              placeholder="3.40"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">Away</span>
            <input
              data-input="away-odds"
              type="number"
              bind:value={awayOdds}
              min="1.01"
              step="0.01"
              placeholder="3.60"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
        </div>
      </div>

      <div>
        <p class="text-eyebrow text-text-dim mb-2">
          Goals 2.5 <span class="text-text-dim opacity-60">(optional)</span>
        </p>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">Over 2.5</span>
            <input
              data-input="over25-odds"
              type="number"
              bind:value={over25Odds}
              min="1.01"
              step="0.01"
              placeholder="1.85"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">Under 2.5</span>
            <input
              data-input="under25-odds"
              type="number"
              bind:value={under25Odds}
              min="1.01"
              step="0.01"
              placeholder="2.00"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
        </div>
      </div>

      <div>
        <p class="text-eyebrow text-text-dim mb-2">
          Both teams to score <span class="text-text-dim opacity-60">(optional)</span>
        </p>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">BTTS yes</span>
            <input
              data-input="btts-odds"
              type="number"
              bind:value={bttsOdds}
              min="1.01"
              step="0.01"
              placeholder="1.70"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
          <label class="block">
            <span class="block text-body-sm text-text-dim mb-1">BTTS no</span>
            <input
              data-input="btts-no-odds"
              type="number"
              bind:value={bttsNoOdds}
              min="1.01"
              step="0.01"
              placeholder="2.10"
              class="w-full px-2 py-2 rounded-md border border-border bg-bg-inset text-foreground text-label text-center"
            />
          </label>
        </div>
      </div>

      <div>
        <label for="value-bankroll" class="block text-label text-foreground mb-1.5">
          Bankroll
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-body">£</span>
          <input
            id="value-bankroll"
            data-input="bankroll"
            type="number"
            bind:value={bankroll}
            on:input={handleBankrollInput}
            min="1"
            step="10"
            class="w-full pl-7 pr-3 py-2.5 rounded-md border border-border bg-bg-inset text-foreground text-label"
          />
        </div>
      </div>

      <button
        type="button"
        data-action="scan"
        on:click={scanForValue}
        disabled={!hasBasicOdds || loading}
        class="w-full py-2.5 rounded-md text-label transition-colors {hasBasicOdds && !loading
          ? 'bg-accent text-foreground hover:opacity-90'
          : 'bg-bg-inset text-text-dim cursor-not-allowed'}"
      >
        {loading ? 'Analysing…' : 'Scan for value'}
      </button>

      {#if error}
        <p class="text-body-sm text-red-500" role="alert">{error}</p>
      {/if}

      {#if !loading && hasScanned && valueBets.length === 0 && !error}
        <p
          class="text-body-sm text-text-dim text-center py-4"
          data-no-value-found
        >
          No value found at these odds — the market looks efficient here.
        </p>
      {/if}

      {#if valueBets.length > 0}
        <div
          data-value-table
          class="grid items-center gap-x-4 gap-y-2 mt-2 text-body-sm border-t border-border pt-3"
          style="grid-template-columns: minmax(0, 1fr) auto auto auto auto auto;"
          aria-live="polite"
          aria-label="Value bet results"
        >
          <span class="text-eyebrow text-text-dim">Fixture</span>
          <span class="text-eyebrow text-text-dim">Market</span>
          <span class="text-eyebrow text-text-dim text-right">Model %</span>
          <span class="text-eyebrow text-text-dim text-right">Market %</span>
          <span class="text-eyebrow text-text-dim text-right">Edge</span>
          <span class="text-eyebrow text-text-dim text-right">Conf</span>

          {#each valueBets as bet (bet.market)}
            <div class="contents" data-value-row data-market={bet.market}>
              <span data-cell="fixture" class="text-foreground truncate">
                {fixtureLabel(bet)}
              </span>
              <span data-cell="market" class="text-foreground">
                {marketLabel(bet.market)}
              </span>
              <span data-cell="model-prob" class="text-foreground tabular-nums text-right">
                {(bet.ourProbability * 100).toFixed(1)}%
              </span>
              <span data-cell="market-prob" class="text-text-dim tabular-nums text-right">
                {impliedPct(bet.bookmakerOdds)}%
              </span>
              <span
                data-cell="edge"
                class="tabular-nums text-right text-emerald-500"
              >
                +{(bet.edge * 100).toFixed(1)}%
              </span>
              <span
                data-cell="confidence"
                class="text-right text-eyebrow"
                class:text-emerald-500={bet.confidence === 'high'}
                class:text-amber-500={bet.confidence === 'medium'}
                class:text-text-dim={bet.confidence === 'low'}
              >
                {bet.confidence}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
