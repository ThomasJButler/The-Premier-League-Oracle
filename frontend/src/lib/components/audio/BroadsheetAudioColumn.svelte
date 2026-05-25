<script lang="ts">
  import { audioStore } from '$lib/stores/audioStore';
  import { formatTime } from '$lib/audio/mockPlayback';
  import { PERSONAS } from '$lib/personas';
  import type { MockTrack } from '$lib/audio/mockPlayback';

  interface Props {
    /** The track this column offers. Clicking play loads it and toggles
     *  playback via the shared audioStore. */
    track: MockTrack;
  }

  let { track }: Props = $props();

  const state = $derived($audioStore);
  const persona = $derived(PERSONAS[track.personaId]);
  const isActive = $derived(state.currentTrack?.id === track.id);
  const isPlaying = $derived(isActive && state.isPlaying);
  const positionSec = $derived(isActive ? state.positionSec : 0);

  function onPlayClick() {
    if (!isActive) {
      audioStore.load(track);
      audioStore.play();
    } else {
      audioStore.toggle();
    }
  }
</script>

<section
  class="kicker-audio-column border border-rule bg-paper-warm p-4"
  data-audio-column
  aria-label="Audio column"
>
  <p
    class="font-sans text-[9px] tracking-[0.3em] uppercase font-bold text-red"
    data-audio-column-kicker
  >
    AUDIO COLUMN
  </p>
  <h3
    class="mt-2 font-serif text-[18px] leading-tight font-bold tracking-[-0.02em]"
    data-audio-column-title
  >
    {track.title} — read by {persona.name}
  </h3>

  <div class="mt-4 flex items-center gap-3 border-t border-rule pt-3">
    <span
      class="kicker-audio-column__avatar inline-flex h-10 w-10 shrink-0 items-center justify-center font-serif text-[14px] font-bold text-paper"
      data-audio-column-avatar
      aria-hidden="true"
    >
      {persona.short.charAt(0)}
    </span>
    <div class="min-w-0">
      <p
        class="font-sans text-[10px] tracking-[0.25em] uppercase font-bold leading-tight"
        data-audio-column-name
      >
        {persona.short} · {persona.region}
      </p>
      <p class="font-serif text-[12px] italic text-ink-dim leading-tight mt-1">
        Permanent meltdown · CAPS
      </p>
    </div>
  </div>

  <div
    class="mt-4 flex items-center justify-between font-mono text-[10px] text-ink-dim"
    data-audio-column-times
  >
    <span data-audio-column-position>{formatTime(positionSec)}</span>
    <span data-audio-column-duration>{formatTime(track.durationSec)}</span>
  </div>

  <div class="mt-3 flex items-center justify-center gap-3">
    <button
      type="button"
      class="kicker-audio-column__skip inline-flex h-8 items-center justify-center px-2 font-mono text-[10px] tracking-[0.2em] border border-ink"
      data-audio-column-skip-back
      aria-label="Skip back 15 seconds"
      onclick={() => {
        if (!isActive) audioStore.load(track);
        audioStore.skip(-15);
      }}
    >
      «15
    </button>
    <button
      type="button"
      class="kicker-audio-column__play inline-flex h-10 w-10 items-center justify-center text-paper font-mono text-[14px] font-bold"
      data-audio-column-play
      aria-label={isPlaying ? 'Pause' : 'Play'}
      aria-pressed={isPlaying}
      onclick={onPlayClick}
    >
      {isPlaying ? '❚❚' : '▶'}
    </button>
    <button
      type="button"
      class="kicker-audio-column__skip inline-flex h-8 items-center justify-center px-2 font-mono text-[10px] tracking-[0.2em] border border-ink"
      data-audio-column-skip-forward
      aria-label="Skip forward 15 seconds"
      onclick={() => {
        if (!isActive) audioStore.load(track);
        audioStore.skip(15);
      }}
    >
      15»
    </button>
  </div>

  {#if track.markers.length > 0}
    <ul class="mt-4 flex flex-col gap-1 border-t border-rule pt-3" data-audio-column-markers>
      {#each track.markers as marker (marker.positionSec)}
        <li class="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim">
          ▶ MARKER · {formatTime(marker.positionSec)} — {marker.label}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .kicker-audio-column__avatar,
  .kicker-audio-column__play {
    background: var(--persona-accent, var(--ink));
  }
</style>
