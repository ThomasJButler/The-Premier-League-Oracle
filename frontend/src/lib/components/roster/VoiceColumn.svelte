<script lang="ts">
  import type { PersonaConfig } from '$lib/personas';
  import type { VoiceTake } from '$lib/fixtures/voiceTakes';

  interface Props {
    persona: PersonaConfig;
    take: VoiceTake;
    selected?: boolean;
    onclick?: (id: PersonaConfig['id']) => void;
  }

  const { persona, take, selected = false, onclick }: Props = $props();

  const monogram = $derived(
    persona.short.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() ||
      persona.id.slice(0, 2).toUpperCase()
  );
</script>

<button
  type="button"
  class="kicker-voice-column relative flex flex-col gap-3 px-5 py-5 text-left bg-paper border border-rule transition-colors hover:bg-paper-warm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
  class:is-selected={selected}
  data-voice-column
  data-voice-id={persona.id}
  data-voice-selected={selected ? 'true' : 'false'}
  aria-pressed={selected}
  onclick={() => onclick?.(persona.id)}
>
  <header class="flex items-center gap-3">
    <span
      class="kicker-voice-mono w-10 h-10 inline-flex items-center justify-center font-serif font-extrabold text-[18px] flex-shrink-0"
      data-voice-mono
      aria-hidden="true"
    >
      {monogram}
    </span>
    <div class="min-w-0">
      <p
        class="font-sans text-[8px] tracking-[0.25em] font-bold text-red"
        data-voice-id-tag
      >
        {persona.id.toUpperCase()}
      </p>
      <p class="font-serif text-[16px] font-bold leading-tight text-ink truncate" data-voice-name>
        {persona.name}
      </p>
    </div>
  </header>

  <p
    class="font-serif text-[13px] leading-[1.5] text-ink"
    data-voice-open
  >
    {take.open}
  </p>

  <p
    class="kicker-voice-aside relative pl-2.5 font-serif italic text-[11px] leading-[1.4] text-ink-dim"
    data-voice-aside
  >
    {take.aside}
  </p>

  <footer class="mt-auto flex items-baseline justify-between border-t border-rule pt-2">
    <span
      class="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft"
      data-voice-pick
    >
      Pick · {take.pick}
    </span>
    <span
      class="font-mono text-[11px] font-bold text-ink"
      data-voice-conf
    >
      {take.conf}%
    </span>
  </footer>
</button>

<style>
  .kicker-voice-column {
    border-color: var(--rule);
  }
  .kicker-voice-column.is-selected {
    border-color: var(--persona-accent, var(--ink));
    outline: 2px solid var(--persona-accent, var(--ink));
    outline-offset: -2px;
    background: var(--paper-warm);
  }
  .kicker-voice-mono {
    background: var(--paper-inset);
    color: var(--ink-dim);
    clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
  }
  .kicker-voice-column.is-selected .kicker-voice-mono {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
  }
  .kicker-voice-aside {
    border-left: 2px solid var(--rule);
  }
  .kicker-voice-column.is-selected .kicker-voice-aside {
    border-left-color: var(--persona-accent, var(--ink));
  }
</style>
