<script lang="ts">
  import type { ChatMessage } from '../../lib/oracle/threads';
  import { renderMarkdown } from '../../lib/renderMarkdown';

  export let messages: ChatMessage[];
  export let streamingContent: string = '';
  export let isStreaming: boolean = false;

  function bubbleClass(role: ChatMessage['role']): string {
    if (role === 'user') return 'bg-primary text-primary-foreground rounded-br-sm';
    if (role === 'system') return 'bg-muted/50 text-text-dim italic border border-border/30 rounded-bl-sm';
    return 'bg-muted text-foreground rounded-bl-sm';
  }
</script>

<div
  data-message-list
  class="flex-1 overflow-y-auto px-4 py-4 space-y-4"
  aria-live="polite"
  aria-label="Chat messages"
>
  {#if messages.length === 0 && !isStreaming}
    <div data-message-list-empty class="flex flex-col items-center justify-center text-center py-12 gap-2 text-text-dim">
      <p class="text-body font-medium text-foreground">Ask the Oracle</p>
      <p class="text-body-sm">Predictions, form, value bets — pick a prompt below or type your own.</p>
    </div>
  {/if}

  {#each messages as message, i (i)}
    <div
      data-message
      data-role={message.role}
      class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
    >
      <div class="max-w-[85%] rounded-xl px-3 sm:px-4 py-2.5 text-body-sm break-words {bubbleClass(message.role)}">
        {#if message.role === 'user'}
          <p style="white-space: pre-wrap;">{message.content}</p>
        {:else}
          <div class="prose-chat">{@html renderMarkdown(message.content)}</div>
        {/if}
      </div>
    </div>
  {/each}

  {#if isStreaming}
    <div data-streaming class="flex justify-start">
      <div class="max-w-[85%] rounded-xl rounded-bl-sm px-3 sm:px-4 py-2.5 text-body-sm break-words bg-muted text-foreground">
        {#if streamingContent.length > 0}
          <div class="prose-chat">{@html renderMarkdown(streamingContent)}</div>
        {:else}
          <span class="text-text-dim">Thinking…</span>
        {/if}
      </div>
    </div>
  {/if}
</div>
