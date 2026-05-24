// Persona-voiced verdict cache for the Insights archive.
//
// Cache key: `kicker:verdict:{season}:{personaId}` — one entry per (season,
// persona) pair. Verdict bodies are written by a future K1e slice that extends
// `/api/broadsheet` to accept a season context; for now the archive reads cache
// and falls back to "No verdict on file" when no entry exists.
//
// SSR-safe: every method guards `typeof localStorage`.

import type { PersonaId } from '$lib/personas';

const PREFIX = 'kicker:verdict:';

export interface ArchiveVerdict {
  season: string;
  personaId: PersonaId;
  body: string;
  /** ISO timestamp, written when the cache entry is populated. */
  generatedAt: string;
}

function key(season: string, personaId: PersonaId): string {
  return `${PREFIX}${season}:${personaId}`;
}

export function readVerdict(season: string, personaId: PersonaId): ArchiveVerdict | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key(season, personaId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ArchiveVerdict;
    if (typeof parsed.body !== 'string' || typeof parsed.generatedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVerdict(season: string, personaId: PersonaId, body: string): ArchiveVerdict {
  const entry: ArchiveVerdict = {
    season,
    personaId,
    body,
    generatedAt: new Date().toISOString()
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key(season, personaId), JSON.stringify(entry));
  }
  return entry;
}

export function clearVerdict(season: string, personaId: PersonaId): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key(season, personaId));
}
