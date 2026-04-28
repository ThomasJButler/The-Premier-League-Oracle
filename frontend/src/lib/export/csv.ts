import type { StoredPrediction } from '../../services/predictionTracker';
import {
  EXPORT_COLUMNS,
  buildFilename,
  predictionToExportRow,
  triggerBlobDownload,
  type ExportRow,
} from './shared';

const NEEDS_QUOTING = /[",\r\n]/;

function csvEscapeField(value: string | number): string {
  const s = String(value);
  if (!NEEDS_QUOTING.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function rowToCsvLine(row: ExportRow): string {
  return EXPORT_COLUMNS
    .map((col) => csvEscapeField(row[col] as string | number))
    .join(',');
}

export function buildCsv(rows: StoredPrediction[]): string {
  const header = EXPORT_COLUMNS.join(',');
  if (rows.length === 0) return `${header}\n`;
  const body = rows.map((p) => rowToCsvLine(predictionToExportRow(p))).join('\n');
  return `${header}\n${body}\n`;
}

export function exportCsv(rows: StoredPrediction[], opts?: { now?: Date }): void {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const filename = buildFilename('csv', opts?.now ?? new Date());
  triggerBlobDownload(blob, filename);
}
