<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import LiveScoreboard from '$lib/components/match/LiveScoreboard.svelte';
  import MatchEventRow from '$lib/components/match/MatchEventRow.svelte';
  import LiveCommentaryItem from '$lib/components/match/LiveCommentaryItem.svelte';
  import { matchToFixture } from '$lib/adapters/v3';
  import { getLiveFeed, type LiveFeed } from '$lib/fixtures/liveFeed';
  import { dataService } from '../../../../services/dataService';
  import type { Match } from '../../../../types';
  import type { Fixture } from '../../../../types/redesign';

  interface PageData {
    id: string;
  }

  const { data }: { data: PageData } = $props();

  let fixture = $state<Fixture | null>(null);
  let feed = $state<LiveFeed | null>(null);
  let loaded = $state(false);

  const titleLine = $derived(
    fixture ? `${fixture.home.name} v ${fixture.away.name}` : 'Live'
  );

  function asLiveFixture(f: Fixture): Fixture {
    return {
      ...f,
      status: 'LIVE',
      minute: f.minute ?? 67,
      score: f.score ?? { home: 2, away: 1 },
    };
  }

  onMount(async () => {
    try {
      const matches: Match[] = await dataService.getCurrentSeasonMatches();
      const found = matches.find((m) => String(m.id) === String(data.id));
      if (!found) {
        fixture = null;
        return;
      }
      const base = matchToFixture(found, matches);
      fixture = asLiveFixture(base);
      feed = getLiveFeed(String(found.id), fixture.home.abbr, fixture.away.abbr);
    } catch {
      fixture = null;
    } finally {
      loaded = true;
    }
  });
</script>

{#snippet body()}
  {#if fixture && feed}
    <LiveScoreboard {fixture} />

    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_minmax(0,360px)]" data-live-layout>
      <section data-live-events>
        <Rule kicker="LIVE" title="Match events" />
        {#if feed.events.length > 0}
          <ol class="mt-3 flex flex-col" data-event-list>
            {#each feed.events as event (event.id)}
              <MatchEventRow {event} />
            {/each}
          </ol>
        {:else}
          <p class="font-serif italic text-ink-dim text-[14px] mt-3" data-events-empty>
            No notable events yet.
          </p>
        {/if}
      </section>

      <section data-live-commentary>
        <Rule kicker="COMMENTARY" title="On the wire" />
        {#if feed.commentary.length > 0}
          <div class="mt-3 flex flex-col" data-commentary-list>
            {#each feed.commentary as line (line.id)}
              <LiveCommentaryItem {line} />
            {/each}
          </div>
        {:else}
          <p class="font-serif italic text-ink-dim text-[14px] mt-3" data-commentary-empty>
            The press box has gone quiet.
          </p>
        {/if}
      </section>
    </div>
  {:else if loaded}
    <div data-live-missing>
      <Rule kicker="404" title="Fixture not on the slate" />
      <p class="font-serif italic text-ink-dim text-[14px] mt-3">
        We couldn't find a live match for that id. <a class="underline" href="/fixtures">Back to fixtures</a>.
      </p>
    </div>
  {:else}
    <div
      class="font-serif italic text-ink-dim text-[14px] py-8 text-center"
      data-live-loading
    >
      Patching into the feed…
    </div>
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell active="fixtures" kicker="LIVE" title={titleLine}>
    <div class="px-8 py-6">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-live-page>
  <MobileHeader title={titleLine} sub="LIVE">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="fixtures" />
  </div>
</div>
