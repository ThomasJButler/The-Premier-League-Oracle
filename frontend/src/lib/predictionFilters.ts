import type { StoredPrediction } from '../services/predictionTracker';

export type LogFilterId = 'last30' | 'season' | 'all';

const MS_PER_DAY = 86_400_000;

/**
 * Premier League runs August → May. If `now` is in Aug-Dec, the active season
 * started this year's Aug 1; otherwise it started last year's Aug 1. Returns
 * midnight UTC at that boundary so timestamp comparisons stay timezone-stable.
 */
export function seasonStartFor(now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startYear = month >= 7 ? year : year - 1;
  return new Date(Date.UTC(startYear, 7, 1, 0, 0, 0, 0));
}

export function filterPredictionLog(
  preds: StoredPrediction[],
  mode: LogFilterId,
  now: Date = new Date(),
): StoredPrediction[] {
  if (mode === 'all') return preds;

  const cutoff = mode === 'last30'
    ? new Date(now.getTime() - 30 * MS_PER_DAY)
    : seasonStartFor(now);

  return preds.filter((p) => {
    const md = new Date(p.matchDate);
    return md >= cutoff;
  });
}
