<script lang="ts">
  import OnboardWelcome from '$lib/components/onboarding/OnboardWelcome.svelte';
  import OnboardPickPundit from '$lib/components/onboarding/OnboardPickPundit.svelte';
  import OnboardPreview from '$lib/components/onboarding/OnboardPreview.svelte';
  import { personaStore } from '$lib/stores/persona';
  import type { PersonaId } from '$lib/personas';
  import { goto } from '$app/navigation';

  interface Props {
    initialStep?: 0 | 1 | 2;
    initialChosen?: PersonaId | null;
  }

  const { initialStep = 0, initialChosen = null }: Props = $props();

  // svelte-ignore state_referenced_locally
  let step = $state<0 | 1 | 2>(initialStep);
  // svelte-ignore state_referenced_locally
  let chosen = $state<PersonaId | null>(initialChosen);

  function pick(id: PersonaId): void {
    chosen = id;
  }

  function confirm(id: PersonaId): void {
    personaStore.set(id);
    goto('/today');
  }
</script>

<div class="kicker-onboarding" data-onboard-current-step={step}>
  {#if step === 0}
    <OnboardWelcome onnext={() => (step = 1)} />
  {:else if step === 1}
    <OnboardPickPundit
      {chosen}
      onchoose={pick}
      onnext={() => {
        if (chosen) step = 2;
      }}
    />
  {:else if chosen}
    <OnboardPreview chosen={chosen} onback={() => (step = 1)} onconfirm={confirm} />
  {/if}
</div>
