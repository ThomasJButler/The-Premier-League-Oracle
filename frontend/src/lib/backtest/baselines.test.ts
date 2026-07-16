import { describe, it, expect } from 'vitest';
import {
  uniformAdapter,
  leaguePriorAdapter,
  alwaysHomeAdapter,
  marketAdapter,
  deVig,
  allBaselines,
} from './baselines';
import type { ArchiveMatch } from './types';

const match = (overrides: Partial<ArchiveMatch> = {}): ArchiveMatch => ({
  id: '1993-1994#0',
  seasonId: '1993-1994',
  kickoffISO: '1993-08-14T15:00:00Z',
  home: 'Arsenal',
  away: 'Coventry',
  fthg: 0,
  ftag: 3,
  ftr: 'A',
  odds: {},
  ...overrides,
});

describe('uniformAdapter', () => {
  it('always forecasts ⅓/⅓/⅓', () => {
    const adapter = uniformAdapter();
    expect(adapter.predict(match())).toEqual({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 });
  });
});

describe('leaguePriorAdapter', () => {
  it('starts uniform, then tracks running outcome frequencies', () => {
    const adapter = leaguePriorAdapter();
    adapter.reset();
    expect(adapter.predict(match())).toEqual({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 });

    adapter.observe(match({ ftr: 'H' }));
    adapter.observe(match({ ftr: 'H' }));
    adapter.observe(match({ ftr: 'D' }));
    adapter.observe(match({ ftr: 'A' }));
    expect(adapter.predict(match())).toEqual({ home: 0.5, draw: 0.25, away: 0.25 });
  });

  it('reset clears the counts', () => {
    const adapter = leaguePriorAdapter();
    adapter.observe(match({ ftr: 'H' }));
    adapter.reset();
    expect(adapter.predict(match())).toEqual({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 });
  });
});

describe('alwaysHomeAdapter', () => {
  it('forecasts the ε-smoothed home banker', () => {
    expect(alwaysHomeAdapter().predict(match())).toEqual({ home: 0.98, draw: 0.01, away: 0.01 });
  });
});

describe('deVig', () => {
  it('inverts margin-free odds exactly', () => {
    // 1/2 + 1/3 + 1/6 = 1 — a bookmaker with zero overround.
    const p = deVig({ home: 2, draw: 3, away: 6 })!;
    expect(p.home).toBeCloseTo(0.5, 10);
    expect(p.draw).toBeCloseTo(1 / 3, 10);
    expect(p.away).toBeCloseTo(1 / 6, 10);
  });

  it('strips a realistic overround multiplicatively', () => {
    // 1/1.9 + 1/3.4 + 1/4.2 ≈ 1.0585 (≈5.9% overround).
    const p = deVig({ home: 1.9, draw: 3.4, away: 4.2 })!;
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
    expect(p.home).toBeCloseTo(0.4972, 4);
    expect(p.draw).toBeCloseTo(0.2779, 4);
    expect(p.away).toBeCloseTo(0.2249, 4);
  });

  it('rejects degenerate odds at or below 1.0', () => {
    expect(deVig({ home: 1.0, draw: 3.4, away: 4.2 })).toBeUndefined();
    expect(deVig({ home: 0, draw: 3.4, away: 4.2 })).toBeUndefined();
  });
});

describe('marketAdapter', () => {
  it('prefers Pinnacle closing over earlier/softer sources', async () => {
    const adapter = marketAdapter();
    const m = match({
      odds: {
        b365: { home: 2.1, draw: 3.3, away: 3.6 },
        psc: { home: 2.0, draw: 3.0, away: 6.0 },
      },
    });
    // psc wins the cascade — margin-free (2, 3, 6) inverts exactly.
    const p = (await adapter.predict(m))!;
    expect(p.home).toBeCloseTo(0.5, 10);
  });

  it('falls back down the cascade when sharper sources are absent', async () => {
    const adapter = marketAdapter();
    const p = (await adapter.predict(match({ odds: { b365: { home: 2, draw: 3, away: 6 } } })))!;
    expect(p.home).toBeCloseTo(0.5, 10);
  });

  it('abstains on odds-free rows (the 1993–2000 era)', async () => {
    expect(await marketAdapter().predict(match())).toBeUndefined();
  });
});

describe('allBaselines', () => {
  it('returns the four standard baselines as fresh instances', () => {
    const names = allBaselines().map((b) => b.name);
    expect(names).toEqual(['uniform', 'league-prior', 'always-home', 'market']);
  });
});
