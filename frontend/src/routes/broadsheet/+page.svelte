<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';
  import { dataService } from '../../services/dataService';
  import { findCurrentGameweek } from '$lib/gameweek';
  import { readBroadsheet, writeBroadsheet, clearBroadsheet } from '$lib/stores/broadsheetStore';
  import { requestBroadsheet } from '$lib/broadsheet/requestBroadsheet';
  import { notifyBroadsheetReady } from '$lib/broadsheet/notifyBroadsheetReady';
  import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';

  interface PageData {
    initialGameweek?: number;
  }

  const { data }: { data?: PageData } = $props();

  const personaId = $derived($personaStore as PersonaId);
  const persona = $derived(getPersona(personaId));

  let resolvedGameweek = $state<number | null>(null);
  const gameweek = $derived(resolvedGameweek ?? data?.initialGameweek ?? null);
  let broadsheet = $state<BroadsheetJson | null>(null);
  let generatedAt = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  function loadFromCache(gw: number, id: PersonaId): void {
    const entry = readBroadsheet(gw, id);
    if (entry) {
      broadsheet = entry.broadsheet;
      generatedAt = entry.generatedAt;
    } else {
      broadsheet = null;
      generatedAt = null;
    }
  }

  onMount(async () => {
    if (gameweek === null) {
      try {
        const matches = await dataService.getCurrentSeasonMatches();
        resolvedGameweek = findCurrentGameweek(matches);
      } catch {
        resolvedGameweek = null;
      }
    }
    if (gameweek !== null) loadFromCache(gameweek, personaId);
  });

  // Re-read cache when persona switches mid-session so the user sees the
  // already-generated copy for that voice (if any) without re-hitting the API.
  $effect(() => {
    if (gameweek !== null) loadFromCache(gameweek, personaId);
  });

  async function generate(): Promise<void> {
    if (gameweek === null) return;
    loading = true;
    error = null;
    const result = await requestBroadsheet({ personaId, gameweek });
    loading = false;
    if (result.ok) {
      const entry = writeBroadsheet(gameweek, personaId, result.broadsheet, result.generatedAt);
      broadsheet = entry.broadsheet;
      generatedAt = entry.generatedAt;
      notifyBroadsheetReady({
        personaId,
        personaName: persona.name,
        gameweek,
        headline: entry.broadsheet.headline
      });
    } else {
      error = result.error;
    }
  }

  function regenerate(): void {
    if (gameweek === null) return;
    clearBroadsheet(gameweek, personaId);
    broadsheet = null;
    generatedAt = null;
    void generate();
  }

  const titleLine = $derived(broadsheet?.headline ?? 'The Broadsheet');
</script>

{#snippet body()}
  <article class="kicker-broadsheet max-w-[900px] mx-auto" data-broadsheet>
    <Rule
      kicker={gameweek !== null ? `GAMEWEEK ${gameweek} · BROADSHEET` : 'BROADSHEET'}
      title={persona.name + "'s editorial"}
    />

    {#if broadsheet}
      <header class="mt-6" data-broadsheet-header>
        <h2
          class="kicker-broadsheet__headline font-serif font-bold tracking-[-0.02em] text-ink"
          data-broadsheet-headline
        >
          {broadsheet.headline}
        </h2>
        <p
          class="kicker-broadsheet__standfirst font-serif italic text-ink-soft text-[18px] leading-[1.4] mt-3"
          data-broadsheet-standfirst
        >
          {broadsheet.standfirst}
        </p>
        <p
          class="font-sans text-[10px] tracking-[0.3em] uppercase font-bold mt-4"
          data-broadsheet-byline
        >
          {broadsheet.byline}
          {#if generatedAt}
            <span class="text-ink-soft normal-case tracking-normal italic ml-2 font-serif text-[12px]">
              generated {new Date(generatedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
            </span>
          {/if}
        </p>
      </header>

      <div
        class="kicker-broadsheet__body grid gap-8 mt-8 font-serif text-ink text-[16px] leading-[1.6]"
        data-broadsheet-body
      >
        {#each broadsheet.sections as section, i (i)}
          <section data-broadsheet-section>
            <h3
              class="font-sans text-[11px] tracking-[0.3em] uppercase font-bold text-red mb-2"
              data-broadsheet-section-heading
            >
              {section.heading}
            </h3>
            <p data-broadsheet-section-body>{section.body}</p>
          </section>
        {/each}
      </div>

      {#if broadsheet.pullQuote}
        <blockquote
          class="kicker-broadsheet__pull mt-8 pt-4 border-t-2 font-serif italic text-ink text-[22px] leading-[1.35]"
          data-broadsheet-pull
        >
          {broadsheet.pullQuote}
        </blockquote>
      {/if}

      {#if broadsheet.closingLine}
        <p
          class="font-serif italic text-ink-soft text-[14px] mt-6"
          data-broadsheet-closing
        >
          {broadsheet.closingLine}
        </p>
      {/if}

      <div class="mt-8 flex items-center gap-3" data-broadsheet-actions>
        <button
          type="button"
          onclick={regenerate}
          disabled={loading}
          class="font-mono text-[10px] tracking-[0.25em] uppercase font-bold border border-ink px-3 py-2 disabled:opacity-50"
          data-broadsheet-regenerate
        >
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
        <span class="font-serif italic text-ink-soft text-[12px]">
          cached at {persona.name}'s desk · key kicker:broadsheet:gw{gameweek}:{personaId}
        </span>
      </div>
    {:else if loading}
      <p class="font-serif italic text-ink-soft text-[14px] mt-6" data-broadsheet-loading>
        {persona.name} is filing copy… (Sonnet 4.5)
      </p>
    {:else if gameweek === null}
      <p class="font-serif italic text-ink-soft text-[14px] mt-6" data-broadsheet-no-gw>
        No active gameweek on file. Add a Football-Data API key on Settings to populate the slate.
      </p>
    {:else}
      <div class="mt-6" data-broadsheet-empty>
        <p class="font-serif italic text-ink-soft text-[14px]">
          No broadsheet on file for Gameweek {gameweek} from {persona.name} yet.
        </p>
        <button
          type="button"
          onclick={generate}
          class="mt-4 font-mono text-[10px] tracking-[0.25em] uppercase font-bold border border-ink px-3 py-2"
          data-broadsheet-generate
        >
          Generate the GW{gameweek} broadsheet
        </button>
        <p class="font-serif italic text-ink-soft text-[12px] mt-2">
          One-shot Sonnet 4.5 call · rate-limited 10/min · cached locally
        </p>
      </div>
    {/if}

    {#if error}
      <p class="font-mono text-[12px] text-red mt-4" data-broadsheet-error>
        ⚠ {error}
      </p>
    {/if}
  </article>
{/snippet}

{#snippet mobileBody()}
  <article class="kicker-broadsheet" data-broadsheet data-broadsheet-mobile>
    <Rule
      kicker={gameweek !== null ? `GAMEWEEK ${gameweek} · BROADSHEET` : 'BROADSHEET'}
      title={persona.name + "'s editorial"}
    />

    {#if broadsheet}
      <header class="mt-5" data-broadsheet-header>
        <h2
          class="kicker-broadsheet__headline-mobile font-serif font-bold tracking-[-0.02em] text-ink"
          data-broadsheet-headline
        >
          {broadsheet.headline}
        </h2>
        <p
          class="font-serif italic text-ink-soft text-[16px] leading-[1.4] mt-3"
          data-broadsheet-standfirst
        >
          {broadsheet.standfirst}
        </p>
        <p
          class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold mt-3"
          data-broadsheet-byline
        >
          {broadsheet.byline}
          {#if generatedAt}
            <span class="block text-ink-soft normal-case tracking-normal italic mt-1 font-serif text-[11px]">
              generated {new Date(generatedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
            </span>
          {/if}
        </p>
      </header>

      <div
        class="mt-6 flex flex-col gap-5 font-serif text-ink text-[15px] leading-[1.65]"
        data-broadsheet-body data-broadsheet-body-mobile
      >
        {#each broadsheet.sections as section, i (i)}
          {#if i > 0}
            <div
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
              data-broadsheet-section-break
              aria-hidden="true"
            >
              <div class="h-px bg-ink"></div>
              <div class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold text-red">§</div>
              <div class="h-px bg-ink"></div>
            </div>
          {/if}
          <section data-broadsheet-section data-broadsheet-card-mobile>
            <h3
              class="font-sans text-[10px] tracking-[0.3em] uppercase font-bold text-red mb-2"
              data-broadsheet-section-heading
            >
              {section.heading}
            </h3>
            <p data-broadsheet-section-body>
              {#if i === 0 && section.body.length > 0}<span
                  class="kicker-broadsheet__dropcap-mobile"
                  data-broadsheet-dropcap>{section.body.charAt(0)}</span>{section.body.slice(1)}{:else}{section.body}{/if}
            </p>
          </section>
        {/each}
      </div>

      {#if broadsheet.pullQuote}
        <aside
          class="kicker-broadsheet__hot-take-mobile mt-6 relative px-4 py-4 border-2 border-ink"
          data-broadsheet-pull
          data-broadsheet-hot-take
        >
          <span
            class="absolute -top-2 left-3 px-2 py-0.5 font-sans text-[9px] tracking-[0.3em] uppercase font-bold bg-ink text-paper"
            data-broadsheet-hot-take-label
          >
            HOT TAKE
          </span>
          <blockquote class="font-serif italic text-ink text-[18px] leading-[1.35] mt-1">
            {broadsheet.pullQuote}
          </blockquote>
        </aside>
      {/if}

      {#if broadsheet.closingLine}
        <p
          class="font-serif italic text-ink-soft text-[13px] mt-5"
          data-broadsheet-closing
        >
          {broadsheet.closingLine}
        </p>
      {/if}

      <div class="mt-6 flex flex-col gap-2" data-broadsheet-actions>
        <button
          type="button"
          onclick={regenerate}
          disabled={loading}
          class="font-mono text-[10px] tracking-[0.25em] uppercase font-bold border border-ink px-3 py-2 disabled:opacity-50 w-full"
          data-broadsheet-regenerate
        >
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
        <span class="font-serif italic text-ink-soft text-[11px]">
          cached at {persona.name}'s desk
        </span>
      </div>
    {:else if loading}
      <p class="font-serif italic text-ink-soft text-[14px] mt-6" data-broadsheet-loading>
        {persona.name} is filing copy… (Sonnet 4.5)
      </p>
    {:else if gameweek === null}
      <p class="font-serif italic text-ink-soft text-[14px] mt-6" data-broadsheet-no-gw>
        No active gameweek on file. Add a Football-Data API key on Settings to populate the slate.
      </p>
    {:else}
      <div class="mt-6" data-broadsheet-empty>
        <p class="font-serif italic text-ink-soft text-[14px]">
          No broadsheet on file for Gameweek {gameweek} from {persona.name} yet.
        </p>
        <button
          type="button"
          onclick={generate}
          class="mt-4 w-full font-mono text-[10px] tracking-[0.25em] uppercase font-bold border border-ink px-3 py-2"
          data-broadsheet-generate
        >
          Generate the GW{gameweek} broadsheet
        </button>
        <p class="font-serif italic text-ink-soft text-[12px] mt-2">
          One-shot Sonnet 4.5 call · rate-limited 10/min · cached locally
        </p>
      </div>
    {/if}

    {#if error}
      <p class="font-mono text-[12px] text-red mt-4" data-broadsheet-error>
        ⚠ {error}
      </p>
    {/if}
  </article>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="today" kicker="BROADSHEET" title={titleLine}>
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-broadsheet-page-mobile>
  <MobileHeader title={titleLine} sub="THE KICKER · BROADSHEET">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render mobileBody()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="today" />
  </div>
</div>

<style>
  .kicker-broadsheet__headline {
    font-size: 44px;
    line-height: 1.05;
  }
  @media (min-width: 768px) {
    .kicker-broadsheet__headline {
      font-size: 54px;
    }
  }
  @media (min-width: 1024px) {
    .kicker-broadsheet__headline {
      font-size: 64px;
    }
  }
  .kicker-broadsheet__pull {
    border-color: var(--persona-accent, var(--red));
  }
  .kicker-broadsheet__headline-mobile {
    font-size: 32px;
    line-height: 1.02;
  }
  .kicker-broadsheet__dropcap-mobile {
    float: left;
    font-family: inherit;
    font-weight: 700;
    font-size: 48px;
    line-height: 0.85;
    margin: 4px 8px 0 0;
    color: var(--persona-accent, var(--red));
  }
  .kicker-broadsheet__hot-take-mobile {
    background: var(--paper-warm, #f8f0df);
    border-color: var(--persona-accent, var(--ink));
  }
</style>
