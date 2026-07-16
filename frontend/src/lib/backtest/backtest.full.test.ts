/**
 * The full walk-forward backtest over the real 33-season archive.
 *
 * Env-gated dev tool, not CI: run with `npm run backtest --prefix frontend`.
 * Prints the league table and refreshes results/backtest-latest.json (a
 * deterministic artefact — commit its diff as the evidence for any engine
 * change).
 */

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadArchive } from './archiveLoader';
import { runWalkForward } from './walkForward';
import { allBaselines } from './baselines';
import { dcAdapter } from './adapters/dcAdapter';
import { renderLeagueTable, serializeReport } from './report';
import coefficients from '../engine/coefficients.json';

/** TEST window per the plan: tuned-on-nothing, reported-on-everything. */
const EVAL_FROM = '2018-2019';
const EVAL_TO = '2024-2025';

/**
 * The pre-Butler five-heuristic ensemble's final TEST-window measurement
 * (walk-forward, this window, recorded 2026-07-15 before its deletion —
 * see git history and backtest/pins.json for the pin-window twin). FROZEN:
 * the window is immutable, so this benchmark stays valid forever.
 */
const FROZEN_ENSEMBLE_TEST = { rps: 0.2062, brier: 0.5846, logLoss: 0.9843 };

const butlerFitted = coefficients.version >= 1;

describe.runIf(process.env.BACKTEST === '1')('full walk-forward backtest', () => {
  it(
    'scores the Butler model against the baselines and the bookmaker ceiling',
    { timeout: 600_000 },
    async () => {
      const archive = loadArchive();
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
        evalFromSeason: EVAL_FROM,
        evalToSeason: EVAL_TO,
      });

      // eslint-disable-next-line no-console
      console.log('\n' + renderLeagueTable(report) + '\n');

      const byName = Object.fromEntries(report.adapters.map((a) => [a.name, a.overall]));

      // 7 seasons × 380 matches; complete odds coverage in the modern era.
      expect(report.evalMatches).toBe(2660);
      expect(byName['market'].n).toBeGreaterThan(2600);

      // The sanity ordering that proves the protocol end-to-end.
      expect(byName['market'].rps).toBeLessThan(byName['league-prior'].rps);
      expect(byName['league-prior'].rps).toBeLessThan(byName['uniform'].rps);
      expect(byName['uniform'].rps).toBeLessThan(byName['always-home'].rps);

      // Literature anchors (loose): uniform ≈ 0.22–0.245 (exact value depends
      // on the era's H/D/A frequencies — measured 0.2404 on 2018–2025),
      // sharp books ≈ 0.19–0.21 (measured 0.1939).
      expect(byName['uniform'].rps).toBeGreaterThan(0.21);
      expect(byName['uniform'].rps).toBeLessThan(0.245);
      expect(byName['market'].rps).toBeLessThan(0.21);

      // ================= THE BUTLER GATE =================
      // "Only if it makes it better." The production engine must keep beating
      // the frozen pre-Butler ensemble on every proper score over this
      // window. (First passed 2026-07-15: 0.2000 / 0.5719 / 0.9648.)
      if (butlerFitted) {
        const butler = byName['butler'];
        expect(butler.n).toBe(report.evalMatches);
        expect(butler.rps, 'GATE: Butler must beat the frozen ensemble on RPS')
          .toBeLessThan(FROZEN_ENSEMBLE_TEST.rps);
        expect(butler.brier, 'GATE: Butler must beat the frozen ensemble on Brier')
          .toBeLessThan(FROZEN_ENSEMBLE_TEST.brier);
        expect(butler.logLoss, 'GATE: Butler must beat the frozen ensemble on log-loss')
          .toBeLessThan(FROZEN_ENSEMBLE_TEST.logLoss);
        // eslint-disable-next-line no-console
        console.log(
          `Butler vs market RPS gap: ${(butler.rps - byName['market'].rps).toFixed(4)}`
        );
      }

      const outDir = resolve(__dirname, 'results');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'backtest-latest.json'), serializeReport(report));
    }
  );
});
