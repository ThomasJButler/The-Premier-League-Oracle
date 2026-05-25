<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { personaStore, STORAGE_KEY } from '$lib/stores/persona';
  import MobileTicker from '$lib/components/shell/MobileTicker.svelte';
  import PersonaBottomSheet from '$lib/components/persona/PersonaBottomSheet.svelte';
  import PersistentAudioPlayer from '$lib/components/audio/PersistentAudioPlayer.svelte';
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

<!-- Mobile ticker: visible on mobile only. Desktop gets GeoffTicker inside KickerShell. -->
<div class="lg:hidden">
  <MobileTicker />
</div>

{@render children()}

<!-- Mobile-only bottom-sheet persona switcher. Desktop swaps via /settings or /roster. -->
<div class="lg:hidden">
  <PersonaBottomSheet />
</div>

<!-- Persistent audio player. Renders only when a track is loaded (audioStore). -->
<PersistentAudioPlayer />
