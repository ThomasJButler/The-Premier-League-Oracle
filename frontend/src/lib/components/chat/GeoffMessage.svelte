<script lang="ts">
  import type { PersonaConfig } from '$lib/personas';

  interface Props {
    body: string;
    persona: PersonaConfig;
    sublabel?: string;
    marginalia?: string;
    cheers?: boolean;
  }

  const { body, persona, sublabel, marginalia, cheers = false }: Props = $props();

  const prefix = $derived(persona.short.toUpperCase());
  const mono = $derived(persona.short.charAt(0).toUpperCase());
</script>

<article
  class="kicker-geoff-msg grid gap-6 mb-6"
  data-geoff-message
  data-persona-id={persona.id}
>
  <div class="kicker-geoff-msg__avatar text-right pt-1" data-geoff-avatar-cell>
    <div class="inline-flex flex-col items-end">
      <span
        class="kicker-geoff-msg__mono w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-[14px] mb-1.5"
        data-geoff-mono
        aria-hidden="true"
      >
        {mono}
      </span>
      <span
        class="kicker-geoff-msg__prefix font-sans text-[9px] tracking-[0.25em] font-bold"
        data-geoff-prefix
      >
        {prefix}
      </span>
      {#if sublabel}
        <span class="font-mono text-[10px] text-ink-dim mt-0.5" data-geoff-sublabel>
          {sublabel}
        </span>
      {/if}
    </div>
  </div>

  <div class="kicker-geoff-msg__body min-w-0">
    {#if cheers}
      <div
        class="mb-2 inline-flex items-center gap-2 px-2 py-1 rounded-sm bg-amber text-paper"
        data-geoff-cheers-tag
      >
        <span class="font-sans text-[9px] tracking-[0.3em] font-extrabold">CHEERS, GEOFF</span>
        <span class="font-serif italic text-[10px]">— glorious irrelevance follows</span>
      </div>
    {/if}
    <p
      class="font-serif text-[15px] leading-[1.65] text-ink whitespace-pre-line"
      data-geoff-body
    >
      {body}
    </p>
  </div>

  <aside class="kicker-geoff-msg__marginalia pt-1" data-geoff-marginalia-cell>
    {#if marginalia}
      <p
        class="font-serif italic text-[11px] text-ink-dim border-l border-rule pl-3"
        data-geoff-marginalia
      >
        {marginalia}
      </p>
    {/if}
  </aside>
</article>

<style>
  .kicker-geoff-msg {
    grid-template-columns: 120px 1fr 180px;
  }
  .kicker-geoff-msg__mono {
    background: var(--persona-accent, var(--ink));
    color: var(--paper);
    box-shadow:
      inset 0 -2px 4px rgba(0, 0, 0, 0.25),
      0 0 0 2px var(--paper),
      0 0 0 3px var(--persona-accent, var(--ink));
  }
  .kicker-geoff-msg__prefix {
    color: var(--persona-accent, var(--ink));
  }
  @media (max-width: 768px) {
    .kicker-geoff-msg {
      grid-template-columns: 56px 1fr;
    }
    .kicker-geoff-msg__marginalia {
      display: none;
    }
  }
</style>
