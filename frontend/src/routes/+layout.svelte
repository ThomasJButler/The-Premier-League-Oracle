<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import GeoffTicker from '$lib/components/atoms/GeoffTicker.svelte';
  import { personaStore, STORAGE_KEY } from '$lib/stores/persona';
  import { shouldRedirectToOnboarding } from '$lib/utils/onboardingGate';

  let { children } = $props();

  // Subscribe so the persona-store side-effects (localStorage + <html data-persona>) wire up.
  $effect(() => {
    void $personaStore;
  });

  onMount(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (shouldRedirectToOnboarding(stored, $page.url.pathname)) {
      goto('/onboarding');
    }
  });
</script>

<GeoffTicker />
{@render children()}
