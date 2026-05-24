<script lang="ts">
  import { onMount } from 'svelte';
  import KickerShell from '$lib/components/shell/KickerShell.svelte';
  import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
  import MobileNav from '$lib/components/shell/MobileNav.svelte';
  import MobilePersonaPill from '$lib/components/persona/MobilePersonaPill.svelte';
  import Rule from '$lib/components/atoms/Rule.svelte';
  import SearchInput from '$lib/components/search/SearchInput.svelte';
  import RecentChips from '$lib/components/search/RecentChips.svelte';
  import SearchResultRow from '$lib/components/search/SearchResultRow.svelte';
  import {
    readRecent,
    addRecent,
    removeRecent,
    clearRecent
  } from '$lib/stores/recentSearches';
  import { loadSearchSources } from '$lib/search/loadSearchSources';
  import { searchIndex, type SearchItem, type SearchResult } from '$lib/search/buildIndex';

  // Module-level cache: built once per session on first non-empty submit, reused
  // across persona switches and chip picks so we don't burn the API key for every
  // keystroke. Cleared only when the tab is reloaded.
  let cachedIndex: SearchItem[] | null = null;
  let pendingBuild: Promise<SearchItem[]> | null = null;

  let query = $state('');
  let lastQuery = $state<string | null>(null);
  let results = $state<SearchResult[] | null>(null);
  let recent = $state<string[]>([]);
  let hydrated = $state(false);
  let searching = $state(false);

  onMount(() => {
    recent = readRecent();
    hydrated = true;
  });

  async function ensureIndex(): Promise<SearchItem[]> {
    if (cachedIndex) return cachedIndex;
    if (!pendingBuild) pendingBuild = loadSearchSources();
    cachedIndex = await pendingBuild;
    return cachedIndex;
  }

  async function runSearch(q: string): Promise<void> {
    const trimmed = q.trim();
    if (!trimmed) return;
    query = trimmed;
    lastQuery = trimmed;
    recent = addRecent(trimmed);
    searching = true;
    try {
      const index = await ensureIndex();
      results = searchIndex(index, trimmed);
    } finally {
      searching = false;
    }
  }

  function handlePick(q: string): void {
    query = q;
    void runSearch(q);
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
    results = null;
  }
</script>

{#snippet body()}
  <Rule kicker="SEARCH" title="The morgue" action="K1f · β.2" />

  <SearchInput
    bind:value={query}
    onsubmit={(q) => void runSearch(q)}
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
      <div class="mt-8 border-t border-rule pt-6" data-search-results>
        <p class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim mb-3">
          {searching ? 'Searching…' : `Results for “${lastQuery}”`}
        </p>
        {#if searching}
          <p class="font-serif italic text-[13px] text-ink-dim py-4" data-search-results-pending>
            Combing the morgue…
          </p>
        {:else if results && results.length > 0}
          <ul data-search-results-list>
            {#each results as r (r.item.id)}
              <li>
                <SearchResultRow item={r.item} />
              </li>
            {/each}
          </ul>
        {:else}
          <p class="font-serif italic text-[14px] text-ink-dim py-4" data-search-results-none>
            No filings on “{lastQuery}”. Try a team abbreviation, a season (e.g. <span class="font-mono text-[12px]">2003/04</span>), or a player surname.
          </p>
        {/if}
      </div>
    {:else}
      <div class="mt-8 py-6 border-t border-rule" data-search-empty>
        <p class="font-serif italic text-[15px] text-ink-dim">
          Type a query and press <span class="font-mono text-[12px]">Enter</span> to search across
          fixtures, top scorers, the 33-season archive, and your Oracle threads.
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
