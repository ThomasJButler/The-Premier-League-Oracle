// T7 — bridge the /api/broadsheet cache into the /column/[slug] reader.
//
// The broadsheet cache stores per-(gameweek, persona) editions under the slug
// scheme `gw{N}-{personaId}`; the column route is fixture-shaped. This module is
// the pure seam between the two: slug helpers that never collide with the three
// hand-authored static column slugs, plus an adapter that reshapes a cached
// BroadsheetJson into a ColumnRecord the existing renderer can consume verbatim.
//
// Pure: no storage access, no wall-clock, no fetch. The route reads the cache
// (in onMount) and hands the entry to `cachedBroadsheetToColumn` here.

import type { PersonaId } from '$lib/personas';
import { isPersonaId, getPersona } from '$lib/personas';
import type { CachedBroadsheet } from '$lib/stores/broadsheetStore';
import type { ColumnRecord } from '$lib/fixtures/columns';

/** Cached-edition slug scheme. Anchored `gw` + digits + `-` + lowercase persona id. */
const COLUMN_SLUG_RE = /^gw(\d+)-([a-z]+)$/;

const WORDS_PER_MINUTE = 200;

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY'
] as const;

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER'
] as const;

/** Build the cached-edition column slug for a (gameweek, persona) pair. */
export function buildColumnSlug(gameweek: number, personaId: PersonaId): string {
  return `gw${gameweek}-${personaId}`;
}

/**
 * Parse a cached-edition slug back to its parts, or null when the slug is not a
 * cached edition (e.g. one of the three static column slugs, or garbage). The
 * persona segment is validated against `isPersonaId` so an unknown voice never
 * masquerades as a cached edition.
 */
export function parseColumnSlug(slug: string): { gameweek: number; personaId: PersonaId } | null {
  const match = COLUMN_SLUG_RE.exec(slug);
  if (!match) return null;
  const gameweek = Number(match[1]);
  const personaId = match[2];
  if (!Number.isInteger(gameweek) || gameweek <= 0) return null;
  if (!isPersonaId(personaId)) return null;
  return { gameweek, personaId };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** First sentence of a paragraph, falling back to the whole trimmed string. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

/** Uppercase `WEEKDAY, D MONTH` from an ISO timestamp; a stable label if unparseable. */
function formatDateline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'THE KICKER';
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

/**
 * Reshape a cached broadsheet edition into a ColumnRecord.
 *
 * - headline string  → a single non-emphasised HeadlineSegment
 * - standfirst        → dropCapIntro
 * - sections[]        → body[] in order (heading woven into each paragraph)
 * - pullQuote         → ALWAYS produced via the fallback chain
 *                       pullQuote → closingLine → first sentence of §1 → standfirst,
 *                       so the renderer's unconditional `column.pullQuote.body` never crashes
 * - closingLine       → appended to body[] unless it was consumed as the pull quote
 */
export function cachedBroadsheetToColumn(cached: CachedBroadsheet): ColumnRecord {
  const { broadsheet, personaId, gameweek, generatedAt } = cached;
  const persona = getPersona(personaId);

  const body: string[] = broadsheet.sections.map((section) => {
    const heading = section.heading?.trim();
    const text = section.body?.trim() ?? '';
    return heading ? `${heading} — ${text}` : text;
  });

  // Pull quote is REQUIRED downstream — walk the fallback chain and remember
  // whether the closing line was spent so we don't also append it to the body.
  let pullQuoteBody: string;
  let closingConsumed = false;
  if (broadsheet.pullQuote && broadsheet.pullQuote.trim()) {
    pullQuoteBody = broadsheet.pullQuote.trim();
  } else if (broadsheet.closingLine && broadsheet.closingLine.trim()) {
    pullQuoteBody = broadsheet.closingLine.trim();
    closingConsumed = true;
  } else if (broadsheet.sections[0]?.body?.trim()) {
    pullQuoteBody = firstSentence(broadsheet.sections[0].body);
  } else {
    pullQuoteBody = broadsheet.standfirst;
  }

  if (broadsheet.closingLine && broadsheet.closingLine.trim() && !closingConsumed) {
    body.push(broadsheet.closingLine.trim());
  }

  const wordCount = countWords([broadsheet.standfirst, ...body].join(' '));
  const readTimeMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return {
    slug: buildColumnSlug(gameweek, personaId),
    eyebrow: `GAMEWEEK ${gameweek} · BROADSHEET`,
    headline: [{ text: broadsheet.headline }],
    byline: {
      personaId,
      sub: broadsheet.byline,
      readTimeMinutes,
      dateline: formatDateline(generatedAt)
    },
    dropCapIntro: broadsheet.standfirst,
    pullQuote: {
      body: pullQuoteBody,
      attribution: persona.name
    },
    body
  };
}
