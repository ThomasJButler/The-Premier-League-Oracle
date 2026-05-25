<script lang="ts">
  import type { PersonaConfig } from '$lib/personas';

  interface Props {
    persona: PersonaConfig;
    selected?: boolean;
    locked?: boolean;
    onclick?: (id: PersonaConfig['id']) => void;
    onLockedClick?: (id: PersonaConfig['id']) => void;
  }

  const {
    persona,
    selected = false,
    locked = false,
    onclick,
    onLockedClick
  }: Props = $props();

  function handleClick(): void {
    if (locked) {
      onLockedClick?.(persona.id);
      return;
    }
    onclick?.(persona.id);
  }

  const monogram = $derived(
    persona.short.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() ||
      persona.id.slice(0, 2).toUpperCase()
  );
</script>

<button
  type="button"
  class="kicker-picker-card relative flex items-center gap-4 px-4 py-4 text-left bg-paper border border-rule transition-colors hover:bg-paper-warm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
  class:is-selected={selected}
  class:is-locked={locked}
  data-picker-id={persona.id}
  data-picker-selected={selected ? 'true' : 'false'}
  data-picker-locked={locked ? 'true' : 'false'}
  aria-pressed={selected}
  aria-disabled={locked ? 'true' : undefined}
  onclick={handleClick}
>
  <span
    class="kicker-picker-shield w-12 h-14 inline-flex items-center justify-center font-serif font-extrabold text-[20px] flex-shrink-0"
    data-picker-shield
    aria-hidden="true"
  >
    {monogram}
  </span>

  <div class="min-w-0 flex-1">
    <p
      class="font-sans text-[8px] tracking-[0.25em] font-bold text-red"
      data-picker-id-tag
    >
      {persona.id.toUpperCase()}
    </p>
    <p class="font-serif text-[16px] font-bold leading-tight text-ink truncate" data-picker-name>
      {persona.name}
    </p>
    <p
      class="mt-0.5 font-serif italic text-[11px] leading-snug text-ink-soft truncate"
      data-picker-tagline
    >
      {persona.voice}
    </p>
  </div>

  {#if selected && !locked}
    <span
      class="kicker-picker-check w-6 h-6 inline-flex items-center justify-center font-mono text-[14px] font-bold flex-shrink-0"
      data-picker-check
      aria-hidden="true"
    >
      ✓
    </span>
  {/if}

  {#if locked}
    <span
      class="kicker-picker-lock inline-flex items-center justify-center font-sans text-[9px] tracking-[0.25em] font-bold uppercase px-2 py-1 flex-shrink-0"
      data-picker-lock
      aria-label="Locked — upgrade required"
    >
      LOCKED
    </span>
  {/if}
</button>

<style>
  .kicker-picker-card {
    border-color: var(--rule);
  }
  .kicker-picker-card.is-selected {
    border-color: var(--persona-accent, var(--ink));
    outline: 2px solid var(--persona-accent, var(--ink));
    outline-offset: -2px;
    background: var(--paper-warm);
  }
  .kicker-picker-shield {
    background: var(--paper-inset);
    color: var(--ink-dim);
    clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
  }
  .kicker-picker-card.is-selected .kicker-picker-shield {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
  }
  .kicker-picker-check {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
  }
  .kicker-picker-card.is-locked {
    opacity: 0.62;
    cursor: not-allowed;
  }
  .kicker-picker-card.is-locked:hover {
    background: var(--paper);
  }
  .kicker-picker-lock {
    background: var(--rule-strong);
    color: var(--paper);
  }
</style>
