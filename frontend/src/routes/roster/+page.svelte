<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import PunditCard from '$lib/components/roster/PunditCard.svelte';
  import { personaStore } from '$lib/stores/persona';
  import {
    getPersona,
    KICKER_PERSONA_ORDER,
    type PersonaId
  } from '$lib/personas';

  const personas = KICKER_PERSONA_ORDER.map((id) => getPersona(id));
  const activeId = $derived($personaStore as PersonaId);

  function pick(id: PersonaId): void {
    personaStore.set(id);
  }
</script>

{#snippet body()}
  <Rule kicker="THE STAFF" title="The Roster" action="Tap a pundit to switch voice" />

  <div
    class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
    data-roster-grid
  >
    {#each personas as persona (persona.id)}
      <PunditCard
        {persona}
        selected={persona.id === activeId}
        onclick={pick}
      />
    {/each}
  </div>

  <a
    href="/roster/voices"
    class="inline-block mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim border-b border-rule pb-0.5 hover:text-ink"
    data-roster-voices-link
  >
    Hear all ten on the same fixture →
  </a>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="ROSTER" title="The Staff">
    <div class="px-8 py-6 max-w-6xl">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-roster-page>
  <MobileHeader title="The Roster" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
