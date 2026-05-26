import type { Standing } from '../../types';

/**
 * Newspaper-friendly team name.
 *
 * Football-Data.org returns full-form names ("Manchester City FC",
 * "Brighton & Hove Albion FC") that read awkwardly in tabloid headlines and
 * fixture rows. When a matching `Standing` is supplied we prefer its
 * `team.shortName` (the canonical short form from the data provider).
 * Otherwise we strip the trailing ` FC` suffix and collapse the
 * `& Hove Albion FC` suffix on Brighton to ` & Hove`.
 *
 * `AFC Bournemouth` is left unchanged — its `AFC` prefix is part of the
 * canonical short name, not a strippable suffix.
 */
export function displayTeam(name: string, standings?: Standing[]): string {
  if (!name) return name;

  if (standings && standings.length > 0) {
    const match = standings.find((s) => s.team.name === name);
    if (match?.team.shortName) return match.team.shortName;
  }

  return name
    .replace(/ & Hove Albion FC$/, ' & Hove')
    .replace(/ FC$/, '');
}
