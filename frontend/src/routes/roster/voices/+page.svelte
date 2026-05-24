<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import VoiceColumn from '$lib/components/roster/VoiceColumn.svelte';
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

  function pick(id: PersonaId): void {
    personaStore.set(id);
  }
</script>

{#snippet body()}
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

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="VOICE RANGE" title="Ten Voices">
    <div class="px-8 py-6 max-w-6xl">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-voices-page>
  <MobileHeader title="Voice Range" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
