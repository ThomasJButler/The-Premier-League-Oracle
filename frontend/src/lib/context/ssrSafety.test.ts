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
    // accuracyStats reads from predictionTracker (localStorage-backed). With no
    // stored predictions it returns sampleSize=0 — that's the only invariant
    // the SSR contract cares about; brier/calibration may be 0 or 1 depending
    // on how the tracker degrades, neither of which would crash a render.
    expect(context.accuracyStats.sampleSize).toBe(0);
    expect(context.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
