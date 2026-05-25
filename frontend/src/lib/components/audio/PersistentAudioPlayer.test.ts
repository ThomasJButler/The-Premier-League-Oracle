import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PersistentAudioPlayer from './PersistentAudioPlayer.svelte';
import { audioStore } from '$lib/stores/audioStore';
import { createMockTrack } from '$lib/audio/mockPlayback';

const TRACK = createMockTrack({
  personaId: 'volcano',
  source: 'broadsheet',
  title: 'GW32 BROADSHEET',
  subtitle: 'Mickey from Dagenham · 04:32',
  durationSec: 1094
});

describe('PersistentAudioPlayer', () => {
  beforeEach(() => audioStore.clear());
  afterEach(() => audioStore.clear());

  it('renders nothing when no track is loaded', () => {
    const { body } = render(PersistentAudioPlayer);
    expect(body).not.toContain('data-audio-player');
    expect(body).not.toContain('data-audio-play');
  });

  it('renders the player chrome with transport controls when a track is loaded', () => {
    audioStore.load(TRACK);
    const { body } = render(PersistentAudioPlayer);
    expect(body).toContain('data-audio-player');
    expect(body).toContain('data-audio-avatar');
    expect(body).toContain('data-audio-eyebrow');
    expect(body).toContain('data-audio-subtitle');
    expect(body).toContain('data-audio-position');
    expect(body).toContain('data-audio-duration');
    expect(body).toContain('data-audio-skip-back');
    expect(body).toContain('data-audio-play');
    expect(body).toContain('data-audio-skip-forward');
    expect(body).toContain('NOW READING · GW32 BROADSHEET');
    expect(body).toContain('Mickey from Dagenham · 04:32');
    expect(body).toContain('18:14');
    expect(body).toContain('00:00');
  });

  it('reflects play state in aria-pressed + icon glyph', () => {
    audioStore.load(TRACK);
    let body = render(PersistentAudioPlayer).body;
    expect(body).toContain('aria-pressed="false"');
    expect(body).toContain('aria-label="Play"');
    audioStore.play();
    body = render(PersistentAudioPlayer).body;
    expect(body).toContain('aria-pressed="true"');
    expect(body).toContain('aria-label="Pause"');
  });

  it('contains no betting / Kelly / bankroll copy in the chrome', () => {
    audioStore.load(TRACK);
    const { body } = render(PersistentAudioPlayer);
    expect(body.toLowerCase()).not.toMatch(/\b(bet|betting|kelly|bankroll|value bet)\b/);
  });

  it('declares the persona-accent CSS hook via the component stylesheet', () => {
    audioStore.load(TRACK);
    // SSR renders <button class="...kicker-audio-player__play..."> — the
    // accent colour is applied by the component <style> using
    // var(--persona-accent). Tests assert the hook class is present so a
    // future refactor doesn't drop the CSS binding.
    const { body } = render(PersistentAudioPlayer);
    expect(body).toMatch(/kicker-audio-player__play/);
    expect(body).toMatch(/kicker-audio-player__avatar/);
  });
});
