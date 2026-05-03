<script lang="ts">
  import type { PersonaConfig } from '$lib/personas';

  interface Props {
    persona: PersonaConfig;
    selected?: boolean;
    onclick?: (id: PersonaConfig['id']) => void;
  }

  const { persona, selected = false, onclick }: Props = $props();

  const monogram = $derived(
    persona.short.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || persona.id.slice(0, 2).toUpperCase()
  );
</script>

<button
  type="button"
  class="kicker-pundit-card relative flex flex-col justify-between gap-4 px-5 py-5 text-left bg-paper border border-rule transition-colors hover:bg-paper-warm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
  class:is-selected={selected}
  data-pundit-id={persona.id}
  data-pundit-selected={selected ? 'true' : 'false'}
  onclick={() => onclick?.(persona.id)}
  aria-pressed={selected}
>
  {#if selected}
    <span
      class="absolute top-3 right-3 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.25em] font-extrabold bg-ink text-paper"
      style="background: var(--persona-accent, var(--ink)); color: var(--paper);"
      data-pundit-selected-badge
    >
      SELECTED
    </span>
  {/if}

  <div class="flex items-center gap-3">
    <span
      class="kicker-pundit-mono w-12 h-12 inline-flex items-center justify-center font-serif font-extrabold text-[22px] flex-shrink-0"
      data-pundit-mono
    >
      {monogram}
    </span>
    <div>
      <div
        class="font-sans text-[8px] tracking-[0.25em] font-bold text-red"
        data-pundit-id-tag
      >
        {persona.id.toUpperCase()}
      </div>
      <div class="font-serif text-[18px] font-bold leading-none text-ink" data-pundit-name>
        {persona.name}
      </div>
    </div>
  </div>

  <div>
    <p
      class="kicker-pundit-tic relative pl-2.5 mb-3 font-serif italic text-[11px] leading-[1.35] text-ink"
      data-pundit-tic
    >
      {persona.tic}
    </p>
    <p
      class="font-sans text-[9px] tracking-widest font-bold uppercase text-ink-dim"
      data-pundit-region
    >
      {persona.region}
    </p>
  </div>
</button>

<style>
  .kicker-pundit-card {
    border-color: var(--rule);
  }
  .kicker-pundit-card.is-selected {
    border-color: var(--persona-accent, var(--ink));
    outline: 2px solid var(--persona-accent, var(--ink));
    outline-offset: -2px;
    background: var(--paper-warm);
  }
  .kicker-pundit-mono {
    background: var(--paper-inset);
    color: var(--ink-dim);
    clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
  }
  .kicker-pundit-card.is-selected .kicker-pundit-mono {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
  }
  .kicker-pundit-tic {
    border-left: 2px solid var(--rule);
  }
  .kicker-pundit-card.is-selected .kicker-pundit-tic {
    border-left-color: var(--persona-accent, var(--ink));
  }
</style>
