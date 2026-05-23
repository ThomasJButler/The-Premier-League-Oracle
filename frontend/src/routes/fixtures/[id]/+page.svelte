<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import MatchHero from '$lib/components/match/MatchHero.svelte';
  import { matchToFixture } from '$lib/adapters/v3';
  import { dataService } from '../../../services/dataService';
  import type { Match } from '../../../types';
  import type { Fixture } from '../../../types/redesign';

  interface PageData {
    id: string;
  }

  const { data }: { data: PageData } = $props();

  let fixture = $state<Fixture | null>(null);
  let loaded = $state(false);

  const heroKind = $derived<'preview' | 'live'>(
    fixture && fixture.status === 'LIVE' ? 'live' : 'preview'
  );

  const titleLine = $derived(
    fixture ? `${fixture.home.name} v ${fixture.away.name}` : 'Match'
  );

  onMount(async () => {
    try {
      const matches: Match[] = await dataService.getCurrentSeasonMatches();
      const found = matches.find((m) => String(m.id) === String(data.id));
      fixture = found ? matchToFixture(found) : null;
    } catch {
      fixture = null;
    } finally {
      loaded = true;
    }
  });
</script>

{#snippet body()}
  {#if fixture}
    <MatchHero {fixture} kind={heroKind} />
    <div class="mt-8" data-match-detail-stub>
      <Rule kicker="MATCH DETAIL" title="More to follow" />
      <p class="font-serif italic text-ink-dim text-[14px] mt-3" data-match-detail-stub-copy>
        Ensemble bars, scoreline grid, head-to-head and venue notes land in the next slice.
      </p>
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
