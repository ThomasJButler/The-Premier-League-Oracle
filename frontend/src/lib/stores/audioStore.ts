// In-memory audio playback store for K2b-α. Holds the currently-loaded mock
// track plus transport state (position + isPlaying). Deliberately NOT
// persisted — audio should not auto-resume across reloads.
//
// K2b proper will keep this shape; only `createMockTrack` swaps to a real
// ElevenLabs source. The store stays the integration seam.

import { writable, type Writable } from 'svelte/store';
import type { MockTrack } from '$lib/audio/mockPlayback';
import { tick as advance } from '$lib/audio/mockPlayback';

export interface AudioState {
  currentTrack: MockTrack | null;
  positionSec: number;
  isPlaying: boolean;
}

const initial: AudioState = {
  currentTrack: null,
  positionSec: 0,
  isPlaying: false
};

const inner: Writable<AudioState> = writable({ ...initial });

function update(fn: (state: AudioState) => AudioState): void {
  inner.update(fn);
}

export const audioStore = {
  subscribe: inner.subscribe,

  /** Load a track. If it's the same id as the current track, leave position
   *  alone (lets a "Listen" button toggle without rewinding); otherwise reset
   *  position to 0 and pause. */
  load(track: MockTrack): void {
    update((state) => {
      if (state.currentTrack?.id === track.id) {
        return state;
      }
      return { currentTrack: track, positionSec: 0, isPlaying: false };
    });
  },

  play(): void {
    update((state) => (state.currentTrack ? { ...state, isPlaying: true } : state));
  },

  pause(): void {
    update((state) => ({ ...state, isPlaying: false }));
  },

  toggle(): void {
    update((state) =>
      state.currentTrack ? { ...state, isPlaying: !state.isPlaying } : state
    );
  },

  seek(positionSec: number): void {
    update((state) => {
      if (!state.currentTrack) return state;
      const clamped = Math.max(0, Math.min(positionSec, state.currentTrack.durationSec));
      return { ...state, positionSec: clamped };
    });
  },

  skip(deltaSec: number): void {
    update((state) => {
      if (!state.currentTrack) return state;
      return {
        ...state,
        positionSec: advance(state.positionSec, deltaSec, state.currentTrack.durationSec)
      };
    });
  },

  /** Wall-clock tick from the player component. No-op when paused. */
  tick(deltaSec: number): void {
    update((state) => {
      if (!state.currentTrack || !state.isPlaying) return state;
      const next = advance(state.positionSec, deltaSec, state.currentTrack.durationSec);
      const reachedEnd = next >= state.currentTrack.durationSec;
      return { ...state, positionSec: next, isPlaying: reachedEnd ? false : state.isPlaying };
    });
  },

  clear(): void {
    inner.set({ ...initial });
  }
};
