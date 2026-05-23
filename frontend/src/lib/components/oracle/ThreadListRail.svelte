<script lang="ts">
  import { threadsStore, type OracleThread } from '$lib/stores/threads';

  const threads = $derived(
    [...$threadsStore.threads].sort((a, b) => b.updatedAt - a.updatedAt)
  );
  const activeId = $derived($threadsStore.activeThreadId);

  function lastPreview(t: OracleThread): string {
    const last = t.messages[t.messages.length - 1];
    if (!last) return '—';
    const text = last.content.trim().replace(/\s+/g, ' ');
    if (text.length === 0) return '—';
    return text.length > 60 ? text.slice(0, 60) + '…' : text;
  }

  function handleNew(): void {
    threadsStore.createThread();
  }

  function handleSelect(id: string): void {
    threadsStore.setActive(id);
  }

  function handleDelete(id: string): void {
    threadsStore.deleteThread(id);
  }
</script>

<section class="kicker-thread-rail" data-thread-rail>
  <div class="flex items-center justify-between border-b border-ink pb-2 mb-3">
    <h3 class="font-sans text-[10px] tracking-[0.3em] uppercase font-bold text-red">
      Threads
    </h3>
    <button
      type="button"
      class="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-ink hover:text-red"
      data-thread-rail-new
      onclick={handleNew}
    >
      + New
    </button>
  </div>

  {#if threads.length === 0}
    <p class="font-serif italic text-[12px] text-ink-dim" data-thread-rail-empty>
      No threads yet — start one with the composer below.
    </p>
  {:else}
    <ul class="flex flex-col gap-1">
      {#each threads as t (t.id)}
        {@const isActive = t.id === activeId}
        <li
          class="kicker-thread-rail__item flex items-start justify-between gap-2 border-l-2 transition-colors"
          class:active-item={isActive}
          data-thread-rail-item
          data-thread-id={t.id}
          aria-current={isActive ? 'true' : undefined}
        >
          <button
            type="button"
            class="flex-1 text-left py-2 pl-2 pr-1 min-w-0"
            onclick={() => handleSelect(t.id)}
          >
            <p
              class="font-serif text-[13px] leading-tight font-bold text-ink truncate"
              data-thread-rail-title
            >
              {t.title}
            </p>
            <p
              class="mt-1 font-serif italic text-[11px] text-ink-soft line-clamp-2"
              data-thread-rail-preview
            >
              {lastPreview(t)}
            </p>
          </button>
          <button
            type="button"
            class="py-2 pr-2 font-mono text-[14px] leading-none text-ink-dim hover:text-red shrink-0"
            data-thread-rail-delete
            aria-label="Delete thread"
            onclick={() => handleDelete(t.id)}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .kicker-thread-rail__item {
    border-color: transparent;
  }
  .kicker-thread-rail__item:hover {
    background: rgba(0, 0, 0, 0.03);
  }
  .kicker-thread-rail__item.active-item {
    border-color: var(--persona-accent);
    background: rgba(0, 0, 0, 0.04);
  }
</style>
