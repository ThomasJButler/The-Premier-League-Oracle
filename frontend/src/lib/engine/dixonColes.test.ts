import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fitDixonColes, lambdasFor, matchWeight, __internals } from './dixonColes';
import type { EngineMatch, FitOptions } from './types';

/** Parse the bundled 2023-24 full-season fixture (Date,HomeTeam,AwayTeam,FTHG,FTAG). */
function loadSeason(): EngineMatch[] {
  const text = readFileSync(resolve(__dirname, '../fixtures/epl-2023-2024-sample.csv'), 'utf-8');
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, home, away, fthg, ftag] = line.split(',');
      const [dd, mm, yyyy] = date.split('/');
      return {
        date: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T15:00:00Z`,
        home,
        away,
        homeGoals: Number(fthg),
        awayGoals: Number(ftag),
      };
    });
}

const FLAT_OPTS: FitOptions = {
  xi: 0, // equal weighting — a plain within-season fit
  sigma: 0.35,
  refDate: '2024-06-01T00:00:00Z',
  maxIter: 800,
};

describe('matchWeight', () => {
  it('halves every half-life and never exceeds 1', () => {
    const xi = Math.LN2 / 390;
    expect(matchWeight('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', xi)).toBe(1);
    // 390 days earlier → exactly one half-life.
    expect(matchWeight('2024-12-08T00:00:00Z', '2026-01-02T00:00:00Z', xi)).toBeCloseTo(0.5, 3);
    // Future-dated matches (clock skew) clamp to weight 1, never above.
    expect(matchWeight('2027-01-01T00:00:00Z', '2026-01-01T00:00:00Z', xi)).toBe(1);
  });
});

describe('analytic gradient vs finite differences — the mathematical spine', () => {
  // A tiny fixture that exercises every τ branch: 0-0, 1-0, 0-1, 1-1 plus
  // ordinary cells, across 4 teams.
  const matches: EngineMatch[] = [
    { date: '2026-01-03T15:00:00Z', home: 'A', away: 'B', homeGoals: 0, awayGoals: 0 },
    { date: '2026-01-10T15:00:00Z', home: 'B', away: 'C', homeGoals: 1, awayGoals: 0 },
    { date: '2026-01-17T15:00:00Z', home: 'C', away: 'D', homeGoals: 0, awayGoals: 1 },
    { date: '2026-01-24T15:00:00Z', home: 'D', away: 'A', homeGoals: 1, awayGoals: 1 },
    { date: '2026-01-31T15:00:00Z', home: 'A', away: 'C', homeGoals: 2, awayGoals: 1 },
    { date: '2026-02-07T15:00:00Z', home: 'B', away: 'D', homeGoals: 0, awayGoals: 3 },
    { date: '2026-02-14T15:00:00Z', home: 'C', away: 'A', homeGoals: 2, awayGoals: 2 },
    { date: '2026-02-21T15:00:00Z', home: 'D', away: 'B', homeGoals: 4, awayGoals: 0 },
  ];
  const opts: FitOptions = { xi: 0.002, sigma: 0.5, refDate: '2026-03-01T00:00:00Z' };

  it('every analytic partial matches central finite differences', () => {
    const data = __internals.prepare(matches, opts);
    const T = data.teams.length;
    const n = 3 + 2 * T;

    // A deliberately non-trivial, asymmetric point in parameter space.
    const theta = new Float64Array(n);
    theta[0] = 0.28; // μ
    theta[1] = 0.22; // γ
    theta[2] = -0.08; // ρ
    const attSeed = [0.2, -0.1, 0.05, -0.15];
    const defSeed = [-0.1, 0.15, 0.0, -0.05];
    for (let t = 0; t < T; t++) {
      theta[3 + t] = attSeed[t];
      theta[3 + T + t] = defSeed[t];
    }
    const priorAtt = new Float64Array(T);
    const priorDef = new Float64Array(T);

    const { grad } = __internals.evaluate(data, theta, opts.sigma, priorAtt, priorDef, false);

    const h = 1e-5;
    for (let k = 0; k < n; k++) {
      const plus = new Float64Array(theta);
      plus[k] += h;
      const minus = new Float64Array(theta);
      minus[k] -= h;
      const llPlus = __internals.evaluate(data, plus, opts.sigma, priorAtt, priorDef, false).ll;
      const llMinus = __internals.evaluate(data, minus, opts.sigma, priorAtt, priorDef, false).ll;
      const fd = (llPlus - llMinus) / (2 * h);
      expect(grad[k], `∂ll/∂θ[${k}]`).toBeCloseTo(fd, 5);
    }
  });

  it('freezeRho zeroes exactly the ρ gradient', () => {
    const data = __internals.prepare(matches, opts);
    const T = data.teams.length;
    const theta = new Float64Array(3 + 2 * T);
    theta[0] = 0.3;
    theta[2] = -0.05;
    const frozen = __internals.evaluate(data, theta, 0.5, new Float64Array(T), new Float64Array(T), true);
    expect(frozen.grad[2]).toBe(0);
  });
});

describe('fitting the real 2023-24 season', () => {
  const season = loadSeason();
  const fit = fitDixonColes(season, FLAT_OPTS);

  it('recovers the season narrative: City & Arsenal elite attacks, Sheffield United worst defence', () => {
    const entries = Object.entries(fit.params.teams);
    expect(entries).toHaveLength(20);
    expect(fit.effectiveMatches).toBe(380);

    const byAttack = [...entries].sort((a, b) => b[1].att - a[1].att).map(([name]) => name);
    // 2023-24 reality: City scored 96, Arsenal 91 — clear top-2 tier with Liverpool (86).
    expect(byAttack.slice(0, 3)).toContain('Man City');
    expect(byAttack.slice(0, 3)).toContain('Arsenal');

    const byLeakiness = [...entries].sort((a, b) => b[1].def - a[1].def).map(([name]) => name);
    // Sheffield United conceded 104 — worst by 19 goals. Unambiguous.
    expect(byLeakiness[0]).toBe('Sheffield United');
    // Arsenal had the league's best defence (29 conceded).
    expect(byLeakiness[byLeakiness.length - 1]).toBe('Arsenal');
  });

  it('fits globals in their literature ranges', () => {
    expect(fit.params.gamma).toBeGreaterThan(0.05);
    expect(fit.params.gamma).toBeLessThan(0.45);
    expect(fit.params.rho).toBeGreaterThanOrEqual(-0.2);
    expect(fit.params.rho).toBeLessThanOrEqual(0.02);
  });

  it('reproduces the empirical goal averages through the fitted rates', () => {
    let predHome = 0;
    let actualHome = 0;
    let predAway = 0;
    let actualAway = 0;
    for (const m of season) {
      const { home, away } = lambdasFor(fit.params, m.home, m.away, { att: 0, def: 0 });
      predHome += home;
      predAway += away;
      actualHome += m.homeGoals;
      actualAway += m.awayGoals;
    }
    // Mean fitted λ within 10% of empirical means (the lambdaValidation
    // criterion the old engine was held to).
    expect(predHome / season.length).toBeGreaterThan((actualHome / season.length) * 0.9);
    expect(predHome / season.length).toBeLessThan((actualHome / season.length) * 1.1);
    expect(predAway / season.length).toBeGreaterThan((actualAway / season.length) * 0.9);
    expect(predAway / season.length).toBeLessThan((actualAway / season.length) * 1.1);
  });

  it('is bit-for-bit deterministic', () => {
    const again = fitDixonColes(season, FLAT_OPTS);
    expect(JSON.stringify(again.params)).toBe(JSON.stringify(fit.params));
  });

  it('tighter shrinkage pulls team parameters toward the prior', () => {
    const loose = fitDixonColes(season, { ...FLAT_OPTS, sigma: 1.0 });
    const tight = fitDixonColes(season, { ...FLAT_OPTS, sigma: 0.05 });
    const maxAbsAtt = (teams: Record<string, { att: number }>) =>
      Math.max(...Object.values(teams).map((t) => Math.abs(t.att)));
    expect(maxAbsAtt(tight.params.teams)).toBeLessThan(maxAbsAtt(loose.params.teams));
  });

  it('warm starts converge fast and land where the cold fit landed', () => {
    const warm = fitDixonColes(season, { ...FLAT_OPTS, init: fit.params, maxIter: 60 });
    expect(warm.iterations).toBeLessThanOrEqual(60);
    expect(warm.logLikPerMatch).toBeCloseTo(fit.logLikPerMatch, 3);
    expect(warm.params.teams['Man City'].att).toBeCloseTo(fit.params.teams['Man City'].att, 2);
  });
});

describe('time decay changes what the model believes', () => {
  // Team X: thrashed in the old era, dominant in the recent one — WITH
  // venues balanced inside each era. (An earlier fixture had X at home in
  // every match, which made att_X unidentifiable from μ+γ; the shrinkage
  // prior then honestly zeroed it in BOTH fits. Attack strength is only
  // identified when a team is observed at both venues.)
  const matches: EngineMatch[] = [
    // Old era (~13–16 months before ref): Y wins home and away.
    { date: '2025-01-05T15:00:00Z', home: 'Y', away: 'X', homeGoals: 3, awayGoals: 0 },
    { date: '2025-02-05T15:00:00Z', home: 'X', away: 'Y', homeGoals: 0, awayGoals: 3 },
    { date: '2025-03-05T15:00:00Z', home: 'Y', away: 'X', homeGoals: 3, awayGoals: 0 },
    { date: '2025-04-05T15:00:00Z', home: 'X', away: 'Y', homeGoals: 0, awayGoals: 3 },
    // Recent era (days before ref): X wins home and away.
    { date: '2026-05-01T15:00:00Z', home: 'X', away: 'Y', homeGoals: 3, awayGoals: 0 },
    { date: '2026-05-03T15:00:00Z', home: 'Y', away: 'X', homeGoals: 0, awayGoals: 3 },
    { date: '2026-05-05T15:00:00Z', home: 'X', away: 'Y', homeGoals: 3, awayGoals: 0 },
    { date: '2026-05-07T15:00:00Z', home: 'Y', away: 'X', homeGoals: 0, awayGoals: 3 },
  ];
  const base: FitOptions = { xi: 0, sigma: 0.5, refDate: '2026-05-10T00:00:00Z', minWeight: 0 };

  it('a decayed fit rates the in-form team far higher than a flat fit', () => {
    const flat = fitDixonColes(matches, base);
    const decayed = fitDixonColes(matches, { ...base, xi: 0.01 }); // ~69-day half-life
    // Flat sees a symmetric 4-4 rivalry → near-equal ratings. Decayed sees
    // only the recent era → X clearly stronger.
    expect(decayed.params.teams['X'].att).toBeGreaterThan(flat.params.teams['X'].att + 0.25);
    expect(decayed.params.teams['Y'].att).toBeLessThan(flat.params.teams['Y'].att - 0.25);
  });
});

describe('promoted-team priors', () => {
  it('unknown teams take the fallback rating at prediction time', () => {
    const fit = fitDixonColes(loadSeason(), FLAT_OPTS);
    const promoted = { att: -0.2, def: 0.15 };
    const { home, away, homeRating } = lambdasFor(fit.params, 'Leeds', 'Arsenal', promoted);
    expect(homeRating).toEqual(promoted);
    // A promoted side at home to Arsenal: clear underdog rates.
    expect(home).toBeLessThan(away);
  });

  it('priorMeans anchor sparsely-observed teams', () => {
    // One match of data, strong prior — the posterior stays near the prior.
    const matches: EngineMatch[] = [
      { date: '2026-01-03T15:00:00Z', home: 'New FC', away: 'Old FC', homeGoals: 5, awayGoals: 0 },
    ];
    const fit = fitDixonColes(matches, {
      xi: 0,
      sigma: 0.1, // tight prior
      refDate: '2026-02-01T00:00:00Z',
      priorMeans: { 'Old FC': { att: 0, def: 0 } },
      promotedPrior: { att: -0.2, def: 0.15 },
    });
    // Despite a 5-0 win, the tight promoted prior keeps New FC's attack modest.
    expect(fit.params.teams['New FC'].att).toBeLessThan(0.3);
    expect(fit.params.teams['New FC'].att).toBeGreaterThan(-0.3);
  });
});
