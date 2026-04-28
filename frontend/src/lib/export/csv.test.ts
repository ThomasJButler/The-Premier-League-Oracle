import { describe, it, expect, vi } from 'vitest';
import { buildCsv, exportCsv } from './csv';
import * as shared from './shared';
import type { StoredPrediction } from '../../services/predictionTracker';

const sample: StoredPrediction = {
  id: 'p1',
  matchId: 'm1',
  homeTeam: 'Liverpool',
  awayTeam: 'Arsenal',
  predictedResult: 'H',
  predictedHomeGoals: 2,
  predictedAwayGoals: 1,
  confidence: 0.675,
  actualResult: 'H',
  actualHomeGoals: 2,
  actualAwayGoals: 1,
  isCorrect: true,
  timestamp: '2026-04-20T10:00:00Z',
  matchDate: '2026-04-20T15:00:00Z',
  matchday: 35,
  modelVersion: 'v3.5-MVP',
  poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
};

const sampleQuoted: StoredPrediction = {
  ...sample,
  id: 'p2',
  matchId: 'm2',
  homeTeam: 'Foo, FC',
  awayTeam: 'Quote "Bar" United',
};

describe('export/csv', () => {
  it('buildCsv emits a header row in spec order then one row per prediction', () => {
    const out = buildCsv([sample]);
    const [header, body] = out.trimEnd().split('\n');
    expect(header).toBe(
      'gameweek,utcDate,home,away,pick,pickConfidence,ensembleHome,ensembleDraw,ensembleAway,modelVersion,settled,actualResult,hit',
    );
    expect(body).toBe(
      '35,2026-04-20T15:00:00Z,Liverpool,Arsenal,HOME,67.5,55,25,20,v3.5-MVP,true,HOME,1',
    );
  });

  it('buildCsv with empty rows emits header-only output', () => {
    expect(buildCsv([])).toBe(
      'gameweek,utcDate,home,away,pick,pickConfidence,ensembleHome,ensembleDraw,ensembleAway,modelVersion,settled,actualResult,hit\n',
    );
  });

  it('buildCsv RFC-4180-escapes commas, quotes, and newlines', () => {
    const out = buildCsv([sampleQuoted]);
    const [, body] = out.trimEnd().split('\n');
    expect(body).toContain('"Foo, FC"');
    expect(body).toContain('"Quote ""Bar"" United"');
  });

  it('buildCsv handles unsettled rows (empty actualResult, empty hit, settled=false)', () => {
    const unsettled: StoredPrediction = {
      ...sample,
      actualResult: undefined,
      actualHomeGoals: undefined,
      actualAwayGoals: undefined,
      isCorrect: undefined,
    };
    const out = buildCsv([unsettled]);
    const [, body] = out.trimEnd().split('\n');
    expect(body.endsWith(',false,,')).toBe(true);
  });

  it('exportCsv composes buildCsv + triggerBlobDownload with the right filename', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    const now = new Date(2026, 3, 28);
    exportCsv([sample], { now });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe('predictions-log-2026-04-28.csv');
    expect((blob as Blob).type).toBe('text/csv;charset=utf-8');
    downloadSpy.mockRestore();
  });

  it('exportCsv falls back to Date.now() when opts.now is absent', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
    exportCsv([sample]);
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toMatch(/^predictions-log-2026-04-28\.csv$/);
    downloadSpy.mockRestore();
    vi.useRealTimers();
  });
});
