// Deterministic mock playback for K2b-α. Pure helpers — no real audio, no
// timers. The audio player chrome owns the wall-clock; this module just
// describes a track and reduces position over time. K2b proper will swap the
// data-source for ElevenLabs without touching this shape.

import type { PersonaId } from '$lib/personas';

export interface AudioMarker {
  /** Position in seconds from the start of the track. */
  positionSec: number;
  /** Section label shown beside the marker (e.g. "ON THAT BACK FOUR"). */
  label: string;
}

export interface MockTrack {
  /** Stable id so the store can detect re-loads vs same-track toggles. */
  id: string;
  personaId: PersonaId;
  /** Source kind — drives the headline/byline strings in the chrome. */
  source: 'broadsheet' | 'column';
  /** Top-line title (e.g. "GW32 BROADSHEET"). */
  title: string;
  /** Sub-line (e.g. "Mickey from Dagenham · 04:32"). */
  subtitle: string;
  /** Total duration in whole seconds. */
  durationSec: number;
  /** Optional section markers shown in the desktop column. */
  markers: AudioMarker[];
}

export interface CreateMockTrackInput {
  personaId: PersonaId;
  source: MockTrack['source'];
  title: string;
  subtitle: string;
  /** Defaults to 18 * 60 (matches the audio-player wireframe's 18:14). */
  durationSec?: number;
  markers?: AudioMarker[];
}

export const DEFAULT_DURATION_SEC = 18 * 60 + 14;

export function createMockTrack(input: CreateMockTrackInput): MockTrack {
  const durationSec = input.durationSec ?? DEFAULT_DURATION_SEC;
  // Deterministic id derived from inputs so two equal payloads collapse into
  // one track (avoids unnecessary store mutations when the user re-clicks
  // "Listen" on the same broadsheet).
  const id = `${input.source}:${input.personaId}:${input.title}:${durationSec}`;
  return {
    id,
    personaId: input.personaId,
    source: input.source,
    title: input.title,
    subtitle: input.subtitle,
    durationSec,
    markers: input.markers ?? []
  };
}

/** Format whole seconds as `MM:SS`. Negative values clamp to `00:00`. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Reducer: advance position by `deltaSec`. Clamps to `[0, durationSec]`.
 * Used by the player component's wall-clock tick AND by skip controls.
 */
export function tick(positionSec: number, deltaSec: number, durationSec: number): number {
  const next = positionSec + deltaSec;
  if (next <= 0) return 0;
  if (next >= durationSec) return durationSec;
  return next;
}

/** True when position has reached the end (caller should pause + reset). */
export function isAtEnd(positionSec: number, durationSec: number): boolean {
  return positionSec >= durationSec;
}
