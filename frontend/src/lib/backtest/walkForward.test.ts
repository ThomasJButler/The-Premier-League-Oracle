import { describe, it, expect } from 'vitest';
import { runWalkForward } from './walkForward';
import { serializeReport, stableStringify, renderLeagueTable } from './report';
import { uniformAdapter } from './baselines';
import type { ArchiveMatch, PredictorAdapter } from './types';
import type { ProbTriple } from '../engine/metrics';

let counter = 0;
const match = (kickoffISO: string, seasonId: string, ftr: 'H' | 'D' | 'A'): ArchiveMatch => ({
  id: `${seasonId}#${counter++}`,
  seasonId,
  kickoffISO,
  home: 'Home',
  away: 'Away',
  fthg: ftr === 'H' ? 2 : ftr === 'D' ? 1 : 0,
  ftag: ftr === 'A' ? 2 : ftr === 'D' ? 1 : 0,
  ftr,
  odds: {},
});

/** Records the interleaving of predict/observe calls to prove the protocol. */
function spyAdapter(name = 'spy'): PredictorAdapter & { log: string[] } {
  const log: string[] = [];
  return {
    name,
    log,
    reset() {
      log.push('reset');
    },
    observe(m: ArchiveMatch) {
      log.push(`observe:${m.kickoffISO.slice(0, 10)}`);
    },
    predict(m: ArchiveMatch): ProbTriple {
      log.push(`predict:${m.kickoffISO.slice(0, 10)}`);
      return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
    },
  };
}

describe('runWalkForward — the leakage-proof protocol', () => {
  it('forecasts every match of a date before observing any result from that date', async () => {
    const spy = spyAdapter();
    // A double-header Saturday plus a Sunday fixture — the classic same-day
    // leakage scenario the round grouping exists to prevent.
    const archive = [
      match('2023-08-11T20:00:00Z', '2023-2024', 'H'),
      match('2023-08-12T12:30:00Z', '2023-2024', 'A'),
      match('2023-08-12T17:30:00Z', '2023-2024', 'D'),
      match('2023-08-13T14:00:00Z', '2023-2024', 'H'),
    ];

    await runWalkForward(archive, [spy], {
      evalFromSeason: '2023-2024',
      evalToSeason: '2023-2024',
    });

    expect(spy.log).toEqual([
      'reset',
      'predict:2023-08-11',
      'observe:2023-08-11',
      // Both Saturday matches are forecast BEFORE either Saturday result.
      'predict:2023-08-12',
      'predict:2023-08-12',
      'observe:2023-08-12',
      'observe:2023-08-12',
      'predict:2023-08-13',
      'observe:2023-08-13',
    ]);
  });

  it('warm-up matches are observed but never predicted', async () => {
    const spy = spyAdapter();
    const archive = [
      match('2022-08-06T15:00:00Z', '2022-2023', 'H'), // warm-up
      match('2023-08-12T15:00:00Z', '2023-2024', 'A'), // scored
    ];

    const report = await runWalkForward(archive, [spy], {
      evalFromSeason: '2023-2024',
      evalToSeason: '2023-2024',
    });

    expect(spy.log).toEqual([
      'reset',
      'observe:2022-08-06',
      'predict:2023-08-12',
      'observe:2023-08-12',
    ]);
    expect(report.evalMatches).toBe(1);
  });

  it('abstentions shrink the adapter n but not the window count', async () => {
    const abstainer: PredictorAdapter = {
      name: 'abstainer',
      reset() {},
      observe() {},
      predict: () => undefined,
    };
    const archive = [
      match('2023-08-12T15:00:00Z', '2023-2024', 'H'),
      match('2023-08-19T15:00:00Z', '2023-2024', 'A'),
    ];

    const report = await runWalkForward(archive, [abstainer, uniformAdapter()], {
      evalFromSeason: '2023-2024',
      evalToSeason: '2023-2024',
    });

    expect(report.evalMatches).toBe(2);
    expect(report.adapters[0].overall.n).toBe(0);
    expect(report.adapters[1].overall.n).toBe(2);
  });

  it('splits summaries per season and scores the uniform baseline at its known RPS', async () => {
    const archive = [
      match('2022-08-06T15:00:00Z', '2022-2023', 'H'),
      match('2022-08-13T15:00:00Z', '2022-2023', 'D'),
      match('2023-08-12T15:00:00Z', '2023-2024', 'A'),
    ];

    const report = await runWalkForward(archive, [uniformAdapter()], {
      evalFromSeason: '2022-2023',
      evalToSeason: '2023-2024',
    });

    const result = report.adapters[0];
    expect(Object.keys(result.perSeason)).toEqual(['2022-2023', '2023-2024']);
    expect(result.perSeason['2022-2023'].n).toBe(2);
    // Uniform RPS: H → 5/18, D → 1/9 (both hand-derived in metrics.test.ts).
    expect(result.perSeason['2022-2023'].rps).toBeCloseTo((5 / 18 + 1 / 9) / 2, 10);
    // A is symmetric with H under uniform: 5/18.
    expect(result.perSeason['2023-2024'].rps).toBeCloseTo(5 / 18, 10);
  });
});

describe('report serialization', () => {
  it('stableStringify sorts keys recursively for byte-identical output', () => {
    const a = stableStringify({ b: 1, a: { d: 2, c: [{ f: 3, e: 4 }] } });
    const b = stableStringify({ a: { c: [{ e: 4, f: 3 }], d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a.indexOf('"a"')).toBeLessThan(a.indexOf('"b"'));
  });

  it('serializeReport strips raw records and renders deterministically', async () => {
    const archive = [match('2023-08-12T15:00:00Z', '2023-2024', 'H')];
    const report = await runWalkForward(archive, [uniformAdapter()], {
      evalFromSeason: '2023-2024',
      evalToSeason: '2023-2024',
    });

    const json = serializeReport(report);
    expect(json).not.toContain('matchId');
    expect(JSON.parse(json).models.uniform.overall.n).toBe(1);
    // Running it twice yields identical bytes.
    expect(serializeReport(report)).toBe(json);
  });

  it('renders a league table sorted by RPS', async () => {
    const good: PredictorAdapter = {
      name: 'good',
      reset() {},
      observe() {},
      predict: () => ({ home: 0.8, draw: 0.15, away: 0.05 }),
    };
    const archive = [match('2023-08-12T15:00:00Z', '2023-2024', 'H')];
    const report = await runWalkForward(archive, [uniformAdapter(), good], {
      evalFromSeason: '2023-2024',
      evalToSeason: '2023-2024',
    });

    const table = renderLeagueTable(report);
    // The sharper model sits above the uniform baseline.
    expect(table.indexOf('good')).toBeLessThan(table.indexOf('uniform'));
    expect(table).toContain('1 matches');
  });
});
