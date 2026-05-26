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
  import { demoModeStore } from '$lib/demo/demoMode';

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

{#if $demoModeStore}
  <div
    class="fixed bottom-3 right-3 z-50 border-2 border-ink bg-paper-warm px-2 py-1 font-mono text-[9px] tracking-[0.2em] text-ink shadow-sm"
    data-demo-mode-badge
  >
    ● DEMO MODE · SAMPLE DATA
  </div>
{/if}

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
