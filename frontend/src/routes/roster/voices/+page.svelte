<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import VoiceColumn from '$lib/components/roster/VoiceColumn.svelte';
  import KpiSnapDots from '$lib/components/predictions/KpiSnapDots.svelte';
  import { personaStore } from '$lib/stores/persona';
  import {
    getPersona,
    KICKER_PERSONA_ORDER,
    type PersonaId
  } from '$lib/personas';
  import { getVoiceTake } from '$lib/fixtures/voiceTakes';

  const rows = KICKER_PERSONA_ORDER.map((id) => ({
    persona: getPersona(id),
    take: getVoiceTake(id)
  }));
  const activeId = $derived($personaStore as PersonaId);
  let activeCarouselIndex = $state(0);

  function pick(id: PersonaId): void {
    personaStore.set(id);
  }

  function monogramFor(persona: ReturnType<typeof getPersona>): string {
    return (
      persona.short.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() ||
      persona.id.slice(0, 1).toUpperCase()
    );
  }

  function onCarouselScroll(e: Event): void {
    const el = e.currentTarget as HTMLDivElement;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    activeCarouselIndex = Math.max(0, Math.min(rows.length - 1, idx));
  }

  function scrollCarouselTo(carousel: HTMLDivElement | null, index: number): void {
    if (!carousel) return;
    carousel.scrollTo({ left: index * carousel.clientWidth, behavior: 'smooth' });
  }

  let carouselEl: HTMLDivElement | null = $state(null);

  function tapAvatar(id: PersonaId, index: number): void {
    pick(id);
    scrollCarouselTo(carouselEl, index);
    activeCarouselIndex = index;
  }
</script>

{#snippet desktopBody()}
  <Rule
    kicker="VOICE RANGE"
    title="Ten voices, one matchup"
    action="Liverpool v Tottenham · Anfield"
  />

  <p class="font-serif italic text-[13px] text-ink-dim mb-4 max-w-2xl" data-voices-intro>
    The same fixture, filed ten different ways. Tap any column to make that pundit the voice of
    your paper.
  </p>

  <div
    class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
    data-voices-grid
  >
    {#each rows as row (row.persona.id)}
      <VoiceColumn
        persona={row.persona}
        take={row.take}
        selected={row.persona.id === activeId}
        onclick={pick}
      />
    {/each}
  </div>

  <a
    href="/roster"
    class="inline-block mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim border-b border-rule pb-0.5 hover:text-ink"
    data-voices-roster-link
  >
    ← Back to the roster
  </a>
{/snippet}

{#snippet mobileBody()}
  <Rule
    kicker="VOICE RANGE"
    title="Ten voices, one matchup"
    action="Liverpool v Tottenham · Anfield"
  />

  <p class="font-serif italic text-[13px] text-ink-dim mb-4" data-voices-intro>
    The same fixture, filed ten different ways. Swipe through the voices below.
  </p>

  <div
    class="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2"
    data-voices-strip
  >
    {#each rows as row, i (row.persona.id)}
      <button
        type="button"
        class="kicker-voice-avatar shrink-0 w-9 h-9 inline-flex items-center justify-center font-serif font-extrabold text-[14px] rounded-full border border-rule transition-colors"
        class:is-active={row.persona.id === activeId}
        data-voices-avatar
        data-voices-avatar-id={row.persona.id}
        data-voices-avatar-active={row.persona.id === activeId ? 'true' : 'false'}
        aria-label={row.persona.name}
        aria-pressed={row.persona.id === activeId}
        onclick={() => tapAvatar(row.persona.id, i)}
      >
        {monogramFor(row.persona)}
      </button>
    {/each}
  </div>

  <div
    bind:this={carouselEl}
    class="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 mt-3"
    data-voices-grid
    data-voices-carousel
    onscroll={onCarouselScroll}
  >
    {#each rows as row (row.persona.id)}
      <div class="snap-center shrink-0 w-full" data-voices-carousel-slide>
        <VoiceColumn
          persona={row.persona}
          take={row.take}
          selected={row.persona.id === activeId}
          onclick={pick}
        />
      </div>
    {/each}
  </div>

  <KpiSnapDots count={rows.length} activeIndex={activeCarouselIndex} />

  <p
    class="text-center font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim mt-1"
    data-voices-swipe-hint
  >
    ← Swipe between voices →
  </p>

  <a
    href="/roster"
    class="inline-block mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim border-b border-rule pb-0.5 hover:text-ink"
    data-voices-roster-link
  >
    ← Back to the roster
  </a>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="VOICE RANGE" title="Ten Voices">
    <div class="px-8 py-6 max-w-6xl">
      {@render desktopBody()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-voices-page>
  <MobileHeader title="Voice Range" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render mobileBody()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>

<style>
  .kicker-voice-avatar {
    background: var(--paper);
    color: var(--ink-dim);
    border-color: var(--rule);
  }
  .kicker-voice-avatar.is-active {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
    border-color: var(--persona-accent, var(--ink));
  }
</style>
