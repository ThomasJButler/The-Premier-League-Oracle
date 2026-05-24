// Broadsheet cache for K1e-β. One entry per (gameweek, persona) pair so a
// reader who switches persona mid-week still sees a per-voice broadsheet; the
// `/api/broadsheet` endpoint is one-shot Sonnet, so re-generating per visit
// would burn tokens.
//
// SSR-safe: every method guards `typeof localStorage`.

import type { PersonaId } from '$lib/personas';
import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';

const PREFIX = 'kicker:broadsheet:gw';

export interface CachedBroadsheet {
  gameweek: number;
  personaId: PersonaId;
  broadsheet: BroadsheetJson;
  /** ISO timestamp, written when the cache entry is populated. */
  generatedAt: string;
}

function key(gameweek: number, personaId: PersonaId): string {
  return `${PREFIX}${gameweek}:${personaId}`;
}

function isBroadsheetJson(value: unknown): value is BroadsheetJson {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.headline === 'string' &&
    typeof v.standfirst === 'string' &&
    typeof v.byline === 'string' &&
    Array.isArray(v.sections)
  );
}

export function readBroadsheet(gameweek: number, personaId: PersonaId): CachedBroadsheet | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key(gameweek, personaId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedBroadsheet;
    if (
      typeof parsed.gameweek !== 'number' ||
      typeof parsed.personaId !== 'string' ||
      typeof parsed.generatedAt !== 'string' ||
      !isBroadsheetJson(parsed.broadsheet)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeBroadsheet(
  gameweek: number,
  personaId: PersonaId,
  broadsheet: BroadsheetJson,
  generatedAt: string = new Date().toISOString()
): CachedBroadsheet {
  const entry: CachedBroadsheet = { gameweek, personaId, broadsheet, generatedAt };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key(gameweek, personaId), JSON.stringify(entry));
  }
  return entry;
}

export function clearBroadsheet(gameweek: number, personaId: PersonaId): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key(gameweek, personaId));
}
