/**
 * Shared types for the walk-forward backtest harness.
 *
 * The harness evaluates any forecaster that can implement PredictorAdapter —
 * the current TS ensemble, the Butler Dixon-Coles core, bookmaker odds, and
 * naive baselines all plug into the same protocol, so their scores are
 * directly comparable.
 */

import type { Outcome, ProbTriple } from '../engine/metrics';

/** Decimal odds for the three outcomes as quoted (overround included). */
export interface OddsTriple {
  home: number;
  draw: number;
  away: number;
}

/** One parsed row of the football-data.co.uk archive. */
export interface ArchiveMatch {
  /** Deterministic id: `${seasonId}#${rowIndex}` (row order within a season
   *  CSV is stable, so ids are reproducible across runs). */
  id: string;
  /** e.g. '2023-2024'. */
  seasonId: string;
  /** ISO-8601 kickoff. Time comes from the CSV's Time column (2019+) or a
   *  15:00 default — only the date component drives round grouping. */
  kickoffISO: string;
  /** CSV-canonical team names ("Man United"), kept as-is inside the harness. */
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  ftr: Outcome;
  referee?: string;
  /** Bookmaker odds by source, when the era's CSV carries them.
   *  psc = Pinnacle closing (2019+), ps = Pinnacle, avg = market average,
   *  b365 = Bet365 (2000+). */
  odds: {
    b365?: OddsTriple;
    ps?: OddsTriple;
    psc?: OddsTriple;
    avg?: OddsTriple;
  };
}

/**
 * A forecaster under evaluation.
 *
 * Protocol invariant (enforced by the runner, not by convention): predict()
 * for every match of date d is called before observe() of any match played
 * on d — same-day information leakage is structurally impossible.
 */
export interface PredictorAdapter {
  readonly name: string;
  /** Restore a fresh state (called once before the run). */
  reset(): void | Promise<void>;
  /** A result has become known — update internal state. Matches arrive in
   *  chronological order. */
  observe(m: ArchiveMatch): void | Promise<void>;
  /** Forecast an upcoming match. Return undefined to abstain (e.g. the
   *  market adapter on a row with no odds); abstentions are excluded from
   *  that adapter's summary, whose n is reported alongside. */
  predict(m: ArchiveMatch): ProbTriple | undefined | Promise<ProbTriple | undefined>;
}
