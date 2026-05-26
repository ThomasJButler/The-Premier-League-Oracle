<script lang="ts">
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';

  const personaId = $derived($personaStore as PersonaId);
  const persona = $derived(getPersona(personaId));
</script>

<div
  class="kicker-mpill inline-flex items-center gap-1.5 px-2 py-1 font-sans text-[9px] tracking-[0.2em] uppercase font-bold text-ink-soft"
  data-mobile-persona-pill
  data-pill-persona-id={persona.id}
>
  <span class="kicker-mpill__dot" data-pill-accent aria-hidden="true"></span>
  <span class="truncate max-w-[7rem]" data-pill-name>{persona.short}</span>
</div>

<style>
  .kicker-mpill__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--persona-accent, var(--ink));
    display: inline-block;
    flex-shrink: 0;
  }
</style>
