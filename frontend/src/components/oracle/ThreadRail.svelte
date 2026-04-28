<script lang="ts">
  import type { OracleThread } from '../../lib/oracle/threads';

  export let threads: OracleThread[];
  export let activeThreadId: string | null;
  export let onSelect: (id: string) => void;
  export let onNewThread: () => void;

  const PREVIEW_MAX = 60;

  function previewOf(thread: OracleThread): string {
    const last = thread.messages
      .slice()
      .reverse()
      .find((m) => m.role === 'assistant' || m.role === 'user');
    if (!last) return '';
    const content = last.content.replace(/\s+/g, ' ').trim();
    return content.length > PREVIEW_MAX ? content.slice(0, PREVIEW_MAX).trimEnd() + '…' : content;
  }

  function relativeTime(ts: number, now: number = Date.now()): string {
    const diff = Math.max(0, now - ts);
    const min = 60_000;
    const hr = 60 * min;
    const day = 24 * hr;
    if (diff < min) return 'now';
    if (diff < hr) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hr)}h ago`;
    if (diff < 2 * day) return 'Yesterday';
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
</script>

<aside
  data-thread-rail
  class="flex flex-col h-full bg-bg-raised border-r border-border/40"
  aria-label="Saved chat threads"
>
  <div class="px-3 py-3 border-b border-border/40">
    <button
      type="button"
      data-new-thread
      class="w-full px-3 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      on:click={onNewThread}
    >
      + New thread
    </button>
  </div>

  <ul class="flex-1 overflow-y-auto py-1" role="list">
    {#each threads as t (t.id)}
      {@const isActive = t.id === activeThreadId}
      <li>
        <button
          type="button"
          data-thread
          data-active={isActive ? 'true' : 'false'}
          class="w-full text-left px-3 py-2 flex flex-col gap-0.5 border-l-2 transition-colors hover:bg-surface-hover {isActive
            ? 'bg-card-raised border-primary'
            : 'border-transparent'}"
          on:click={() => onSelect(t.id)}
        >
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-body-sm font-medium text-foreground truncate">{t.title}</span>
            <span class="text-body-sm font-mono text-text-faint shrink-0">{relativeTime(t.updatedAt)}</span>
          </span>
          {#if previewOf(t)}
            <span class="text-body-sm text-text-dim truncate">{previewOf(t)}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</aside>
