// Parse [[FIXTURE:HOME-AWAY]] and [[CHEERS:stat|label|content]] tokens
// from a streaming pundit response into a flat list of typed parts.
// Source: the_kicker_handoff/README.md inline token parsing reference.

export type TextPart = { type: 'text'; content: string };
export type FixturePart = { type: 'fixture'; home: string; away: string };
export type CheersPart = { type: 'cheers'; stat: string; label: string; content: string };
export type ParsedPart = TextPart | FixturePart | CheersPart;

const TOKEN_RE = /\[\[(FIXTURE|CHEERS):([^\]]+)\]\]/g;

export function parseGeoffResponse(text: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  if (!text) return parts;

  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', content: text.slice(last, match.index) });
    }
    if (match[1] === 'FIXTURE') {
      const [home = '', away = ''] = match[2].split('-');
      parts.push({ type: 'fixture', home, away });
    } else {
      const [stat = '', label = '', content = ''] = match[2].split('|');
      parts.push({ type: 'cheers', stat, label, content });
    }
    last = TOKEN_RE.lastIndex;
  }

  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) });
  }

  return parts;
}
