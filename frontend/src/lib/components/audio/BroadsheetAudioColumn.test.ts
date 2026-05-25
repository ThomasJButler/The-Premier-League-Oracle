import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import BroadsheetAudioColumn from './BroadsheetAudioColumn.svelte';
import { audioStore } from '$lib/stores/audioStore';
import { createMockTrack } from '$lib/audio/mockPlayback';

const TRACK = createMockTrack({
  personaId: 'volcano',
  source: 'broadsheet',
  title: 'GW32 Broadsheet',
  subtitle: 'Mickey from Dagenham · 04:32',
  durationSec: 1094,
  markers: [
    { positionSec: 272, label: 'ON THAT BACK FOUR' },
    { positionSec: 600, label: 'AND THEN THEY KICKED OFF' }
  ]
});

describe('BroadsheetAudioColumn', () => {
  beforeEach(() => audioStore.clear());
  afterEach(() => audioStore.clear());

  it('renders the column kicker, title, persona row, time range, and transport', () => {
    const { body } = render(BroadsheetAudioColumn, { props: { track: TRACK } });
    expect(body).toContain('data-audio-column');
    expect(body).toContain('data-audio-column-kicker');
    expect(body).toContain('AUDIO COLUMN');
    expect(body).toContain('data-audio-column-title');
    expect(body).toContain('read by Mickey from Dagenham');
    expect(body).toContain('data-audio-column-avatar');
    expect(body).toContain('data-audio-column-position');
    expect(body).toContain('data-audio-column-duration');
    expect(body).toContain('18:14');
    expect(body).toContain('data-audio-column-skip-back');
    expect(body).toContain('data-audio-column-play');
    expect(body).toContain('data-audio-column-skip-forward');
  });

  it('renders one list item per marker with formatted timestamps', () => {
    const { body } = render(BroadsheetAudioColumn, { props: { track: TRACK } });
    expect(body).toContain('data-audio-column-markers');
    expect(body).toContain('04:32 — ON THAT BACK FOUR');
    expect(body).toContain('10:00 — AND THEN THEY KICKED OFF');
  });

  it('omits the markers list when the track has no markers', () => {
    const bare = createMockTrack({
      personaId: 'voice',
      source: 'broadsheet',
      title: 'GW33 Broadsheet',
      subtitle: 'The Voice · 06:10',
      durationSec: 400
    });
    const { body } = render(BroadsheetAudioColumn, { props: { track: bare } });
    expect(body).not.toContain('data-audio-column-markers');
  });

  it('reflects active playback state from the shared audioStore', () => {
    let body = render(BroadsheetAudioColumn, { props: { track: TRACK } }).body;
    expect(body).toContain('aria-pressed="false"');
    expect(body).toContain('aria-label="Play"');

    audioStore.load(TRACK);
    audioStore.play();
    audioStore.seek(45);

    body = render(BroadsheetAudioColumn, { props: { track: TRACK } }).body;
    expect(body).toContain('aria-pressed="true"');
    expect(body).toContain('aria-label="Pause"');
    expect(body).toMatch(/data-audio-column-position[^>]*>00:45</);
  });

  it('contains no betting / Kelly / bankroll copy', () => {
    const { body } = render(BroadsheetAudioColumn, { props: { track: TRACK } });
    expect(body.toLowerCase()).not.toMatch(/\b(bet|betting|kelly|bankroll|value bet)\b/);
  });
});
