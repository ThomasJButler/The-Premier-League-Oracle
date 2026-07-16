/**
 * Team-name canonicalisation for the Butler engine.
 *
 * The engine's fitted coefficients are keyed by football-data.co.uk CSV names
 * ("Man United", "Nott'm Forest") because those are stable across the entire
 * 33-season archive. At runtime the app speaks Football-Data.org API v4 names
 * ("Manchester United FC"), and chat surfaces speak in short forms ("spurs").
 * This module resolves all of them to the CSV canonical form.
 *
 * Deliberately standalone — it does NOT import statsPack.ts, whose module-level
 * `import statsPack.json` would drag 1.5 MB into the engine's import graph.
 * The 25-entry API alias table is small enough to own outright.
 */

/** Every distinct team name across the 33 CSV seasons (1993/94–2025/26). */
export const KNOWN_CSV_TEAMS: readonly string[] = [
  'Arsenal', 'Aston Villa', 'Barnsley', 'Birmingham', 'Blackburn', 'Blackpool',
  'Bolton', 'Bournemouth', 'Bradford', 'Brentford', 'Brighton', 'Burnley',
  'Cardiff', 'Charlton', 'Chelsea', 'Coventry', 'Crystal Palace', 'Derby',
  'Everton', 'Fulham', 'Huddersfield', 'Hull', 'Ipswich', 'Leeds', 'Leicester',
  'Liverpool', 'Luton', 'Man City', 'Man United', 'Middlesbrough', 'Newcastle',
  'Norwich', "Nott'm Forest", 'Oldham', 'Portsmouth', 'QPR', 'Reading',
  'Sheffield United', 'Sheffield Weds', 'Southampton', 'Stoke', 'Sunderland',
  'Swansea', 'Swindon', 'Tottenham', 'Watford', 'West Brom', 'West Ham',
  'Wigan', 'Wimbledon', 'Wolves',
];

const KNOWN_SET = new Set(KNOWN_CSV_TEAMS);

/** Football-Data.org API v4 names → CSV canonical. Mirrors (and must stay in
 *  sync with) API_TO_CSV_ALIAS in lib/data/statsPack.ts. */
const API_TO_CSV: Record<string, string> = {
  'Arsenal FC': 'Arsenal',
  'Aston Villa FC': 'Aston Villa',
  'AFC Bournemouth': 'Bournemouth',
  'Brentford FC': 'Brentford',
  'Brighton & Hove Albion FC': 'Brighton',
  'Burnley FC': 'Burnley',
  'Chelsea FC': 'Chelsea',
  'Crystal Palace FC': 'Crystal Palace',
  'Everton FC': 'Everton',
  'Fulham FC': 'Fulham',
  'Leeds United FC': 'Leeds',
  'Leicester City FC': 'Leicester',
  'Liverpool FC': 'Liverpool',
  'Luton Town FC': 'Luton',
  'Manchester City FC': 'Man City',
  'Manchester United FC': 'Man United',
  'Newcastle United FC': 'Newcastle',
  'Norwich City FC': 'Norwich',
  'Nottingham Forest FC': "Nott'm Forest",
  'Ipswich Town FC': 'Ipswich',
  'Sheffield United FC': 'Sheffield United',
  'Southampton FC': 'Southampton',
  'Sunderland AFC': 'Sunderland',
  'Tottenham Hotspur FC': 'Tottenham',
  'Watford FC': 'Watford',
  'West Bromwich Albion FC': 'West Brom',
  'West Ham United FC': 'West Ham',
  'Wolverhampton Wanderers FC': 'Wolves',
  'Queens Park Rangers FC': 'QPR',
};

/** Lowercase short/colloquial forms → CSV canonical (chat + legacy inputs). */
const SHORT_ALIASES: Record<string, string> = {
  'man utd': 'Man United',
  'manchester united': 'Man United',
  'manchester city': 'Man City',
  'spurs': 'Tottenham',
  'tottenham hotspur': 'Tottenham',
  'nottm forest': "Nott'm Forest",
  'nottingham forest': "Nott'm Forest",
  'forest': "Nott'm Forest",
  'wolverhampton wanderers': 'Wolves',
  'wolverhampton': 'Wolves',
  'brighton & hove albion': 'Brighton',
  'brighton and hove albion': 'Brighton',
  'west bromwich albion': 'West Brom',
  'west bromwich': 'West Brom',
  'sheffield utd': 'Sheffield United',
  'sheffield wednesday': 'Sheffield Weds',
  'queens park rangers': 'QPR',
  'newcastle united': 'Newcastle',
  'west ham united': 'West Ham',
  'leeds united': 'Leeds',
  'leicester city': 'Leicester',
  'norwich city': 'Norwich',
  'ipswich town': 'Ipswich',
  'luton town': 'Luton',
  'hull city': 'Hull',
  'cardiff city': 'Cardiff',
  'stoke city': 'Stoke',
  'swansea city': 'Swansea',
  'birmingham city': 'Birmingham',
  'coventry city': 'Coventry',
  'derby county': 'Derby',
  'blackburn rovers': 'Blackburn',
  'bolton wanderers': 'Bolton',
  'charlton athletic': 'Charlton',
  'wigan athletic': 'Wigan',
  'oldham athletic': 'Oldham',
  'bradford city': 'Bradford',
  'huddersfield town': 'Huddersfield',
  'swindon town': 'Swindon',
};

/** Case-insensitive index of the canonical names themselves. */
const LOWER_CANONICAL = new Map(KNOWN_CSV_TEAMS.map((t) => [t.toLowerCase(), t]));

/**
 * Resolve any team-name form (CSV canonical, API v4, short/colloquial) to the
 * CSV canonical name the engine's coefficients are keyed by.
 *
 * Returns undefined for genuinely unknown teams — callers decide the fallback
 * (the engine applies its promoted-team prior and logs a warning, so a naming
 * drift is visible rather than silently absorbed).
 */
export function toCsvName(name: string): string | undefined {
  if (KNOWN_SET.has(name)) return name;
  if (API_TO_CSV[name]) return API_TO_CSV[name];

  const lower = name.trim().toLowerCase();
  const direct = LOWER_CANONICAL.get(lower) ?? SHORT_ALIASES[lower];
  if (direct) return direct;

  // Strip API-style affixes ("... FC", "... AFC", "AFC ...") and retry once.
  const stripped = lower.replace(/\s+(fc|afc)$/, '').replace(/^afc\s+/, '');
  if (stripped !== lower) {
    return LOWER_CANONICAL.get(stripped) ?? SHORT_ALIASES[stripped];
  }
  return undefined;
}

export function isKnownCsvTeam(name: string): boolean {
  return KNOWN_SET.has(name);
}
