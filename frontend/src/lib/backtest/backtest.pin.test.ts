/**
 * The CI quality ratchet. Runs on every `npm run test -- --run` (no env
 * gate): replays the immutable pin window and asserts that no model listed
 * in pins.json has regressed beyond epsilon on RPS / Brier / log-loss.
 *
 * Improvements pass automatically; to ratchet the pins down to new (better)
 * values run:
 *
 *   npm run backtest:pins --prefix frontend
 *
 * and commit the pins.json diff alongside the change it validates. That diff
 * is the measure-first evidence the Butler plan is built on.
 *
 * FROZEN BENCHMARKS: pins.json entries with no adapter in the current run
 * (e.g. 'ensemble-v3.6' — the pre-Butler engine, deleted 2026-07-15 after
 * losing the gate) are never ratcheted or re-measured; they remain the
 * permanent bar. The pin window is IMMUTABLE — never extend it in place, or
 * frozen benchmarks stop being comparable.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadArchive } from './archiveLoader';
import { runWalkForward } from './walkForward';
import { allBaselines } from './baselines';
import { dcAdapter } from './adapters/dcAdapter';
import { renderLeagueTable, stableStringify } from './report';
import type { MetricSummary } from '../engine/metrics';
import pins from './pins.json';
import coefficients from '../engine/coefficients.json';

const ARCHIVE_DIR = resolve(__dirname, '../../../../backend/spreadsheets/KnowledgeFilesCSV');
const PINS_PATH = resolve(__dirname, 'pins.json');

const butlerFitted = coefficients.version >= 1;

interface PinEntry {
  rps: number;
  brier: number;
  logLoss: number;
  accuracy: number;
  n: number;
}

describe.runIf(existsSync(ARCHIVE_DIR))('backtest pin ratchet (CI)', () => {
  it(
    'no pinned model regresses on the immutable pin window',
    { timeout: 240_000 },
    async () => {
      const archive = loadArchive({ toSeason: pins.window.to });
      const adapters = [
        ...(butlerFitted
          ? [dcAdapter({
              name: 'butler',
              xi: coefficients.hyper.xi,
              sigma: coefficients.hyper.sigma,
              promotedPrior: coefficients.promotedPrior,
              stack: coefficients.stack,
              calibration: coefficients.calibration,
            })]
          : []),
        ...allBaselines(),
      ];
      const report = await runWalkForward(archive, adapters, {
        evalFromSeason: pins.window.from,
        evalToSeason: pins.window.to,
      });

      // eslint-disable-next-line no-console
      console.log('\n' + renderLeagueTable(report) + '\n');

      const byName = new Map(report.adapters.map((a) => [a.name, a.overall]));

      // Protocol sanity — these hold regardless of model quality and prove
      // the replay itself is intact.
      expect(report.evalMatches).toBe(1140);
      expect(byName.get('market')!.rps).toBeLessThan(byName.get('league-prior')!.rps);
      expect(byName.get('league-prior')!.rps).toBeLessThan(byName.get('uniform')!.rps);

      const current: Record<string, PinEntry> = {};
      for (const [name, s] of byName) {
        if (name === 'always-home') continue; // caricature baseline — not pinned
        current[name] = pinEntry(s);
      }

      if (process.env.UPDATE_PINS === '1') {
        // MERGE: models absent from this run (frozen benchmarks) survive.
        writeFileSync(
          PINS_PATH,
          stableStringify({ ...pins, models: { ...pins.models, ...current } })
        );
        // eslint-disable-next-line no-console
        console.log(`pins.json ratcheted: ${Object.keys(current).join(', ')}`);
        return;
      }

      const pinned = pins.models as Record<string, PinEntry>;
      // Pins were seeded at ship time (2026-07-15). An empty models map now
      // means someone gutted the ratchet — that must FAIL, not skip, or the
      // gate can be silently disarmed.
      expect(
        Object.keys(pinned).length,
        'pins.json has no seeded models — the quality ratchet has been disarmed'
      ).toBeGreaterThan(0);

      for (const [name, pin] of Object.entries(pinned)) {
        const now = current[name];
        if (!now) continue; // frozen benchmark — no adapter in this run
        expect(now.n, `${name}: scored-match count changed`).toBe(pin.n);
        expect(now.rps, `${name}: RPS regressed`).toBeLessThanOrEqual(pin.rps + pins.epsilon.rps);
        expect(now.brier, `${name}: Brier regressed`).toBeLessThanOrEqual(pin.brier + pins.epsilon.brier);
        expect(now.logLoss, `${name}: log-loss regressed`).toBeLessThanOrEqual(pin.logLoss + pins.epsilon.logLoss);
      }

      // THE GATE, permanently in CI: the Butler model must stay ahead of the
      // frozen pre-Butler ensemble on the pin window — "only if it makes it
      // better" as a standing assertion. (Measured 2026-07-15: butler
      // 0.201163 vs ensemble 0.203980 RPS.) With the engine fitted, every
      // prerequisite of this comparison must EXIST — a deleted frozen
      // benchmark or a missing butler run is a disarmed gate, not a pass.
      if (butlerFitted) {
        const frozenEnsemble = pinned['ensemble-v3.6'];
        expect(frozenEnsemble, 'frozen ensemble benchmark missing from pins.json').toBeDefined();
        expect(current['butler'], 'butler adapter produced no pin-window result').toBeDefined();
        expect(current['butler'].rps, 'GATE: Butler ≥ frozen ensemble on pin-window RPS')
          .toBeLessThan(frozenEnsemble.rps);
        expect(current['butler'].brier, 'GATE: Butler ≥ frozen ensemble on pin-window Brier')
          .toBeLessThan(frozenEnsemble.brier);
        expect(current['butler'].logLoss, 'GATE: Butler ≥ frozen ensemble on pin-window log-loss')
          .toBeLessThan(frozenEnsemble.logLoss);
      }
    }
  );
});

function pinEntry(s: MetricSummary): PinEntry {
  const r6 = (x: number) => Number(x.toFixed(6));
  return { rps: r6(s.rps), brier: r6(s.brier), logLoss: r6(s.logLoss), accuracy: r6(s.accuracy), n: s.n };
}
