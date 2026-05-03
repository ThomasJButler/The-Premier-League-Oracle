<script lang="ts">
  import PunditCard from '$lib/components/roster/PunditCard.svelte';
  import { KICKER_PERSONA_ORDER, PERSONAS, type PersonaId } from '$lib/personas';

  interface Props {
    chosen?: PersonaId | null;
    onchoose?: (id: PersonaId) => void;
    onnext?: () => void;
  }

  const { chosen = null, onchoose, onnext }: Props = $props();
</script>

<section class="kicker-onboard-pick w-full min-h-screen flex flex-col bg-paper" data-onboard-step="pick">
  <header class="px-8 lg:px-10 py-6 flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between border-b-2 border-ink">
    <div>
      <p class="font-sans text-[10px] tracking-[0.3em] font-bold text-red">STEP 2 OF 3 · THE KICKER · SETUP</p>
      <h1 class="font-serif font-bold leading-[0.95] tracking-[-0.02em] text-[36px] lg:text-[44px] text-ink">
        Who's your morning pundit?
      </h1>
      <p class="mt-1.5 font-serif italic text-[14px] text-ink-dim">
        Pick the voice that suits your coffee. You can swap at any time.
      </p>
    </div>
    <div class="lg:text-right">
      {#if chosen}
        {@const p = PERSONAS[chosen]}
        <button
          type="button"
          class="px-8 py-3.5 font-sans font-extrabold text-[14px] tracking-[0.1em] bg-ink text-paper border-2 border-ink"
          onclick={onnext}
          data-onboard-next
        >
          START WITH {p.short.toUpperCase()} →
        </button>
      {:else}
        <span
          class="inline-block px-8 py-3.5 font-sans font-bold text-[14px] tracking-[0.1em] text-ink-dim border-2 border-rule"
          data-onboard-next-disabled
        >
          SELECT A PUNDIT
        </span>
      {/if}
    </div>
  </header>

  <div class="flex-1 grid grid-cols-2 lg:grid-cols-5 lg:grid-rows-2 gap-px bg-ink" data-onboard-grid>
    {#each KICKER_PERSONA_ORDER as id (id)}
      <PunditCard persona={PERSONAS[id]} selected={chosen === id} onclick={onchoose} />
    {/each}
  </div>
</section>
