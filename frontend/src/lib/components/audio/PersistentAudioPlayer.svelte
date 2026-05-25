<script lang="ts">
  import { onMount } from 'svelte';
  import { audioStore } from '$lib/stores/audioStore';
  import { formatTime } from '$lib/audio/mockPlayback';
  import { PERSONAS } from '$lib/personas';

  const state = $derived($audioStore);
  const persona = $derived(
    state.currentTrack ? PERSONAS[state.currentTrack.personaId] : null
  );

  onMount(() => {
    // 1s wall-clock tick. Store no-ops when paused or no track.
    const id = window.setInterval(() => audioStore.tick(1), 1000);
    return () => window.clearInterval(id);
  });
</script>

{#if state.currentTrack && persona}
  <aside
    class="kicker-audio-player fixed inset-x-0 bottom-16 lg:bottom-0 z-30 border-t border-ink bg-paper-warm"
    data-audio-player
    aria-label="Audio player"
  >
    <div
      class="kicker-audio-player__inner mx-auto flex w-full max-w-screen-xl items-center gap-3 px-3 py-2 lg:px-6"
    >
      <span
        class="kicker-audio-player__avatar inline-flex h-10 w-10 shrink-0 items-center justify-center font-serif text-[14px] font-bold text-paper"
        data-audio-avatar
        aria-hidden="true"
      >
        {persona.short.charAt(0)}
      </span>

      <div class="min-w-0 flex-1">
        <p
          class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold leading-none text-ink-dim"
          data-audio-eyebrow
        >
          NOW READING · {state.currentTrack.title}
        </p>
        <p
          class="font-serif text-[13px] italic leading-tight text-ink mt-1 truncate"
          data-audio-subtitle
        >
          {state.currentTrack.subtitle}
        </p>
      </div>

      <div class="hidden md:flex items-center gap-3 font-mono text-[10px] text-ink-dim">
        <span data-audio-position>{formatTime(state.positionSec)}</span>
        <span aria-hidden="true">/</span>
        <span data-audio-duration>{formatTime(state.currentTrack.durationSec)}</span>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="kicker-audio-player__skip inline-flex h-9 items-center justify-center px-2 font-mono text-[10px] tracking-[0.2em] border border-ink"
          data-audio-skip-back
          aria-label="Skip back 15 seconds"
          onclick={() => audioStore.skip(-15)}
        >
          «15
        </button>
        <button
          type="button"
          class="kicker-audio-player__play inline-flex h-10 w-10 items-center justify-center text-paper font-mono text-[14px] font-bold leading-none"
          data-audio-play
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
          aria-pressed={state.isPlaying}
          onclick={() => audioStore.toggle()}
        >
          {state.isPlaying ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          class="kicker-audio-player__skip inline-flex h-9 items-center justify-center px-2 font-mono text-[10px] tracking-[0.2em] border border-ink"
          data-audio-skip-forward
          aria-label="Skip forward 15 seconds"
          onclick={() => audioStore.skip(15)}
        >
          15»
        </button>
      </div>
    </div>
  </aside>
{/if}

<style>
  .kicker-audio-player__avatar {
    background: var(--persona-accent, var(--ink));
  }
  .kicker-audio-player__play {
    background: var(--persona-accent, var(--ink));
  }
</style>
