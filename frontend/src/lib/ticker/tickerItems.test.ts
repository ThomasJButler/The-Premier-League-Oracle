import { describe, expect, it } from 'vitest';
import { buildTickerItems, type TickerInput } from './tickerItems';
import type { AccuracyStats } from '../context/types';

const BACKTEST: AccuracyStats = {
  brier: 0.571693,
  rps: 0.199961,
  calibration: 0.99,
  sampleSize: 2660,
  scoredSampleSize: 2660,
  source: 'backtest'
};

const LIVE: AccuracyStats = {
  brier: 0.214,
  rps: 0.198,
  calibration: 0.93,
  sampleSize: 20,
  scoredSampleSize: 12,
  source: 'live'
};

const LIVE_EMPTY: AccuracyStats = {
  brier: 0,
  rps: 0,
  calibration: 0.9,
  sampleSize: 0,
  scoredSampleSize: 0,
  source: 'live'
};

function input(overrides: Partial<TickerInput> = {}): TickerInput {
  return {
    fitted: true,
    currentGw: 33,
    fixtureCount: 7,
    stats: BACKTEST,
    personaName: 'The Voice',
    variant: 'desktop',
    ...overrides
  };
}

describe('buildTickerItems', () => {
  it('includes MODEL LIVE only when the model is fitted', () => {
    expect(buildTickerItems(input({ fitted: true }))).toContain('MODEL LIVE');
    expect(buildTickerItems(input({ fitted: false }))).not.toContain('MODEL LIVE');
  });

  it('reuses AWAITING SCHEDULE copy when no gameweek is resolved', () => {
    const items = buildTickerItems(input({ currentGw: null }));
    expect(items).toContain('AWAITING SCHEDULE');
    expect(items.join(' ')).not.toContain('GW');
  });

  it('desktop schedule item carries the fixture count', () => {
    const items = buildTickerItems(input({ currentGw: 33, fixtureCount: 7, variant: 'desktop' }));
    expect(items).toContain('GW33 - 7 FIXTURES');
  });

  it('mobile schedule item is just the gameweek number', () => {
    const items = buildTickerItems(input({ currentGw: 33, variant: 'mobile' }));
    expect(items).toContain('GW33');
    expect(items).not.toContain('GW33 - 7 FIXTURES');
  });

  it('labels backtest numbers as backtest and formats RPS to 3dp', () => {
    const items = buildTickerItems(input({ stats: BACKTEST, variant: 'desktop' }));
    expect(items).toContain('BACKTEST - 2660 MATCHES');
    expect(items).toContain('RPS 0.200');
    // The fake BRIER literal must never appear for backtest provenance.
    expect(items.join(' ')).not.toContain('0.198');
  });

  it('mobile trims the backtest sample label and keeps only RPS', () => {
    const items = buildTickerItems(input({ stats: BACKTEST, variant: 'mobile' }));
    expect(items).toContain('RPS 0.200');
    expect(items).not.toContain('BACKTEST - 2660 MATCHES');
  });

  it('presents live tracker numbers as live and formats BRIER to 2dp', () => {
    const desktop = buildTickerItems(input({ stats: LIVE, variant: 'desktop' }));
    expect(desktop).toContain('BRIER 0.21 - LIVE');
    const mobile = buildTickerItems(input({ stats: LIVE, variant: 'mobile' }));
    expect(mobile).toContain('BRIER 0.21');
    expect(mobile).not.toContain('BRIER 0.21 - LIVE');
  });

  it('shows no accuracy number when the live scored sample is empty', () => {
    const items = buildTickerItems(input({ stats: LIVE_EMPTY }));
    expect(items.join(' ')).not.toContain('BRIER');
    expect(items.join(' ')).not.toContain('RPS');
  });

  it('closes with the persona on duty, uppercased', () => {
    const items = buildTickerItems(input({ personaName: 'The Voice' }));
    expect(items[items.length - 1]).toBe('ON DUTY: THE VOICE');
  });

  it('omits the on-duty item when no persona is supplied', () => {
    const items = buildTickerItems(input({ personaName: '' }));
    expect(items.join(' ')).not.toContain('ON DUTY');
  });

  it('mobile returns fewer items than desktop for the same state', () => {
    const desktop = buildTickerItems(input({ variant: 'desktop' }));
    const mobile = buildTickerItems(input({ variant: 'mobile' }));
    expect(mobile.length).toBeLessThan(desktop.length);
  });
});
