/**
 * Inline-token parser for Oracle assistant messages.
 *
 * Walks an assistant body string and emits an ordered array of segments
 * the renderer can map 1:1 onto components. Pure + sync — fixture lookup
 * is the renderer's job (see FixtureChip.svelte).
 *
 * Token grammar:
 *   [[FIXTURE:HOME-AWAY]]           → fixture segment (HOME/AWAY are TLAs)
 *   [[CHEERS:stat|label|text]]      → cheers segment (1:1 → CheersGeoffCallout props)
 *
 * Malformed tokens are emitted as text so the user still sees the source.
 */

export type InlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'fixture'; home: string; away: string }
  | { kind: 'cheers'; stat: string; label: string; text: string };

const TOKEN_RE = /\[\[(FIXTURE|CHEERS):([^\]]+)\]\]/g;

export function parseInlineTokens(input: string): InlineSegment[] {
  if (!input) return [];

  const segments: InlineSegment[] = [];
  let cursor = 0;

  for (const match of input.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: 'text', value: input.slice(cursor, start) });
    }

    const [raw, kind, body] = match;
    if (kind === 'FIXTURE') {
      const dash = body.indexOf('-');
      const home = dash > 0 ? body.slice(0, dash).trim() : '';
      const away = dash > 0 ? body.slice(dash + 1).trim() : '';
      if (home && away) {
        segments.push({ kind: 'fixture', home, away });
      } else {
        segments.push({ kind: 'text', value: raw });
      }
    } else {
      const parts = body.split('|');
      if (parts.length >= 3) {
        const [stat, label, ...rest] = parts;
        segments.push({
          kind: 'cheers',
          stat: stat.trim(),
          label: label.trim(),
          text: rest.join('|').trim()
        });
      } else {
        segments.push({ kind: 'text', value: raw });
      }
    }

    cursor = start + raw.length;
  }

  if (cursor < input.length) {
    segments.push({ kind: 'text', value: input.slice(cursor) });
  }

  return segments;
}
