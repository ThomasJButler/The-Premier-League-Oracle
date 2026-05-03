<script lang="ts">
  import { getPersona, type PersonaId } from '$lib/personas';
  import { getVoiceTake } from '$lib/fixtures/voiceTakes';
  import Rule from '$lib/components/atoms/Rule.svelte';

  interface Props {
    chosen: PersonaId;
    onback?: () => void;
    onconfirm?: (id: PersonaId) => void;
  }

  const { chosen, onback, onconfirm }: Props = $props();

  const persona = $derived(getPersona(chosen));
  const take = $derived(getVoiceTake(chosen));
</script>

<section class="kicker-onboard-preview w-full min-h-screen flex flex-col bg-paper" data-onboard-step="preview" data-pundit-id={persona.id}>
  <header class="px-8 lg:px-10 py-5 flex items-center justify-between border-b-2 border-ink bg-paper-deep">
    <div>
      <p class="font-sans text-[10px] tracking-[0.3em] font-bold text-red">STEP 3 OF 3 · YOUR MORNING PAPER</p>
      <h1 class="font-serif font-bold leading-none tracking-[-0.02em] text-[26px] lg:text-[32px] text-ink">
        Here's what
        <span style="color: var(--persona-accent, var(--ink));">{persona.name}</span>
        has to say this Sunday.
      </h1>
    </div>
    <button
      type="button"
      class="font-sans text-[11px] font-bold px-4 py-2 border border-rule text-ink-dim"
      onclick={onback}
      data-onboard-back
    >
      ← CHANGE PUNDIT
    </button>
  </header>

  <div class="flex-1 px-8 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
    <div>
      <div class="flex items-center gap-3 mb-4 pb-4 border-b-2 border-ink">
        <div>
          <p class="font-sans text-[9px] tracking-[0.3em] font-bold" style="color: var(--persona-accent, var(--ink));">
            YOUR PUNDIT · {persona.id.toUpperCase()}
          </p>
          <p class="font-serif font-bold text-[28px] leading-none tracking-[-0.01em] text-ink" data-pundit-name>
            {persona.name}
          </p>
          <p class="font-serif italic text-[11px] text-ink-dim">{persona.region}</p>
        </div>
      </div>

      <Rule kicker="TODAY'S LEAD · LIV V TOT · SUN 16:00" title="Liverpool host Tottenham at Anfield" />

      <p class="font-serif text-[15px] leading-[1.65] mb-4 text-ink" data-onboard-preview-open>{take.open}</p>

      <div
        class="px-4 py-3 mb-5 bg-paper-warm"
        style="border-left: 3px solid var(--persona-accent, var(--ink));"
      >
        <p class="font-sans text-[10px] tracking-[0.25em] font-bold mb-1" style="color: var(--persona-accent, var(--ink));">
          ASIDE
        </p>
        <p class="font-serif italic text-[13px] text-ink">{take.aside}</p>
      </div>

      <div class="flex items-center gap-6 pt-4 border-t border-ink">
        <div>
          <p class="font-sans text-[9px] tracking-[0.25em] font-bold text-red">THE PICK</p>
          <p class="font-mono font-extrabold text-[28px] tracking-[-0.03em] leading-none text-ink mt-0.5">
            {take.pick}
          </p>
        </div>
        <div>
          <p class="font-sans text-[9px] tracking-widest font-bold text-ink-dim">CONFIDENCE</p>
          <p class="font-mono font-bold text-[22px] text-ink-soft mt-0.5">{take.conf}%</p>
        </div>
      </div>
    </div>

    <aside class="flex flex-col gap-4">
      <div class="p-5 bg-ink text-paper" data-pundit-fingerprint>
        <p class="font-sans text-[9px] tracking-[0.3em] font-bold mb-3" style="color: var(--amber);">PUNDIT FINGERPRINT</p>
        {#each [
          ['REGION', persona.region],
          ['SIGNATURE TIC', persona.tic],
          ['VOICE', persona.voice]
        ] as [label, value] (label)}
          <div class="mb-2.5 pb-2.5 border-b border-ink-soft">
            <p class="font-sans text-[8px] tracking-[0.25em] font-bold mb-0.5 text-ink-faint">{label}</p>
            <p class="font-serif italic text-[12px] leading-snug text-paper">{value}</p>
          </div>
        {/each}
      </div>

      <button
        type="button"
        class="w-full py-5 font-sans font-extrabold text-[16px] tracking-[0.12em] border-2 transition-transform hover:scale-[1.01]"
        style="background: var(--persona-accent, var(--ink)); color: var(--paper); border-color: var(--persona-accent, var(--ink));"
        onclick={() => onconfirm?.(persona.id)}
        data-onboard-confirm
      >
        OPEN MY PAPER →
      </button>
      <p class="text-center font-serif italic text-[11px] text-ink-dim">Swap pundit any time in Settings.</p>
    </aside>
  </div>
</section>
