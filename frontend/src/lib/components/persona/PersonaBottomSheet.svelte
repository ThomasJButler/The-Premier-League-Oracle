<script lang="ts">
  import { personaStore } from '$lib/stores/persona';
  import {
    KICKER_PERSONA_ORDER,
    PERSONAS,
    type PersonaId
  } from '$lib/personas';
  import PunditPickerCard from './PunditPickerCard.svelte';

  interface Props {
    open?: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  const personaId = $derived($personaStore as PersonaId);
  const activePersona = $derived(PERSONAS[personaId]);

  function close() {
    open = false;
  }

  function selectPersona(id: PersonaId) {
    personaStore.set(id);
    close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<button
  type="button"
  class="kicker-persona-trigger fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 bg-paper border border-ink px-3 py-2 font-sans text-[10px] tracking-[0.25em] uppercase font-bold shadow-md"
  data-persona-trigger
  aria-label="Change pundit"
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={() => (open = true)}
>
  <span class="kicker-persona-trigger__dot" aria-hidden="true"></span>
  <span data-persona-trigger-name>{activePersona.short}</span>
</button>

{#if open}
  <button
    type="button"
    class="kicker-persona-sheet__backdrop fixed inset-0 z-50 bg-ink/40"
    data-persona-backdrop
    aria-label="Dismiss pundit picker"
    onclick={close}
  ></button>

  <div
    class="kicker-persona-sheet fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col bg-paper border-t border-ink"
    data-persona-sheet
    role="dialog"
    aria-modal="true"
    aria-label="Pick your pundit"
  >
    <header
      class="kicker-persona-sheet__header flex items-center justify-between px-4 pt-4 pb-3 border-b border-rule"
    >
      <div class="min-w-0">
        <p class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold text-red">
          YOUR PUNDIT
        </p>
        <h2 class="font-serif text-[20px] leading-none font-bold tracking-[-0.02em]">
          Pick your pundit
        </h2>
      </div>
      <button
        type="button"
        class="font-mono text-[14px] leading-none px-2 py-1"
        data-persona-close
        aria-label="Close pundit picker"
        onclick={close}
      >
        ✕
      </button>
    </header>

    <div
      class="kicker-persona-sheet__list overflow-y-auto px-4 py-3 flex flex-col gap-2"
      data-persona-sheet-list
    >
      {#each KICKER_PERSONA_ORDER as id (id)}
        <PunditPickerCard
          persona={PERSONAS[id]}
          selected={personaId === id}
          onclick={selectPersona}
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .kicker-persona-trigger {
    border-color: var(--persona-accent, var(--ink));
  }
  .kicker-persona-trigger__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--persona-accent, var(--ink));
    display: inline-block;
  }
</style>
