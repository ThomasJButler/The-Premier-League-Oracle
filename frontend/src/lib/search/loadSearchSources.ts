// Async glue around dataService + threadsStore for the morgue search index.
//
// Mirrors the β.1 pattern (streamChat / requestBroadsheet): default deps point
// at the real services; tests inject synthetic loaders so the unit boundary is
// `buildIndex`. Failures on the optional sources (no API key, quota exhausted)
// degrade silently to empty arrays — the bundled seasons + in-memory threads
// always survive.

import { get } from 'svelte/store';
import type { Match } from '../../types';
import { dataService } from '../../services/dataService';
import type { FDScorer } from '../../services/api/footballData';
import { LEAGUE_HISTORY, type SeasonRecord } from '../fixtures/leagueHistory';
import { threadsStore, type OracleThread } from '../stores/threads';
import { buildIndex, type SearchItem } from './buildIndex';

export interface SearchSourceDeps {
  matches?: () => Promise<Match[]>;
  scorers?: () => Promise<FDScorer[]>;
  seasons?: () => readonly SeasonRecord[];
  threads?: () => OracleThread[];
}

async function safeArray<T>(loader: () => Promise<T[]>): Promise<T[]> {
  try {
    const out = await loader();
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}

export async function loadSearchSources(deps: SearchSourceDeps = {}): Promise<SearchItem[]> {
  const [matches, scorers] = await Promise.all([
    safeArray(deps.matches ?? (() => dataService.getCurrentSeasonMatches())),
    safeArray(deps.scorers ?? (() => dataService.getTopScorers(20))),
  ]);
  const seasons = (deps.seasons ?? (() => LEAGUE_HISTORY))();
  const threads = (deps.threads ?? (() => get(threadsStore).threads))();
  return buildIndex({ matches, scorers, seasons, threads });
}
