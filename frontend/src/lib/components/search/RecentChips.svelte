<script lang="ts">
  interface Props {
    queries: string[];
    onpick?: (query: string) => void;
    onremove?: (query: string) => void;
    onclear?: () => void;
  }

  const { queries, onpick, onremove, onclear }: Props = $props();
</script>

{#if queries.length > 0}
  <div class="mt-6" data-recent-chips>
    <div class="flex items-center justify-between mb-2">
      <span
        class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-dim"
        data-recent-chips-label
      >
        Recent searches
      </span>
      <button
        type="button"
        class="font-mono text-[10px] tracking-[0.2em] uppercase text-red hover:text-ink"
        data-recent-chips-clear
        onclick={() => onclear?.()}
      >
        Clear
      </button>
    </div>
    <ul class="flex flex-wrap gap-2" data-recent-chips-list>
      {#each queries as q (q)}
        <li class="inline-flex items-stretch border border-rule rounded-full overflow-hidden">
          <button
            type="button"
            class="font-serif text-[13px] text-ink px-3 py-1 hover:bg-paper-inset"
            data-recent-chip={q}
            onclick={() => onpick?.(q)}
          >
            {q}
          </button>
          <button
            type="button"
            aria-label={`Remove ${q} from recent searches`}
            class="font-mono text-[11px] text-ink-dim hover:text-red px-2 border-l border-rule"
            data-recent-chip-remove={q}
            onclick={() => onremove?.(q)}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
