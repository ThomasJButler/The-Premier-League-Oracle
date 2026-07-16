import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildKickerContext } from './buildKickerContext';
import type { FixtureContext, KickerContextPorts, StandingsRow, AccuracyStats } from './types';

const FIXED_NOW = new Date('2026-05-03T12:00:00.000Z');

const sampleFixture: FixtureContext = {
  id: 'gw34-liv-tot',
  home: 'LIV',
  away: 'TOT',
  kickoff: '2026-05-04T15:00:00.000Z',
  ourProb: { home: 0.62, draw: 0.21, away: 0.17 },
  marketImplied: { home: 0.55, draw: 0.24, away: 0.21 },
  valueEdge: 0.07
};

const sampleStanding: StandingsRow = {
  position: 1,
  team: 'LIV',
  played: 33,
  points: 78,
  goalDifference: 42
};

const sampleAccuracy: AccuracyStats = { brier: 0.18, rps: 0.19, calibration: 0.95, sampleSize: 320, scoredSampleSize: 300 };

function makePorts(overrides: Partial<KickerContextPorts> = {}): KickerContextPorts {
  return {
    getUpcomingFixtures: vi.fn(async () => [sampleFixture]),
    getStandings: vi.fn(async () => [sampleStanding]),
    getAccuracyStats: vi.fn(async () => sampleAccuracy),
    ...overrides
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('buildKickerContext', () => {
  it('aggregates all three ports on the happy path', async () => {
    const ports = makePorts();
    const ctx = await buildKickerContext(ports);

    expect(ctx.fixtures).toEqual([sampleFixture]);
    expect(ctx.standings).toEqual([sampleStanding]);
    expect(ctx.accuracyStats).toEqual(sampleAccuracy);
    expect(ctx.generatedAt).toBe(FIXED_NOW.toISOString());
  });

  it('defaults daysAhead to 7 when not specified', async () => {
    const ports = makePorts();
    await buildKickerContext(ports);
    expect(ports.getUpcomingFixtures).toHaveBeenCalledWith({ daysAhead: 7 });
  });

  it('passes through a custom daysAhead', async () => {
    const ports = makePorts();
    await buildKickerContext(ports, { daysAhead: 14 });
    expect(ports.getUpcomingFixtures).toHaveBeenCalledWith({ daysAhead: 14 });
  });

  it('skips standings when includeStandings is false', async () => {
    const getStandings = vi.fn(async () => [sampleStanding]);
    const ports = makePorts({ getStandings });
    const ctx = await buildKickerContext(ports, { includeStandings: false });

    expect(getStandings).not.toHaveBeenCalled();
    expect(ctx.standings).toEqual([]);
  });

  it('returns empty fixtures when the fixtures port rejects', async () => {
    const ports = makePorts({
      getUpcomingFixtures: vi.fn(async () => {
        throw new Error('football-data unavailable');
      })
    });
    const ctx = await buildKickerContext(ports);
    expect(ctx.fixtures).toEqual([]);
    // Other ports unaffected.
    expect(ctx.standings).toEqual([sampleStanding]);
  });

  it('returns zero-sample accuracy when the accuracy port rejects', async () => {
    const ports = makePorts({
      getAccuracyStats: vi.fn(async () => {
        throw new Error('localStorage offline');
      })
    });
    const ctx = await buildKickerContext(ports);
    expect(ctx.accuracyStats).toEqual({ brier: 0, rps: 0, calibration: 0, sampleSize: 0, scoredSampleSize: 0 });
  });

  it('preserves the absence of marketImplied for fixtures with no odds', async () => {
    const noOdds: FixtureContext = {
      ...sampleFixture,
      marketImplied: undefined,
      valueEdge: undefined
    };
    const ports = makePorts({ getUpcomingFixtures: vi.fn(async () => [noOdds]) });
    const ctx = await buildKickerContext(ports);
    expect(ctx.fixtures[0].marketImplied).toBeUndefined();
    expect(ctx.fixtures[0].valueEdge).toBeUndefined();
  });
});
