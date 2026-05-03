// KickerContext — the structured payload injected into pundit system prompts
// and rendered on the Predictions / Today screens. Pure type module so it can
// be imported by both the API layer (server) and the screens (client) without
// pulling in the preserved/ engine bodies.

export interface FixtureContext {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  ourProb: { home: number; draw: number; away: number };
  marketImplied?: { home: number; draw: number; away: number };
  valueEdge?: number;
}

export interface StandingsRow {
  position: number;
  team: string;
  played: number;
  points: number;
  goalDifference: number;
}

export interface AccuracyStats {
  brier: number;
  calibration: number;
  sampleSize: number;
}

export interface KickerContext {
  fixtures: FixtureContext[];
  standings: StandingsRow[];
  accuracyStats: AccuracyStats;
  generatedAt: string;
}

export interface KickerContextPorts {
  getUpcomingFixtures: (opts: { daysAhead: number }) => Promise<FixtureContext[]>;
  getStandings: () => Promise<StandingsRow[]>;
  getAccuracyStats: () => Promise<AccuracyStats>;
}

export interface BuildKickerContextOptions {
  daysAhead?: number;
  includeStandings?: boolean;
}
