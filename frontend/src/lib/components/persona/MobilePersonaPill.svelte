<script lang="ts">
  import { personaStore } from '$lib/stores/persona';
  import { getPersona, type PersonaId } from '$lib/personas';

  interface Props {
    href?: string;
  }

  const { href = '/settings' }: Props = $props();

  const personaId = $derived($personaStore as PersonaId);
  const persona = $derived(getPersona(personaId));
</script>

<a
  {href}
  class="kicker-mpill inline-flex items-center gap-1.5 px-2 py-1 border border-rule font-sans text-[9px] tracking-[0.2em] uppercase font-bold text-ink"
  data-mobile-persona-pill
  data-pill-persona-id={persona.id}
  aria-label="Switch pundit"
>
  <span class="kicker-mpill__dot" data-pill-accent aria-hidden="true"></span>
  <span class="truncate max-w-[7rem]" data-pill-name>{persona.short}</span>
</a>

<style>
  .kicker-mpill {
    border-color: var(--rule);
  }
  .kicker-mpill__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--persona-accent, var(--ink));
    display: inline-block;
    flex-shrink: 0;
  }
</style>
