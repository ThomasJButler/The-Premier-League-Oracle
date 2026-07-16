/**
 * The walk-forward evaluation protocol — the heart of the harness.
 *
 * Matches are replayed chronologically in match-date rounds: every adapter
 * forecasts ALL matches kicking off on date d before it observes the result
 * of ANY match played on d. Leakage (including the subtle same-day variety,
 * e.g. a 12:30 result informing a 17:30 forecast on a double-header Saturday)
 * is therefore structurally impossible — no adapter code can cheat even if
 * it wanted to.
 *
 * Pure orchestration: no fs, no wall-clock, no globals. Time is data time.
 */

import { summarize, type MetricSummary, type ScoredRecord } from '../engine/metrics';
import type { ArchiveMatch, PredictorAdapter } from './types';

export interface WalkForwardOptions {
  /** First season scored (inclusive), e.g. '2018-2019'. Earlier matches are
   *  warm-up: observed, never predicted. */
  evalFromSeason: string;
  /** Last season scored (inclusive). */
  evalToSeason: string;
}

export interface AdapterResult {
  name: string;
  /** Summary over every match the adapter forecast (abstentions excluded —
   *  compare `overall.n` with the report's `evalMatches`). */
  overall: MetricSummary;
  perSeason: Record<string, MetricSummary>;
  /** Raw scored records, for calibration curves and downstream weight
   *  fitting. Stripped before serialisation. */
  records: ScoredRecord[];
}

export interface BacktestReport {
  evalFromSeason: string;
  evalToSeason: string;
  /** Matches inside the evaluation window (the forecast opportunity count). */
  evalMatches: number;
  adapters: AdapterResult[];
}

/** UTC calendar date of a kickoff — the round-grouping key. */
function dateOf(m: ArchiveMatch): string {
  return m.kickoffISO.slice(0, 10);
}

export async function runWalkForward(
  archive: ArchiveMatch[],
  adapters: PredictorAdapter[],
  opts: WalkForwardOptions
): Promise<BacktestReport> {
  // Defensive stable sort — the loader already orders by kickoff, but the
  // protocol's correctness must not depend on caller discipline.
  const matches = [...archive].sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));

  const records = new Map<string, ScoredRecord[]>();
  for (const adapter of adapters) {
    records.set(adapter.name, []);
    await adapter.reset();
  }

  let evalMatches = 0;
  let i = 0;
  while (i < matches.length) {
    // One round = every match sharing a calendar date.
    const roundDate = dateOf(matches[i]);
    const roundEnd = ((): number => {
      let j = i;
      while (j < matches.length && dateOf(matches[j]) === roundDate) j++;
      return j;
    })();

    // Phase 1: forecast the whole round before any of its results exist.
    for (let k = i; k < roundEnd; k++) {
      const m = matches[k];
      if (m.seasonId < opts.evalFromSeason || m.seasonId > opts.evalToSeason) continue;
      evalMatches++;
      for (const adapter of adapters) {
        const p = await adapter.predict(m);
        if (p) {
          records.get(adapter.name)!.push({
            p,
            outcome: m.ftr,
            season: m.seasonId,
            matchId: m.id,
          });
        }
      }
    }

    // Phase 2: the round's results become history.
    for (let k = i; k < roundEnd; k++) {
      for (const adapter of adapters) {
        await adapter.observe(matches[k]);
      }
    }

    i = roundEnd;

    // Nothing after the evaluation window can affect any score — stop early.
    if (matches[i - 1].seasonId > opts.evalToSeason) break;
  }

  const results: AdapterResult[] = adapters.map((adapter) => {
    const recs = records.get(adapter.name)!;
    const bySeason = new Map<string, ScoredRecord[]>();
    for (const r of recs) {
      const bucket = bySeason.get(r.season) ?? [];
      bucket.push(r);
      bySeason.set(r.season, bucket);
    }
    const perSeason: Record<string, MetricSummary> = {};
    for (const season of [...bySeason.keys()].sort()) {
      perSeason[season] = summarize(bySeason.get(season)!);
    }
    return { name: adapter.name, overall: summarize(recs), perSeason, records: recs };
  });

  return {
    evalFromSeason: opts.evalFromSeason,
    evalToSeason: opts.evalToSeason,
    evalMatches,
    adapters: results,
  };
}
