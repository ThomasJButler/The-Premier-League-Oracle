/**
 * Reference forecasters every real model must beat (or, for the market,
 * aspire to). All four are PredictorAdapters so they run through the same
 * leakage-proof walk-forward protocol as the models under test.
 */

import { normalizeTriple, type ProbTriple } from '../engine/metrics';
import type { ArchiveMatch, OddsTriple, PredictorAdapter } from './types';

const UNIFORM: ProbTriple = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };

/** Maximum ignorance: (⅓, ⅓, ⅓). The floor every model must clear. */
export function uniformAdapter(): PredictorAdapter {
  return {
    name: 'uniform',
    reset() {},
    observe() {},
    predict: () => ({ ...UNIFORM }),
  };
}

/**
 * Running league-wide outcome frequencies over every match observed so far
 * (converges to ~46/26/29 H/D/A). Warm-up seasons feed it via observe(), so
 * it is leakage-free by the same protocol as everything else. This is the
 * "knows football, knows nothing about the teams" baseline.
 */
export function leaguePriorAdapter(): PredictorAdapter {
  let h = 0;
  let d = 0;
  let a = 0;
  return {
    name: 'league-prior',
    reset() {
      h = 0;
      d = 0;
      a = 0;
    },
    observe(m: ArchiveMatch) {
      if (m.ftr === 'H') h++;
      else if (m.ftr === 'D') d++;
      else a++;
    },
    predict() {
      const total = h + d + a;
      if (total === 0) return { ...UNIFORM };
      return { home: h / total, draw: d / total, away: a / total };
    },
  };
}

/**
 * The degenerate "home team always wins" pundit. Reported for accuracy
 * context; for proper scores it is ε-smoothed (a literal 1/0/0 forecast has
 * infinite log-loss by construction, which would just render as noise).
 */
export function alwaysHomeAdapter(): PredictorAdapter {
  return {
    name: 'always-home',
    reset() {},
    observe() {},
    predict: () => ({ home: 0.98, draw: 0.01, away: 0.01 }),
  };
}

/** Preference order for odds sources: sharpest first. Pinnacle closing lines
 *  are the strongest publicly available forecast in existence. */
const ODDS_CASCADE: Array<keyof ArchiveMatch['odds']> = ['psc', 'ps', 'avg', 'b365'];

/** Strip the overround multiplicatively: p_k = (1/odds_k) / Σ_j (1/odds_j). */
export function deVig(odds: OddsTriple): ProbTriple | undefined {
  if (odds.home <= 1 || odds.draw <= 1 || odds.away <= 1) return undefined;
  return normalizeTriple({
    home: 1 / odds.home,
    draw: 1 / odds.draw,
    away: 1 / odds.away,
  });
}

/**
 * Bookmaker-implied probabilities — the ceiling reference. Bookmakers fold in
 * everything we cannot see (lineups, injuries, sharp money), so matching them
 * from public results data alone is the realistic best case, not a target.
 * Abstains (undefined) on rows without odds; its summary reports its own n.
 */
export function marketAdapter(): PredictorAdapter {
  return {
    name: 'market',
    reset() {},
    observe() {},
    predict(m: ArchiveMatch) {
      for (const source of ODDS_CASCADE) {
        const odds = m.odds[source];
        if (odds) {
          const p = deVig(odds);
          if (p) return p;
        }
      }
      return undefined;
    },
  };
}

/** The standard baseline set, fresh instances each call. */
export function allBaselines(): PredictorAdapter[] {
  return [uniformAdapter(), leaguePriorAdapter(), alwaysHomeAdapter(), marketAdapter()];
}
