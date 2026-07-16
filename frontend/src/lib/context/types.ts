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
  /** Mean ranked probability score over the scored set. Range [0, 1]. */
  rps: number;
  calibration: number;
  /** Settled predictions in the tracking window (hit-rate denominator). */
  sampleSize: number;
  /**
   * Settled predictions that carried a probability triple — the denominator
   * behind brier/rps. 0 means those numbers are meaningless, not perfect;
   * prompt builders must render "no scored sample yet" instead of citing them.
   */
  scoredSampleSize: number;
  /**
   * Where the numbers come from: 'live' = the user's tracked predictions;
   * 'backtest' = the Butler model's fit-time walk-forward evidence (used
   * until enough live predictions settle). Prompt builders label the two
   * differently — evidence provenance is part of honesty.
   */
  source?: 'live' | 'backtest';
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
