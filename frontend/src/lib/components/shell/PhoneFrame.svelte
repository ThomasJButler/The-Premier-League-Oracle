<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  const { children }: Props = $props();

  // Preview-only chrome — Vite strips this branch from production bundles
  // because import.meta.env.PROD is a build-time constant.
  const showFrame = !import.meta.env.PROD;
</script>

{#if showFrame}
  <div
    class="kicker-phone-frame__stage flex items-center justify-center min-h-screen p-8"
    data-phone-frame
  >
    <div class="kicker-phone-frame__bezel" data-phone-bezel>
      <div class="kicker-phone-frame__screen bg-paper overflow-hidden" data-phone-screen>
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{:else}
  {#if children}
    {@render children()}
  {/if}
{/if}

<style>
  .kicker-phone-frame__stage {
    background: #1a1611;
  }
  .kicker-phone-frame__bezel {
    width: 390px;
    height: 844px;
    border-radius: 46px;
    padding: 10px;
    background: #0a0805;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
  }
  .kicker-phone-frame__screen {
    width: 100%;
    height: 100%;
    border-radius: 36px;
    position: relative;
  }
</style>
