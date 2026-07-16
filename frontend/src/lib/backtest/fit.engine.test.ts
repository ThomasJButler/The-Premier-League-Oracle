/**
 * The Butler model fit pipeline. Env-gated dev tool:
 *
 *   npm run engine:fit --prefix frontend        (expect ~3–6 minutes)
 *
 * Steps, in strict no-leakage order:
 *  1. Estimate the promoted-team prior from 30+ years of promotions.
 *  2. Tune ξ (time decay) and σ (shrinkage) by walk-forward log-loss on the
 *     TUNE window (2010–2018) — coordinate search, TEST window untouched.
 *  3. Collect out-of-sample forecasts on TUNE with the winning config; fit
 *     the residual stack (ship-zero rule) and calibration (ship-identity
 *     rule) on those forecasts.
 *  4. Score the frozen pipeline on the TEST window (2018–2025) against the
 *     market and baselines — the honest generalisation numbers.
 *  5. Fit the final decayed + flat parameter sets on the full archive and
 *     write engine/coefficients.json (deterministic: anchored to data time).
 *
 * Paste the printed report into the PR that commits the coefficients.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadArchive } from './archiveLoader';
import { runWalkForward } from './walkForward';
import { dcAdapter, type DcRecord } from './adapters/dcAdapter';
import { leaguePriorAdapter, marketAdapter, uniformAdapter } from './baselines';
import { selectStack, fitCalibration } from './optimise';
import { renderLeagueTable, stableStringify } from './report';
import { fitDixonColes, matchWeight, DEFAULT_XI, DEFAULT_SIGMA } from '../engine/dixonColes';
import { ece as computeEce } from '../engine/metrics';
import { GRID_MAX } from '../engine/poisson';
import type { ArchiveMatch } from './types';
import type { Coefficients, EngineMatch, TeamRating } from '../engine/types';

const TUNE = { evalFromSeason: '2010-2011', evalToSeason: '2017-2018' };
const TEST = { evalFromSeason: '2018-2019', evalToSeason: '2024-2025' };

/** Coordinate-search grids (half-lives in days → ξ). */
const XI_GRID = [180, 270, 390, 540].map((halfLife) => Math.LN2 / halfLife);
const SIGMA_GRID = [0.2, 0.35, 0.5];

/** Conservative starting weight for the optional XGBoost log-odds blend —
 *  evaluated ONLINE via tracked predictions, not offline (the deployed
 *  joblib trained on our eval window, so an offline fit would leak). */
const DEFAULT_W_ML = 0.25;

const COEFFICIENTS_PATH = resolve(__dirname, '../engine/coefficients.json');

function toEngineMatches(archive: ArchiveMatch[]): EngineMatch[] {
  return archive.map((m) => ({
    date: m.kickoffISO,
    home: m.home,
    away: m.away,
    homeGoals: m.fthg,
    awayGoals: m.ftag,
  }));
}

/**
 * Empirical promoted-team prior: for every season with a predecessor in the
 * archive, flat-fit that season alone and collect the fitted (att, def) of
 * teams absent the season before. The mean over 30+ years of promotions is
 * the honest expectation for a club we know nothing else about.
 */
function estimatePromotedPrior(archive: ArchiveMatch[]): TeamRating {
  const seasons = [...new Set(archive.map((m) => m.seasonId))].sort();
  const bySeason = new Map<string, ArchiveMatch[]>();
  for (const m of archive) {
    const bucket = bySeason.get(m.seasonId) ?? [];
    bucket.push(m);
    bySeason.set(m.seasonId, bucket);
  }
  const teamsOf = (seasonId: string): Set<string> => {
    const teams = new Set<string>();
    for (const m of bySeason.get(seasonId) ?? []) {
      teams.add(m.home);
      teams.add(m.away);
    }
    return teams;
  };

  let attSum = 0;
  let defSum = 0;
  let n = 0;
  for (let s = 1; s < seasons.length; s++) {
    const matches = bySeason.get(seasons[s])!;
    // Skip in-progress seasons — partial data would bias the estimate.
    if (matches.length < 300) continue;
    const previous = teamsOf(seasons[s - 1]);
    const fit = fitDixonColes(toEngineMatches(matches), {
      xi: 0,
      sigma: DEFAULT_SIGMA,
      refDate: matches[matches.length - 1].kickoffISO,
      maxIter: 400,
    });
    for (const [team, rating] of Object.entries(fit.params.teams)) {
      if (!previous.has(team)) {
        attSum += rating.att;
        defSum += rating.def;
        n++;
      }
    }
  }
  const r6 = (x: number) => Number(x.toFixed(6));
  return { att: r6(attSum / Math.max(1, n)), def: r6(defSum / Math.max(1, n)) };
}

describe.runIf(process.env.FIT === '1')('Butler model fit pipeline', () => {
  it(
    'tunes, fits, validates, and emits coefficients.json',
    { timeout: 1_800_000 },
    async () => {
      const archive = loadArchive();
      const log = (msg: string) => console.log(msg); // eslint-disable-line no-console

      // ---- 1. Promoted prior --------------------------------------------
      const promotedPrior = estimatePromotedPrior(archive);
      log(`promoted-team prior: att ${promotedPrior.att}, def ${promotedPrior.def}`);
      expect(promotedPrior.att).toBeLessThan(0.1); // promoted sides score less…
      expect(promotedPrior.def).toBeGreaterThan(-0.1); // …and concede more

      // ---- 2. ξ/σ coordinate search on TUNE ------------------------------
      const tuneArchive = archive.filter((m) => m.seasonId <= TUNE.evalToSeason);
      const scoreConfig = async (xi: number, sigma: number): Promise<number> => {
        const report = await runWalkForward(
          tuneArchive,
          [dcAdapter({ name: 'dc', xi, sigma, promotedPrior })],
          TUNE
        );
        return report.adapters[0].overall.logLoss;
      };

      // Full grid — 12 combinations. A coordinate search (tune σ at fixed ξ,
      // then ξ at the winning σ) would be ~40% cheaper but can miss ξ×σ
      // interactions; a fit run is rare enough that exhaustive wins.
      let bestXi = DEFAULT_XI;
      let bestSigma = DEFAULT_SIGMA;
      let bestLoss = Number.POSITIVE_INFINITY;
      for (const xi of XI_GRID) {
        for (const sigma of SIGMA_GRID) {
          const loss = await scoreConfig(xi, sigma);
          log(`  half-life ${Math.round(Math.LN2 / xi)}d, σ ${sigma} → ${loss.toFixed(5)}`);
          if (loss < bestLoss) {
            bestLoss = loss;
            bestXi = xi;
            bestSigma = sigma;
          }
        }
      }
      log(`tuned: half-life ${Math.round(Math.LN2 / bestXi)}d, σ ${bestSigma} → ${bestLoss.toFixed(5)}`);

      // ---- 3. Stack + calibration on TUNE OOS forecasts ------------------
      const collected: DcRecord[] = [];
      await runWalkForward(
        tuneArchive,
        [dcAdapter({ name: 'dc-collect', xi: bestXi, sigma: bestSigma, promotedPrior, collect: collected })],
        TUNE
      );
      const { weights: stack, cv } = selectStack(collected);
      log(`stack CV log-loss — none ${cv.none.toFixed(5)}, form ${cv.form.toFixed(5)}, rest ${cv.rest.toFixed(5)}, both ${cv.both.toFixed(5)}`);
      log(`stack ships: wForm ${stack.wForm.toFixed(4)}, wRest ${stack.wRest.toFixed(4)}`);
      const calibration = fitCalibration(collected, stack);
      log(`calibration ships: T ${calibration.T.toFixed(4)}, cD ${calibration.cD.toFixed(4)}`);

      // ---- 4. Frozen pipeline on TEST vs market --------------------------
      const butlerRecords: DcRecord[] = [];
      const testReport = await runWalkForward(
        archive.filter((m) => m.seasonId <= TEST.evalToSeason),
        [
          dcAdapter({
            name: 'butler',
            xi: bestXi,
            sigma: bestSigma,
            promotedPrior,
            stack,
            calibration,
            collect: butlerRecords,
          }),
          marketAdapter(),
          leaguePriorAdapter(),
          uniformAdapter(),
        ],
        TEST
      );
      log('\n' + renderLeagueTable(testReport) + '\n');

      const butler = testReport.adapters.find((a) => a.name === 'butler')!;
      const market = testReport.adapters.find((a) => a.name === 'market')!;
      const prior = testReport.adapters.find((a) => a.name === 'league-prior')!;

      // Floors a competent goal model must clear, generously stated.
      expect(butler.overall.rps).toBeLessThan(prior.overall.rps);
      expect(butler.overall.logLoss).toBeLessThan(1.06);
      // Distance to the market ceiling — informational, printed not asserted.
      log(`Butler vs market RPS gap: ${(butler.overall.rps - market.overall.rps).toFixed(4)}`);

      const testEce = computeEce(butler.records);

      // ---- 5. Final fits + artifact --------------------------------------
      const engineMatches = toEngineMatches(archive);
      const newestDate = archive[archive.length - 1].kickoffISO;

      // Explicit prior means: promoted prior for clubs with almost no
      // decay-weighted history, league mean for everyone else.
      const weightByTeam = new Map<string, number>();
      for (const m of engineMatches) {
        const w = matchWeight(m.date, newestDate, bestXi);
        weightByTeam.set(m.home, (weightByTeam.get(m.home) ?? 0) + w);
        weightByTeam.set(m.away, (weightByTeam.get(m.away) ?? 0) + w);
      }
      const priorMeans: Record<string, TeamRating> = {};
      for (const [team, w] of weightByTeam) {
        priorMeans[team] = w < 5 ? promotedPrior : { att: 0, def: 0 };
      }

      const decayed = fitDixonColes(engineMatches, {
        xi: bestXi,
        sigma: bestSigma,
        refDate: newestDate,
        priorMeans,
      });
      // The "class" view: same model, a 4× slower memory — season-long
      // reputation rather than current form.
      const flat = fitDixonColes(engineMatches, {
        xi: bestXi / 4,
        sigma: bestSigma,
        refDate: newestDate,
        priorMeans,
      });
      log(`decayed fit: ${decayed.iterations} iters, ${decayed.effectiveMatches.toFixed(0)} effective matches`);

      const r6 = (x: number) => Number(x.toFixed(6));
      const roundParams = (p: typeof decayed.params) => ({
        mu: r6(p.mu),
        gamma: r6(p.gamma),
        rho: r6(p.rho),
        teams: Object.fromEntries(
          Object.entries(p.teams).map(([t, v]) => [t, { att: r6(v.att), def: r6(v.def) }])
        ),
      });

      const coefficients: Coefficients = {
        version: 1,
        fitAt: newestDate.slice(0, 10),
        hyper: { xi: r6(bestXi), sigma: bestSigma, gridMax: GRID_MAX },
        decayed: roundParams(decayed.params),
        flat: roundParams(flat.params),
        promotedPrior,
        stack: { wForm: r6(stack.wForm), wRest: r6(stack.wRest), wMl: DEFAULT_W_ML },
        calibration: { T: r6(calibration.T), cD: r6(calibration.cD) },
        backtest: {
          rps: r6(butler.overall.rps),
          brier: r6(butler.overall.brier),
          logLoss: r6(butler.overall.logLoss),
          accuracy: r6(butler.overall.accuracy),
          ece: r6(testEce),
          sampleSize: butler.overall.n,
          seasons: `${TEST.evalFromSeason}–${TEST.evalToSeason}`,
        },
      };

      writeFileSync(COEFFICIENTS_PATH, stableStringify(coefficients));
      log(`coefficients written → src/lib/engine/coefficients.json (fitAt ${coefficients.fitAt})`);

      // Sanity on the artifact itself.
      expect(Object.keys(coefficients.decayed.teams).length).toBeGreaterThan(25);
      expect(coefficients.decayed.gamma).toBeGreaterThan(0.05);
      expect(coefficients.decayed.gamma).toBeLessThan(0.45);
      expect(coefficients.decayed.rho).toBeLessThanOrEqual(0.02);
    }
  );
});
