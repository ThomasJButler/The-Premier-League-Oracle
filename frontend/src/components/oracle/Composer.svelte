<script lang="ts" context="module">
  export const QUICK_PROMPTS: readonly string[] = [
    'Why does the model favour X?',
    'Show value bets for Saturday',
    'Explain the Brier score',
  ];
  export const MAX_LENGTH = 500;
</script>

<script lang="ts">
  export let value: string;
  export let disabled: boolean = false;
  export let onSubmit: (text: string) => void;
  export let onPickPrompt: (text: string) => void;
  export let placeholder: string = 'Ask the Oracle…';

  $: canSend = !disabled && value.trim().length > 0;

  // Svelte 4 types on:keydown as CustomEvent rather than KeyboardEvent — match the
  // existing codebase convention (see MobileNav.svelte / dialog-content.svelte).
  function handleKeydown(e: any): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!canSend) return;
      e.preventDefault();
      onSubmit(value);
    }
  }

  function handleSubmit(): void {
    if (!canSend) return;
    onSubmit(value);
  }
</script>

<div data-composer class="flex flex-col gap-3 p-3 border-t border-border/40 bg-bg-raised">
  <div class="flex flex-wrap gap-2" role="group" aria-label="Suggested prompts">
    {#each QUICK_PROMPTS as prompt (prompt)}
      <button
        type="button"
        data-quick-prompt
        class="px-3 py-1.5 rounded-full text-body-sm border border-border text-text-dim hover:bg-surface-hover transition-colors disabled:opacity-50"
        {disabled}
        on:click={() => onPickPrompt(prompt)}
      >
        {prompt}
      </button>
    {/each}
  </div>

  <div class="flex items-end gap-2">
    <label for="oracle-composer-textarea" class="sr-only">Message</label>
    <textarea
      id="oracle-composer-textarea"
      data-textarea
      bind:value
      {placeholder}
      {disabled}
      maxlength={MAX_LENGTH}
      rows="2"
      class="flex-1 resize-none px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-body-sm placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      on:keydown={handleKeydown}
    ></textarea>
    <button
      type="button"
      data-submit
      disabled={!canSend}
      class="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      on:click={handleSubmit}
    >
      Send
    </button>
  </div>
</div>
