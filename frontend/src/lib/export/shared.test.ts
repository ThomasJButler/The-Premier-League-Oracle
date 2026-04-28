import { describe, it, expect, vi } from 'vitest';
import {
  predictionToExportRow,
  formatPickLabel,
  formatActualResultLabel,
  formatHitFlag,
  formatExportTimestamp,
  buildFilename,
  buildBinaryFilename,
  triggerBlobDownload,
  EXPORT_COLUMNS,
  MODEL_VERSION,
} from './shared';
import type { StoredPrediction } from '../../services/predictionTracker';

const settledHit: StoredPrediction = {
  id: 'p1', matchId: 'm1',
  homeTeam: 'Liverpool', awayTeam: 'Arsenal',
  predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1,
  confidence: 0.675,
  actualResult: 'H', actualHomeGoals: 2, actualAwayGoals: 1, isCorrect: true,
  timestamp: '2026-04-20T10:00:00Z', matchDate: '2026-04-20T15:00:00Z',
  matchday: 35, modelVersion: 'v3.5-MVP',
  poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
};

const unsettled: StoredPrediction = {
  ...settledHit,
  id: 'p2', matchId: 'm2', actualResult: undefined, actualHomeGoals: undefined,
  actualAwayGoals: undefined, isCorrect: undefined,
};

describe('export/shared', () => {
  it("EXPORT_COLUMNS has the spec's 13 columns in spec order", () => {
    expect(EXPORT_COLUMNS).toEqual([
      'gameweek', 'utcDate', 'home', 'away', 'pick', 'pickConfidence',
      'ensembleHome', 'ensembleDraw', 'ensembleAway', 'modelVersion',
      'settled', 'actualResult', 'hit',
    ]);
    expect(MODEL_VERSION).toBe('v3.5-MVP');
  });

  it('predictionToExportRow maps a settled hit row correctly', () => {
    const row = predictionToExportRow(settledHit);
    expect(row).toEqual({
      gameweek: 35, utcDate: '2026-04-20T15:00:00Z',
      home: 'Liverpool', away: 'Arsenal', pick: 'HOME', pickConfidence: 67.5,
      ensembleHome: 55, ensembleDraw: 25, ensembleAway: 20,
      modelVersion: 'v3.5-MVP', settled: 'true', actualResult: 'HOME', hit: '1',
    });
  });

  it('predictionToExportRow handles unsettled rows (empty strings, settled=false)', () => {
    const row = predictionToExportRow(unsettled);
    expect(row.settled).toBe('false');
    expect(row.actualResult).toBe('');
    expect(row.hit).toBe('');
  });

  it('predictionToExportRow handles missing matchday (legacy rows) and missing poissonProbs', () => {
    const legacy = { ...settledHit, matchday: undefined, poissonProbs: undefined, modelVersion: undefined };
    const row = predictionToExportRow(legacy);
    expect(row.gameweek).toBe('');
    expect(row.ensembleHome).toBe('');
    expect(row.ensembleDraw).toBe('');
    expect(row.ensembleAway).toBe('');
    expect(row.modelVersion).toBe('unknown');
  });

  it('formatPickLabel + formatActualResultLabel + formatHitFlag follow the H/D/A → HOME/DRAW/AWAY contract', () => {
    expect(formatPickLabel('H')).toBe('HOME');
    expect(formatPickLabel('D')).toBe('DRAW');
    expect(formatPickLabel('A')).toBe('AWAY');
    expect(formatActualResultLabel(undefined)).toBe('');
    expect(formatHitFlag(settledHit)).toBe('1');
    expect(formatHitFlag({ ...settledHit, isCorrect: false })).toBe('0');
    expect(formatHitFlag(unsettled)).toBe('');
  });

  it('formatExportTimestamp returns ISO date portion (local tz)', () => {
    expect(formatExportTimestamp(new Date(2026, 3, 28))).toBe('2026-04-28');
    expect(formatExportTimestamp(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  it('buildFilename emits predictions-log-YYYY-MM-DD.csv | .md', () => {
    const d = new Date(2026, 3, 28);
    expect(buildFilename('csv', d)).toBe('predictions-log-2026-04-28.csv');
    expect(buildFilename('markdown', d)).toBe('predictions-log-2026-04-28.md');
  });

  describe('buildBinaryFilename', () => {
    const d = new Date(2026, 3, 28);
    it('emits Log surface filename', () => {
      expect(buildBinaryFilename('pdf', d, { kind: 'log' })).toBe('predictions-log-2026-04-28.pdf');
    });
    it('emits ThisWeek surface filename with gameweek', () => {
      expect(buildBinaryFilename('pdf', d, { kind: 'this-week', gameweek: 35 }))
        .toBe('predictions-gw35-2026-04-28.pdf');
    });
    it('emits gw-grid PNG filename', () => {
      expect(buildBinaryFilename('png', d, { kind: 'gw-grid', gameweek: 35 }))
        .toBe('predictions-gw35-2026-04-28.png');
    });
    it('emits single-fixture PNG filename with matchId', () => {
      expect(buildBinaryFilename('png', d, { kind: 'single-fixture', matchId: 'm123' }))
        .toBe('predictions-m123-2026-04-28.png');
    });
  });

  it('triggerBlobDownload creates an object URL, clicks <a>, and revokes', () => {
    // jsdom doesn't ship URL.createObjectURL/revokeObjectURL — define them so vi.spyOn has
    // something to intercept. Restore by deleting after the test so other suites that may
    // patch the same globals don't see our shims.
    const urlAny = URL as unknown as Record<string, unknown>;
    urlAny.createObjectURL = () => 'blob:mock';
    urlAny.revokeObjectURL = () => {};
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = new Blob(['hello'], { type: 'text/csv' });
    triggerBlobDownload(blob, 'test.csv');
    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    delete urlAny.createObjectURL;
    delete urlAny.revokeObjectURL;
  });
});
