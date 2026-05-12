<script lang="ts">
  import type { PersonaConfig } from '$lib/personas';

  interface PromptChip {
    label: string;
    icon: string;
  }

  interface Props {
    persona: PersonaConfig;
    prompts?: readonly PromptChip[];
    placeholder?: string;
    onsubmit?: (text: string) => void;
    onchip?: (label: string) => void;
  }

  // No betting copy — "Where's the value?" deliberately omitted per the betting-removal rule.
  const DEFAULT_PROMPTS: readonly PromptChip[] = [
    { label: 'Talk me through Saturday', icon: '📰' },
    { label: 'Anything daft to know?', icon: '🤔' },
    { label: 'Hot take, please', icon: '🔥' },
    { label: "Defend Liverpool's xG", icon: '🛡️' }
  ] as const;

  const {
    persona,
    prompts = DEFAULT_PROMPTS,
    placeholder = "Right then. Tell me about Saturday's fixtures…",
    onsubmit,
    onchip
  }: Props = $props();

  let draft = $state('');
  const canSubmit = $derived(draft.trim().length > 0);
  const personaLabel = $derived(persona.short.toUpperCase());

  function handleSubmit(): void {
    if (!canSubmit) return;
    const text = draft.trim();
    draft = '';
    onsubmit?.(text);
  }

  function handleChip(label: string): void {
    draft = label;
    onchip?.(label);
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<form
  class="kicker-composer border-t-2 border-ink bg-paper-warm"
  data-composer
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div
    class="kicker-composer__chips px-5 py-3 flex items-center gap-2 flex-wrap border-b border-rule"
    data-composer-chips
  >
    <span class="font-sans text-[9px] tracking-[0.25em] font-bold text-red mr-1">
      ASK {personaLabel}
    </span>
    {#each prompts as chip (chip.label)}
      <button
        type="button"
        class="kicker-composer__chip font-serif italic text-[11px] px-2.5 py-1 rounded-sm flex items-center gap-1.5 bg-paper border border-rule text-ink"
        data-prompt-chip
        onclick={() => handleChip(chip.label)}
      >
        <span aria-hidden="true">{chip.icon}</span>
        <span>{chip.label}</span>
      </button>
    {/each}
  </div>

  <div class="kicker-composer__input-row px-5 py-3 flex items-center gap-3">
    <span
      class="kicker-composer__persona-pill flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded-sm bg-ink text-paper"
      data-composer-persona
    >
      <span class="kicker-composer__dot" aria-hidden="true" data-composer-accent></span>
      <span class="font-sans text-[9px] tracking-widest font-bold">{personaLabel}</span>
    </span>
    <label class="kicker-composer__field flex-1 flex items-center gap-2 px-3 py-2 rounded-sm bg-paper border border-ink">
      <span class="font-mono font-bold text-[13px] text-red" aria-hidden="true">&gt;</span>
      <input
        type="text"
        class="kicker-composer__input flex-1 bg-transparent outline-none font-serif text-[13px] text-ink"
        {placeholder}
        bind:value={draft}
        onkeydown={handleKey}
        data-composer-input
        aria-label="Ask {persona.name}"
      />
      <span class="font-mono text-[10px] text-ink-faint" aria-hidden="true">⌘↵</span>
    </label>
    <button
      type="submit"
      class="kicker-composer__send flex-shrink-0 px-4 py-2 rounded-sm font-bold text-[12px] tracking-widest bg-ink text-paper border-2 border-ink disabled:opacity-40 disabled:cursor-not-allowed"
      data-composer-send
      disabled={!canSubmit}
    >
      SEND →
    </button>
  </div>
</form>

<style>
  .kicker-composer__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--persona-accent, var(--paper));
  }
  .kicker-composer__chip:hover {
    background: var(--paper-warm);
  }
</style>
