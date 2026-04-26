import { describe, it, expect } from 'vitest';
import { filterPredictionLog, seasonStartFor } from './predictionFilters';
import type { StoredPrediction } from '../services/predictionTracker';

const mkPred = (id: string, matchDate: string): StoredPrediction => ({
  id,
  matchId: id,
  homeTeam: 'A',
  awayTeam: 'B',
  predictedResult: 'H',
  predictedHomeGoals: 1,
  predictedAwayGoals: 0,
  confidence: 0.6,
  timestamp: matchDate,
  matchDate,
});

describe('seasonStartFor', () => {
  it('returns Aug 1 of the current year when now is in Aug-Dec', () => {
    const start = seasonStartFor(new Date('2026-10-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns Aug 1 of the previous year when now is in Jan-Jul', () => {
    const start = seasonStartFor(new Date('2026-04-26T12:00:00Z'));
    expect(start.toISOString()).toBe('2025-08-01T00:00:00.000Z');
  });
});

describe('filterPredictionLog', () => {
  const now = new Date('2026-04-26T12:00:00Z');
  const preds: StoredPrediction[] = [
    mkPred('m1', '2026-04-25T14:00:00Z'),
    mkPred('m2', '2026-04-01T14:00:00Z'),
    mkPred('m3', '2026-02-01T14:00:00Z'),
    mkPred('m4', '2025-09-01T14:00:00Z'),
    mkPred('m5', '2025-07-01T14:00:00Z'),
  ];

  it('mode=all returns the input array unchanged (reference equality)', () => {
    expect(filterPredictionLog(preds, 'all', now)).toBe(preds);
  });

  it('mode=last30 keeps only matchDate within 30 days of now', () => {
    const out = filterPredictionLog(preds, 'last30', now);
    expect(out.map((p) => p.id)).toEqual(['m1', 'm2']);
  });

  it('mode=season keeps matchDate >= Aug 1 of the active season', () => {
    const out = filterPredictionLog(preds, 'season', now);
    expect(out.map((p) => p.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});
