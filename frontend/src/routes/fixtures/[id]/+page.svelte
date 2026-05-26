<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import MatchHero from '$lib/components/match/MatchHero.svelte';
  import EnsembleBars from '$lib/components/match/EnsembleBars.svelte';
  import ScorelineBars from '$lib/components/match/ScorelineBars.svelte';
  import SectionTabs from '$lib/components/match/SectionTabs.svelte';
  import FormChips from '$lib/components/match/FormChips.svelte';
  import PunditQuoteBlock from '$lib/components/match/PunditQuoteBlock.svelte';
  import { matchToFixture, enhancedPredictionToV3 } from '$lib/adapters/v3';
  import { displayTeam } from '$lib/utils/displayTeam';
  import { OptimizedPredictor } from '$lib/optimizedPredictions';
  import { recentH2H, type H2HMeeting } from '$lib/match/h2h';
  import { personaStore } from '$lib/stores/persona';
  import { PERSONAS, type PersonaId } from '$lib/personas';
  import { dataService } from '../../../services/dataService';
  import type { Match } from '../../../types';
  import type { Fixture, MatchPrediction } from '../../../types/redesign';
  import { requestFixtureAnalysis } from '$lib/broadsheet/requestFixtureAnalysis';
  import { readAnalysis, writeAnalysis } from '$lib/stores/analysisStore';

  interface PageData {
    id: string;
  }

  const { data }: { data: PageData } = $props();

  type SectionId = 'analysis' | 'probabilities' | 'form' | 'h2h' | 'venue';

  const TABS: ReadonlyArray<{ id: SectionId; label: string }> = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'probabilities', label: 'Probabilities' },
    { id: 'form', label: 'Form' },
    { id: 'h2h', label: 'H2H' },
    { id: 'venue', label: 'Venue' },
  ];

  const VALID_TABS = new Set<SectionId>(TABS.map((t) => t.id));

  let fixture = $state<Fixture | null>(null);
  let prediction = $state<MatchPrediction | null>(null);
  let slate = $state<Match[]>([]);
  let foundMatch = $state<Match | null>(null);
  let loaded = $state(false);
  let activeTab = $state<SectionId>('analysis');
  let analysisBody = $state<string | null>(null);
  let analysisLoading = $state(false);

  const heroKind = $derived<'preview' | 'live'>(
    fixture && fixture.status === 'LIVE' ? 'live' : 'preview'
  );

  const titleLine = $derived(
    fixture ? `${displayTeam(fixture.home.name)} v ${displayTeam(fixture.away.name)}` : 'Match'
  );

  const personaId = $derived($personaStore as PersonaId);
  const activePersona = $derived(PERSONAS[personaId]);

  const h2hMeetings = $derived<H2HMeeting[]>(
    fixture && foundMatch && slate.length > 0
      ? recentH2H(slate, foundMatch.home_team, foundMatch.away_team, foundMatch.date, 5)
      : []
  );

  function isSectionId(v: string): v is SectionId {
    return VALID_TABS.has(v as SectionId);
  }

  function setTab(id: SectionId): void {
    activeTab = id;
    if (typeof window !== 'undefined' && window.location.hash !== `#${id}`) {
      history.replaceState(null, '', `#${id}`);
    }
  }

  function syncFromHash(): void {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.slice(1);
    if (raw && isSectionId(raw)) activeTab = raw;
  }

  function formatMeetingDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso.slice(0, 10);
    }
  }

  function analyseBody(p: MatchPrediction): string {
    if (p.analyseText && p.analyseText.trim()) return p.analyseText.trim();
    if (p.keyFactors && p.keyFactors.length > 0) return p.keyFactors.join(' ');
    return 'The model has enough to call it, but not enough to shout about it.';
  }

  async function loadPersonaAnalysis(
    f: Fixture,
    p: MatchPrediction,
    pid: PersonaId
  ): Promise<void> {
    const cached = readAnalysis(data.id, pid);
    if (cached) {
      analysisBody = cached.body;
      return;
    }
    analysisLoading = true;
    try {
      const result = await requestFixtureAnalysis({
        personaId: pid,
        fixtureId: data.id,
        fixture: {
          home: f.home.name,
          away: f.away.name,
          venue: f.venue ?? undefined
        },
        prediction: {
          ensemble: p.ensemble,
          pick: p.pick,
          pickConfidence: p.pickConfidence,
          keyFactors: p.keyFactors
        }
      });
      if (result.ok) {
        writeAnalysis(data.id, pid, result.analysis);
        analysisBody = result.analysis;
      }
    } catch {
      // swallow — Analysis tab falls back to engine keyFactors via analyseBody()
    } finally {
      analysisLoading = false;
    }
  }

  $effect(() => {
    const f = fixture;
    const p = prediction;
    if (!f || !p) return;
    const pid = personaId;
    const cached = readAnalysis(data.id, pid);
    if (cached) {
      analysisBody = cached.body;
      return;
    }
    analysisBody = null;
    void loadPersonaAnalysis(f, p, pid);
  });

  onMount(async () => {
    syncFromHash();
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', syncFromHash);
    }
    try {
      const matches: Match[] = await dataService.getCurrentSeasonMatches();
      slate = matches;
      const found = matches.find((m) => String(m.id) === String(data.id));
      if (!found) {
        fixture = null;
        return;
      }
      foundMatch = found;
      fixture = matchToFixture(found, matches);
      try {
        const enhanced = await OptimizedPredictor.predictMatch(
          found.home_team,
          found.away_team,
          matches,
          found.referee ?? null,
          found.date,
        );
        prediction = enhancedPredictionToV3(enhanced) ?? null;
      } catch {
        prediction = null;
      }
    } catch {
      fixture = null;
    } finally {
      loaded = true;
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', syncFromHash);
    }
  });
</script>

{#snippet analysisPanel()}
  <section data-section-panel="analysis" class="mt-4">
    {#if prediction}
      <PunditQuoteBlock attribution={activePersona.name}>
        {analysisBody ?? analyseBody(prediction)}
      </PunditQuoteBlock>
      {#if analysisLoading && !analysisBody}
        <p class="font-serif italic text-ink-dim text-[12px] mt-2" data-analysis-loading>
          {activePersona.name} is filing…
        </p>
      {/if}
    {:else if loaded}
      <p class="font-serif italic text-ink-dim text-[14px]" data-analysis-empty>
        {activePersona.name} hasn't filed on this one yet — the model is still
        reading the slate.
      </p>
    {:else}
      <p class="font-serif italic text-ink-dim text-[14px]" data-analysis-empty>
        Loading the slate…
      </p>
    {/if}
  </section>
{/snippet}

{#snippet probabilitiesPanel()}
  <section data-section-panel="probabilities" class="mt-4">
    {#if prediction && fixture}
      <div class="grid gap-6 lg:grid-cols-2" data-match-detail-prediction>
        <EnsembleBars
          models={prediction.models}
          homeAbbr={fixture.home.abbr}
          awayAbbr={fixture.away.abbr}
        />
        <ScorelineBars
          scorelines={prediction.topScorelines}
          homeAbbr={fixture.home.abbr}
          awayAbbr={fixture.away.abbr}
        />
      </div>
    {:else if loaded}
      <Rule kicker="PREDICTIONS" title="Model warming up" />
      <p class="font-serif italic text-ink-dim text-[14px] mt-3">
        The ensemble couldn't read enough history for this fixture. Refresh once
        the slate fully loads.
      </p>
    {/if}
  </section>
{/snippet}

{#snippet formPanel()}
  <section data-section-panel="form" class="mt-4">
    {#if fixture}
      <div class="grid gap-6 sm:grid-cols-2" data-form-grid>
        <FormChips label={fixture.home.abbr} form={fixture.home.formLast5} />
        <FormChips label={fixture.away.abbr} form={fixture.away.formLast5} />
      </div>
      <p class="font-serif italic text-[11px] text-ink-dim mt-4">
        Most recent first. W = win, D = draw, L = loss.
      </p>
    {/if}
  </section>
{/snippet}

{#snippet h2hPanel()}
  <section data-section-panel="h2h" class="mt-4">
    {#if h2hMeetings.length > 0}
      <ol class="flex flex-col divide-y divide-rule" data-h2h-list>
        {#each h2hMeetings as meeting (meeting.id)}
          <li
            class="py-2 grid grid-cols-[110px_1fr_auto] items-center gap-3"
            data-h2h-row
          >
            <span class="font-mono text-[11px] text-ink-dim">
              {formatMeetingDate(meeting.date)}
            </span>
            <span class="font-sans text-[12px] text-ink">
              {meeting.home} <span class="text-ink-dim">v</span> {meeting.away}
            </span>
            <span
              class="font-mono text-[13px] font-bold text-ink"
              data-h2h-score
            >
              {meeting.homeGoals}-{meeting.awayGoals}
            </span>
          </li>
        {/each}
      </ol>
    {:else if loaded}
      <p class="font-serif italic text-ink-dim text-[14px]" data-h2h-empty>
        No prior meetings on file in the current slate.
      </p>
    {/if}
  </section>
{/snippet}

{#snippet venuePanel()}
  <section data-section-panel="venue" class="mt-4">
    {#if fixture?.venue}
      <p class="font-serif text-ink text-[18px]" data-venue-name>
        {fixture.venue}
      </p>
    {:else}
      <p class="font-serif italic text-ink-dim text-[14px]" data-venue-empty>
        Venue not provided by the feed for this fixture.
      </p>
    {/if}
    <p class="font-serif italic text-[12px] text-ink-dim mt-3">
      Stadium notes, pitch dimensions and travel guidance arrive with K1d.
    </p>
  </section>
{/snippet}

{#snippet body()}
  {#if fixture}
    <MatchHero {fixture} kind={heroKind} />
    <div class="mt-8" data-match-detail-sections>
      <SectionTabs tabs={TABS} active={activeTab} onSelect={setTab} />
      {#if activeTab === 'analysis'}
        {@render analysisPanel()}
      {:else if activeTab === 'probabilities'}
        {@render probabilitiesPanel()}
      {:else if activeTab === 'form'}
        {@render formPanel()}
      {:else if activeTab === 'h2h'}
        {@render h2hPanel()}
      {:else if activeTab === 'venue'}
        {@render venuePanel()}
      {/if}
    </div>
  {:else if loaded}
    <div data-match-detail-missing>
      <Rule kicker="404" title="Fixture not found" />
      <p class="font-serif italic text-ink-dim text-[14px] mt-3">
        That match isn't on the current slate. <a class="underline" href="/fixtures">Back to fixtures</a>.
      </p>
    </div>
  {:else}
    <div
      class="font-serif italic text-ink-dim text-[14px] py-8 text-center"
      data-match-detail-loading
    >
      Loading the slate…
    </div>
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="fixtures" kicker="MATCH DETAIL" title={titleLine}>
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-match-detail-page>
  <MobileHeader title={titleLine} sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="fixtures" />
  </div>
</div>
