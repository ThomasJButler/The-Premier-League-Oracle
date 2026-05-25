// Persona-voiced fixture-analysis cache for the Match-detail Analysis tab.
//
// Cache key: `kicker:analysis:{fixtureId}:{personaId}` — one entry per
// (fixture, persona) pair. Populated by the Analysis tab after a successful
// POST to `/api/broadsheet` with `kind: 'fixture-analysis'`.
//
// SSR-safe: every method guards `typeof localStorage`.

import type { PersonaId } from '$lib/personas';

const PREFIX = 'kicker:analysis:';

export interface FixtureAnalysisEntry {
  fixtureId: string;
  personaId: PersonaId;
  body: string;
  /** ISO timestamp, written when the cache entry is populated. */
  generatedAt: string;
}

function key(fixtureId: string, personaId: PersonaId): string {
  return `${PREFIX}${fixtureId}:${personaId}`;
}

export function readAnalysis(fixtureId: string, personaId: PersonaId): FixtureAnalysisEntry | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key(fixtureId, personaId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FixtureAnalysisEntry;
    if (typeof parsed.body !== 'string' || typeof parsed.generatedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAnalysis(
  fixtureId: string,
  personaId: PersonaId,
  body: string
): FixtureAnalysisEntry {
  const entry: FixtureAnalysisEntry = {
    fixtureId,
    personaId,
    body,
    generatedAt: new Date().toISOString()
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key(fixtureId, personaId), JSON.stringify(entry));
  }
  return entry;
}

export function clearAnalysis(fixtureId: string, personaId: PersonaId): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key(fixtureId, personaId));
}
