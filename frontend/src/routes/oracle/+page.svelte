<script lang="ts">
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import GeoffMessage from '$lib/components/chat/GeoffMessage.svelte';
  import UserMessage from '$lib/components/chat/UserMessage.svelte';
  import GeoffComposer from '$lib/components/chat/GeoffComposer.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';

  const persona = $derived(getPersona($personaStore as PersonaId));

  interface SeedTurn {
    role: 'user' | 'geoff';
    body: string;
    sublabel?: string;
    marginalia?: string;
  }

  // Seed conversation is presentational only — K1a-β wires real /api/chat streaming.
  const SEED: readonly SeedTurn[] = [
    { role: 'user', body: 'Talk me through Saturday.' },
    {
      role: 'geoff',
      body: "Right then. Liverpool at home to Tottenham — five-game streak at Anfield, haven't conceded since February. Spurs? Three losses on the road in their last six. Looks like a stroll on paper. Football, of course, has read the script and torn it up before now.",
      sublabel: 'GW35',
      marginalia: 'Geoff has been right 64% of the time this season. Make of that what you will.'
    }
  ] as const;
</script>

{#snippet body()}
  <div class="kicker-oracle flex flex-col min-h-[60vh]" data-oracle-page>
    <div class="kicker-oracle__rule mb-4">
      <Rule
        kicker="THE ORACLE · LIVE CONVERSATION"
        title="In conversation with {persona.name}"
        action="STREAMING SOON"
      />
    </div>

    <div class="kicker-oracle__thread flex-1 px-1" data-oracle-thread aria-live="polite">
      {#each SEED as turn, i (i)}
        {#if turn.role === 'user'}
          <UserMessage body={turn.body} />
        {:else}
          <GeoffMessage
            body={turn.body}
            {persona}
            sublabel={turn.sublabel}
            marginalia={turn.marginalia}
          />
        {/if}
      {/each}
    </div>

    <div class="kicker-oracle__composer mt-4" data-oracle-composer-host>
      <GeoffComposer {persona} />
    </div>
  </div>
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="oracle" kicker="ASK · LISTEN · LEARN" title="ORACLE">
    {@render body()}
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-oracle-mobile>
  <MobileHeader title="Oracle" sub={persona.short.toUpperCase()}>
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="oracle" />
  </div>
</div>
