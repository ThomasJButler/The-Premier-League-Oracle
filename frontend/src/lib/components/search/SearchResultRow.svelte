<script lang="ts">
  import type { SearchItem, SearchItemKind } from '$lib/search/buildIndex';

  interface Props {
    item: SearchItem;
  }

  const { item }: Props = $props();

  const KIND_LABEL: Record<SearchItemKind, string> = {
    fixture: 'FIXTURE',
    player: 'PLAYER',
    season: 'SEASON',
    thread: 'THREAD',
  };
</script>

{#if item.href}
  <a
    href={item.href}
    class="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-3 border-b border-rule hover:bg-paper-inset"
    data-search-result
    data-search-result-kind={item.kind}
    data-search-result-id={item.id}
  >
    <span
      class="font-mono text-[10px] tracking-[0.2em] uppercase pt-1"
      style="color: var(--persona-accent, var(--red));"
      data-search-result-kind-label
    >
      {KIND_LABEL[item.kind]}
    </span>
    <span class="min-w-0">
      <span class="block font-serif text-[18px] text-ink truncate" data-search-result-label>
        {item.label}
      </span>
      {#if item.sub}
        <span class="block font-serif italic text-[13px] text-ink-dim mt-0.5" data-search-result-sub>
          {item.sub}
        </span>
      {/if}
    </span>
  </a>
{:else}
  <div
    class="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-3 border-b border-rule"
    data-search-result
    data-search-result-kind={item.kind}
    data-search-result-id={item.id}
  >
    <span
      class="font-mono text-[10px] tracking-[0.2em] uppercase pt-1"
      style="color: var(--persona-accent, var(--red));"
      data-search-result-kind-label
    >
      {KIND_LABEL[item.kind]}
    </span>
    <span class="min-w-0">
      <span class="block font-serif text-[18px] text-ink truncate" data-search-result-label>
        {item.label}
      </span>
      {#if item.sub}
        <span class="block font-serif italic text-[13px] text-ink-dim mt-0.5" data-search-result-sub>
          {item.sub}
        </span>
      {/if}
    </span>
  </div>
{/if}
