import { dataService } from '../../services/dataService';
import { matchToFixture } from '$lib/adapters/v3';
import type { Fixture } from '../../types/redesign';
import type { Match } from '../../types';

/**
 * Resolves a `[[FIXTURE:HOME-AWAY]]` token pair (TLAs) to the next
 * scheduled fixture. Cached on the abbr pair so multiple chips
 * referencing the same match share a single dataService roundtrip.
 *
 * Returns `null` when no upcoming fixture matches the pair.
 */

const cache = new Map<string, Promise<Fixture | null>>();

function abbr(name: string): string {
  return name.replace(/\b(?:FC|AFC)\b/g, '').trim().slice(0, 3).toUpperCase();
}

export function findFixtureByPair(home: string, away: string): Promise<Fixture | null> {
  const key = `${home.toUpperCase()}-${away.toUpperCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = (async () => {
    try {
      const matches: Match[] = await dataService.getMatches({ upcoming: true, days: 14 });
      const wanted = matches.find(
        (m) => abbr(m.home_team) === home.toUpperCase() && abbr(m.away_team) === away.toUpperCase()
      );
      return wanted ? matchToFixture(wanted) : null;
    } catch {
      return null;
    }
  })();

  cache.set(key, promise);
  return promise;
}

/** Test-only: clear the inter-chip resolution cache. */
export function _resetFixtureLookupCache(): void {
  cache.clear();
}
