import { describe, it, expect, vi } from 'vitest';
import { buildMarkdown, exportMarkdown } from './markdown';
import * as shared from './shared';
import type { StoredPrediction } from '../../services/predictionTracker';

const settled: StoredPrediction = {
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

const unsettled: StoredPrediction = {
  ...settled,
  actualResult: undefined,
  actualHomeGoals: undefined,
  actualAwayGoals: undefined,
  isCorrect: undefined,
};

describe('export/markdown', () => {
  it('buildMarkdown emits the spec header line + table header + separator + 1 row', () => {
    const md = buildMarkdown([settled], { now: new Date(2026, 3, 28) });
    expect(md).toContain('# Premier League Oracle — Predictions Log');
    expect(md).toContain('> Exported 2026-04-28 · Model v3.5-MVP · 1 settled predictions');
    expect(md).toContain('| gameweek | utcDate | home | away |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| 35 | 2026-04-20T15:00:00Z | Liverpool | Arsenal | HOME | 67.5 |');
  });

  it('buildMarkdown header counts only settled predictions', () => {
    const md = buildMarkdown([settled, unsettled], { now: new Date(2026, 3, 28) });
    expect(md).toContain('1 settled predictions');
  });

  it('buildMarkdown with empty rows emits header + table-shell only', () => {
    const md = buildMarkdown([], { now: new Date(2026, 3, 28) });
    expect(md).toContain('0 settled predictions');
    expect(md).toContain('| gameweek | utcDate |');
    expect(md).toContain('| --- |');
    expect(md.split('\n').filter((l) => l.startsWith('|'))).toHaveLength(2);
  });

  it('buildMarkdown escapes pipes and newlines in fields', () => {
    const piped = { ...settled, homeTeam: 'Pipe | Town', awayTeam: 'Multi\nLine' };
    const md = buildMarkdown([piped], { now: new Date(2026, 3, 28) });
    expect(md).toContain('Pipe \\| Town');
    expect(md).toContain('Multi<br>Line');
  });

  it('exportMarkdown composes buildMarkdown + triggerBlobDownload with text/markdown blob', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    exportMarkdown([settled], { now: new Date(2026, 3, 28) });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect((blob as Blob).type).toBe('text/markdown;charset=utf-8');
    expect(filename).toBe('predictions-log-2026-04-28.md');
    downloadSpy.mockRestore();
  });

  it('exportMarkdown falls back to Date.now() when opts.now is absent', () => {
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
    exportMarkdown([settled]);
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toMatch(/^predictions-log-2026-04-28\.md$/);
    downloadSpy.mockRestore();
    vi.useRealTimers();
  });
});
