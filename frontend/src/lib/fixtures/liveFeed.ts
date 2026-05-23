/**
 * Mocked live-match feed for K1c.
 *
 * Returns a deterministic stream of in-match events + commentary lines for a
 * given fixture id so the `/fixtures/[id]/live` route can render against a
 * stable shape without a real provider wiring. The real feed (Football-Data
 * live, or a websocket layer) lands in a later phase; the contracts in this
 * module are the public surface the route + components depend on.
 */

export type LiveEventType =
  | 'GOAL'
  | 'OWN_GOAL'
  | 'PENALTY'
  | 'YELLOW'
  | 'RED'
  | 'SUB'
  | 'VAR';

export interface LiveEvent {
  id: string;
  minute: number;
  side: 'home' | 'away';
  teamAbbr: string;
  player: string;
  type: LiveEventType;
  detail?: string;
}

export interface LiveCommentaryLine {
  id: string;
  minute: number;
  text: string;
}

export interface LiveFeed {
  events: LiveEvent[];
  commentary: LiveCommentaryLine[];
}

const EVENT_GLYPH: Record<LiveEventType, string> = {
  GOAL: '⚽',
  OWN_GOAL: '⚽',
  PENALTY: '🅿',
  YELLOW: '🟨',
  RED: '🟥',
  SUB: '⇄',
  VAR: 'V',
};

export function eventGlyph(type: LiveEventType): string {
  return EVENT_GLYPH[type];
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic mock — same fixture id always yields the same feed. Keeps the
 * route stable across reloads + makes the slice testable without fakes.
 */
export function getLiveFeed(fixtureId: string, homeAbbr = 'HOM', awayAbbr = 'AWA'): LiveFeed {
  const seed = hash(fixtureId);

  const events: LiveEvent[] = (
    [
      {
        id: `${fixtureId}-e1`,
        minute: 12 + (seed % 6),
        side: 'home',
        teamAbbr: homeAbbr,
        player: 'Pickering',
        type: 'YELLOW',
        detail: 'Late on the recovery run.',
      },
      {
        id: `${fixtureId}-e2`,
        minute: 27 + (seed % 4),
        side: 'home',
        teamAbbr: homeAbbr,
        player: 'Okafor',
        type: 'GOAL',
        detail: 'Six-yard tap-in from a flick-on.',
      },
      {
        id: `${fixtureId}-e3`,
        minute: 41 + (seed % 3),
        side: 'away',
        teamAbbr: awayAbbr,
        player: 'Sandberg',
        type: 'GOAL',
        detail: 'Curling effort from the edge of the D.',
      },
      {
        id: `${fixtureId}-e4`,
        minute: 58 + (seed % 5),
        side: 'away',
        teamAbbr: awayAbbr,
        player: 'Rinaldo',
        type: 'SUB',
        detail: 'On for the injured Brown.',
      },
      {
        id: `${fixtureId}-e5`,
        minute: 67 + (seed % 4),
        side: 'home',
        teamAbbr: homeAbbr,
        player: 'Okafor',
        type: 'GOAL',
        detail: 'Heading home from a corner.',
      },
    ] satisfies LiveEvent[]
  ).sort((a, b) => a.minute - b.minute);

  const commentary: LiveCommentaryLine[] = [
    {
      id: `${fixtureId}-c1`,
      minute: events[events.length - 1]?.minute ?? 67,
      text: 'Bodies in the box, the ref waves play on, and the away end has gone very, very quiet.',
    },
    {
      id: `${fixtureId}-c2`,
      minute: Math.max(0, (events[events.length - 1]?.minute ?? 67) - 4),
      text: 'Pressing high, holding a line, and asking the centre-halves to be heroes.',
    },
    {
      id: `${fixtureId}-c3`,
      minute: Math.max(0, (events[events.length - 1]?.minute ?? 67) - 9),
      text: 'A booking that felt inevitable — the away winger has been the chief tormentor all half.',
    },
  ].sort((a, b) => b.minute - a.minute);

  return { events, commentary };
}
