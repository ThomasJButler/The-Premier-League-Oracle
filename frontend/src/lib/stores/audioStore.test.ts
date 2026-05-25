import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { audioStore } from './audioStore';
import { createMockTrack } from '$lib/audio/mockPlayback';

const track = createMockTrack({
  personaId: 'volcano',
  source: 'broadsheet',
  title: 'GW32 BROADSHEET',
  subtitle: 'Mickey from Dagenham · 04:32',
  durationSec: 120
});

describe('audioStore', () => {
  beforeEach(() => audioStore.clear());

  it('starts empty: no track, paused, position 0', () => {
    const state = get(audioStore);
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.positionSec).toBe(0);
  });

  it('load sets the track and pauses with position 0', () => {
    audioStore.load(track);
    const state = get(audioStore);
    expect(state.currentTrack?.id).toBe(track.id);
    expect(state.isPlaying).toBe(false);
    expect(state.positionSec).toBe(0);
  });

  it('play / pause / toggle change isPlaying only when a track is loaded', () => {
    audioStore.play();
    expect(get(audioStore).isPlaying).toBe(false); // no-op without a track
    audioStore.load(track);
    audioStore.play();
    expect(get(audioStore).isPlaying).toBe(true);
    audioStore.pause();
    expect(get(audioStore).isPlaying).toBe(false);
    audioStore.toggle();
    expect(get(audioStore).isPlaying).toBe(true);
    audioStore.toggle();
    expect(get(audioStore).isPlaying).toBe(false);
  });

  it('seek clamps to [0, durationSec]', () => {
    audioStore.load(track);
    audioStore.seek(50);
    expect(get(audioStore).positionSec).toBe(50);
    audioStore.seek(-10);
    expect(get(audioStore).positionSec).toBe(0);
    audioStore.seek(9999);
    expect(get(audioStore).positionSec).toBe(track.durationSec);
  });

  it('skip advances and clamps via the mockPlayback reducer', () => {
    audioStore.load(track);
    audioStore.seek(10);
    audioStore.skip(15);
    expect(get(audioStore).positionSec).toBe(25);
    audioStore.skip(-9999);
    expect(get(audioStore).positionSec).toBe(0);
  });

  it('tick is a no-op while paused, advances while playing, and pauses at end', () => {
    audioStore.load(track);
    audioStore.tick(5);
    expect(get(audioStore).positionSec).toBe(0); // paused → no advance
    audioStore.play();
    audioStore.tick(30);
    expect(get(audioStore).positionSec).toBe(30);
    audioStore.tick(9999);
    const final = get(audioStore);
    expect(final.positionSec).toBe(track.durationSec);
    expect(final.isPlaying).toBe(false);
  });

  it('load with the same track id preserves position; a different id resets', () => {
    audioStore.load(track);
    audioStore.seek(40);
    audioStore.play();
    audioStore.load(track);
    let state = get(audioStore);
    expect(state.positionSec).toBe(40);
    expect(state.isPlaying).toBe(true);

    const other = createMockTrack({
      personaId: 'voice',
      source: 'column',
      title: 'On that back four',
      subtitle: 'The Voice · 02:10',
      durationSec: 130
    });
    audioStore.load(other);
    state = get(audioStore);
    expect(state.currentTrack?.id).toBe(other.id);
    expect(state.positionSec).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it('clear resets to the empty initial state', () => {
    audioStore.load(track);
    audioStore.play();
    audioStore.seek(33);
    audioStore.clear();
    const state = get(audioStore);
    expect(state.currentTrack).toBeNull();
    expect(state.positionSec).toBe(0);
    expect(state.isPlaying).toBe(false);
  });
});
