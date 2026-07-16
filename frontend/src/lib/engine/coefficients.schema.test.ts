/**
 * Guards the committed coefficients artifact. Skips politely while the
 * placeholder (version 0) is in place; once `npm run engine:fit` has minted
 * real coefficients, every assertion here runs in normal CI — catching stale
 * fits, team-name drift, and corrupted artifacts before they ship.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import coefficients from './coefficients.json';
import { isKnownCsvTeam } from './teamNames';
import { loadArchive } from '../backtest/archiveLoader';

const ARCHIVE_DIR = resolve(__dirname, '../../../../backend/spreadsheets/KnowledgeFilesCSV');
const fitted = coefficients.version >= 1;

describe.runIf(fitted)('coefficients.json — fitted artifact schema', () => {
  it('carries finite, literature-plausible global parameters in both sets', () => {
    for (const params of [coefficients.decayed, coefficients.flat]) {
      expect(Number.isFinite(params.mu)).toBe(true);
      expect(params.gamma).toBeGreaterThan(0.05);
      expect(params.gamma).toBeLessThan(0.45);
      expect(params.rho).toBeGreaterThanOrEqual(-0.2);
      expect(params.rho).toBeLessThanOrEqual(0.05);
    }
  });

  it('rates a full league of known teams with finite, shrunk parameters', () => {
    for (const params of [coefficients.decayed, coefficients.flat]) {
      const teams = Object.entries(params.teams as Record<string, { att: number; def: number }>);
      expect(teams.length).toBeGreaterThan(25);
      for (const [name, rating] of teams) {
        expect(isKnownCsvTeam(name), `unknown team key "${name}"`).toBe(true);
        expect(Number.isFinite(rating.att)).toBe(true);
        expect(Number.isFinite(rating.def)).toBe(true);
        // No team is 3 log-goals from average — that would be a broken fit.
        expect(Math.abs(rating.att)).toBeLessThan(1.5);
        expect(Math.abs(rating.def)).toBeLessThan(1.5);
      }
    }
  });

  it('carries sane stack, blend, and calibration parameters', () => {
    expect(Math.abs(coefficients.stack.wForm)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(coefficients.stack.wRest)).toBeLessThanOrEqual(0.3);
    expect(coefficients.stack.wMl).toBeGreaterThanOrEqual(0);
    expect(coefficients.stack.wMl).toBeLessThanOrEqual(1);
    expect(coefficients.calibration.T).toBeGreaterThan(0.5);
    expect(coefficients.calibration.T).toBeLessThan(2);
    expect(Math.abs(coefficients.calibration.cD)).toBeLessThanOrEqual(0.5);
  });

  it('records real walk-forward evidence', () => {
    expect(coefficients.backtest.sampleSize).toBeGreaterThan(1000);
    expect(coefficients.backtest.rps).toBeGreaterThan(0.15);
    expect(coefficients.backtest.rps).toBeLessThan(0.25);
  });
});

describe.runIf(fitted && existsSync(ARCHIVE_DIR))('coefficients.json vs the live archive', () => {
  it('covers every team in the newest season and is anchored to the newest result', () => {
    const archive = loadArchive();
    const newestSeason = archive[archive.length - 1].seasonId;
    const currentTeams = new Set<string>();
    for (const m of archive) {
      if (m.seasonId !== newestSeason) continue;
      currentTeams.add(m.home);
      currentTeams.add(m.away);
    }
    for (const team of currentTeams) {
      expect(coefficients.decayed.teams, `current club "${team}" missing from fit`)
        .toHaveProperty([team]);
    }
    // Stale-fit detector: the artifact must be anchored to the archive's
    // newest result. If CSVs were refreshed without re-fitting, this fails.
    expect(coefficients.fitAt).toBe(archive[archive.length - 1].kickoffISO.slice(0, 10));
  });
});

describe.runIf(!fitted)('coefficients.json — placeholder', () => {
  it('reminds that the engine is unfitted', () => {
    // eslint-disable-next-line no-console
    console.warn('coefficients.json is the unfitted placeholder — run: npm run engine:fit --prefix frontend');
    expect(coefficients.version).toBe(0);
  });
});
