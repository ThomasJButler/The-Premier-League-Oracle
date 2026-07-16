// SSR-safety integration test for the production KickerContext path.
//
// SvelteKit invokes server-side load() functions and `+server.ts` endpoints in
// a Node environment with no `window`/`indexedDB` globals. The salvaged v3
// dataService guards IDB init with `typeof window === 'undefined'`, but we
// pin that guarantee here end-to-end: defaultPorts() wired to the real
// dataService + predictionTracker + OptimizedPredictor must NOT throw under
// SSR — every port that depends on a missing browser API must degrade to an
// empty/zero result via buildKickerContext's per-port .catch.
//
// This file deliberately runs in node (the default vitest env) — adding
// `// @vitest-environment jsdom` here would defeat the purpose.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildKickerContext } from './buildKickerContext';
import { defaultPorts } from './defaultPorts';
import { coefficients, getLiveParams, predictFixture } from '../engine';

describe('KickerContext SSR safety', () => {
  beforeAll(() => {
    // Node already has no `window`. Strip `indexedDB` (installed by
    // fake-indexeddb/auto in test-setup.ts) so we exercise the bare-server
    // path the SvelteKit runtime sees.
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    expect(typeof (globalThis as { indexedDB?: unknown }).indexedDB).toBe('undefined');
  });

  it('builds a degraded context without throwing when the browser env is absent', async () => {
    const ports = defaultPorts();
    const context = await buildKickerContext(ports, { daysAhead: 7 });

    // Without a Football-Data API key in process.env, dataService.getMatches /
    // getStandings throw — buildKickerContext swallows per port and yields
    // empty arrays / zeroed stats. The contract under SSR is "renders, just
    // empty", not "crashes".
    expect(context.fixtures).toEqual([]);
    expect(context.standings).toEqual([]);
    // accuracyStats: with no live tracked predictions, the context falls back
    // to the Butler coefficients' fit-time walk-forward evidence — labelled
    // 'backtest' so prompts cite it with provenance. (Before the engine was
    // fitted this used to be zeros; real evidence beats "no data".)
    expect(context.accuracyStats.source).toBe('backtest');
    expect(context.accuracyStats.scoredSampleSize).toBeGreaterThan(1000);
    expect(context.accuracyStats.rps).toBeGreaterThan(0.15);
    expect(context.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('the Butler engine predicts under bare SSR — no browser API in the whole path', () => {
    // The engine is pure by design: a static coefficients import plus math.
    // If anyone ever threads localStorage/fetch/window into the engine,
    // this is the test that catches it (window/indexedDB stripped above).
    const live = getLiveParams(coefficients, []);
    const p = predictFixture(coefficients, live, {
      home: 'Arsenal FC',
      away: 'Liverpool FC',
      kickoff: '2026-08-15T15:00:00Z',
    });
    expect(p.triple.home + p.triple.draw + p.triple.away).toBeCloseTo(1, 10);
    expect(p.entropy).toBeGreaterThan(0);
  });
});
