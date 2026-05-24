<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import SearchInput from '$lib/components/search/SearchInput.svelte';
  import RecentChips from '$lib/components/search/RecentChips.svelte';
  import {
    readRecent,
    addRecent,
    removeRecent,
    clearRecent
  } from '$lib/stores/recentSearches';

  let query = $state('');
  let lastQuery = $state<string | null>(null);
  let recent = $state<string[]>([]);
  let hydrated = $state(false);

  onMount(() => {
    recent = readRecent();
    hydrated = true;
  });

  function runSearch(q: string): void {
    const trimmed = q.trim();
    if (!trimmed) return;
    query = trimmed;
    lastQuery = trimmed;
    recent = addRecent(trimmed);
  }

  function handlePick(q: string): void {
    query = q;
    runSearch(q);
  }

  function handleRemove(q: string): void {
    recent = removeRecent(q);
  }

  function handleClearAll(): void {
    clearRecent();
    recent = [];
  }

  function handleClearInput(): void {
    lastQuery = null;
  }
</script>

{#snippet body()}
  <Rule kicker="SEARCH" title="The morgue" action="K1f · β.1" />

  <SearchInput
    bind:value={query}
    onsubmit={runSearch}
    onclear={handleClearInput}
  />

  {#if !hydrated}
    <p class="font-serif italic text-ink-dim text-[14px] py-6" data-search-loading>
      Warming the index…
    </p>
  {:else}
    <RecentChips
      queries={recent}
      onpick={handlePick}
      onremove={handleRemove}
      onclear={handleClearAll}
    />

    {#if lastQuery}
      <div class="mt-8 border-t border-rule pt-6" data-search-results-stub>
        <p class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim mb-2">
          Searched for
        </p>
        <p class="font-serif text-[22px] text-ink mb-3">
          “{lastQuery}”
        </p>
        <p class="font-serif italic text-[13px] text-ink-dim">
          The full-text index lands in K1f-β.2. Your search has been saved to the recent
          chips above so the recall path works end-to-end already.
        </p>
      </div>
    {:else}
      <div class="mt-8 py-6 border-t border-rule" data-search-empty>
        <p class="font-serif italic text-[15px] text-ink-dim">
          Type a query and press <span class="font-mono text-[12px]">Enter</span> to log it. Results
          across fixtures, players, seasons, and threads arrive in K1f-β.2.
        </p>
      </div>
    {/if}
  {/if}
{/snippet}

<div class="hidden lg:block" data-desktop-shell>
  <KickerShell kicker="SEARCH" title="The morgue">
    <div class="px-8 py-6 max-w-3xl">
      {@render body()}
    </div>
  </KickerShell>
</div>

<div class="lg:hidden flex flex-col min-h-screen" data-mobile-shell data-search-page>
  <MobileHeader title="Search" sub="THE KICKER">
    {#snippet action()}<MobilePersonaPill />{/snippet}
  </MobileHeader>
  <main class="flex-1 px-4 py-4 pb-24 overflow-y-auto" data-mobile-body>
    {@render body()}
  </main>
  <div class="fixed bottom-0 inset-x-0 z-10">
    <MobileNav active="more" />
  </div>
</div>
