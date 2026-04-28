import type { StoredPrediction } from '../../services/predictionTracker';

export { MODEL_VERSION } from '../../services/predictionTracker';

export interface ExportRow {
  gameweek: number | '';
  utcDate: string;
  home: string;
  away: string;
  pick: 'HOME' | 'DRAW' | 'AWAY';
  pickConfidence: number;
  ensembleHome: number | '';
  ensembleDraw: number | '';
  ensembleAway: number | '';
  modelVersion: string;
  settled: 'true' | 'false';
  actualResult: '' | 'HOME' | 'DRAW' | 'AWAY';
  hit: '' | '0' | '1';
}

export const EXPORT_COLUMNS = [
  'gameweek', 'utcDate', 'home', 'away', 'pick', 'pickConfidence',
  'ensembleHome', 'ensembleDraw', 'ensembleAway', 'modelVersion',
  'settled', 'actualResult', 'hit',
] as const satisfies ReadonlyArray<keyof ExportRow>;

const RESULT_LABEL = { H: 'HOME', D: 'DRAW', A: 'AWAY' } as const;

export function formatPickLabel(r: 'H' | 'D' | 'A'): 'HOME' | 'DRAW' | 'AWAY' {
  return RESULT_LABEL[r];
}

export function formatActualResultLabel(r: 'H' | 'D' | 'A' | undefined): '' | 'HOME' | 'DRAW' | 'AWAY' {
  return r ? RESULT_LABEL[r] : '';
}

export function formatHitFlag(p: StoredPrediction): '' | '0' | '1' {
  if (p.actualResult === undefined) return '';
  return p.isCorrect ? '1' : '0';
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function predictionToExportRow(p: StoredPrediction): ExportRow {
  const ens = p.poissonProbs;
  return {
    gameweek: p.matchday ?? '',
    utcDate: p.matchDate,
    home: p.homeTeam,
    away: p.awayTeam,
    pick: formatPickLabel(p.predictedResult),
    pickConfidence: round1(p.confidence * 100),
    ensembleHome: ens ? round1(ens.homeWin * 100) : '',
    ensembleDraw: ens ? round1(ens.draw * 100) : '',
    ensembleAway: ens ? round1(ens.awayWin * 100) : '',
    modelVersion: p.modelVersion ?? 'unknown',
    settled: p.actualResult !== undefined ? 'true' : 'false',
    actualResult: formatActualResultLabel(p.actualResult),
    hit: formatHitFlag(p),
  };
}

export function formatExportTimestamp(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildFilename(kind: 'csv' | 'markdown', now: Date): string {
  const ext = kind === 'csv' ? 'csv' : 'md';
  return `predictions-log-${formatExportTimestamp(now)}.${ext}`;
}

export type BinaryFilenameOpts =
  | { kind: 'log' | 'this-week'; gameweek?: number }
  | { kind: 'gw-grid'; gameweek: number }
  | { kind: 'single-fixture'; matchId: string };

export function buildBinaryFilename(
  format: 'png' | 'pdf',
  now: Date,
  opts: BinaryFilenameOpts,
): string {
  const date = formatExportTimestamp(now);
  switch (opts.kind) {
    case 'log':
      return `predictions-log-${date}.${format}`;
    case 'this-week':
      return opts.gameweek !== undefined
        ? `predictions-gw${opts.gameweek}-${date}.${format}`
        : `predictions-this-week-${date}.${format}`;
    case 'gw-grid':
      return `predictions-gw${opts.gameweek}-${date}.${format}`;
    case 'single-fixture':
      return `predictions-${opts.matchId}-${date}.${format}`;
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
