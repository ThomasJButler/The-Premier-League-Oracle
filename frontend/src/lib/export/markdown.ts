import type { StoredPrediction } from '../../services/predictionTracker';
import {
  EXPORT_COLUMNS,
  MODEL_VERSION,
  buildFilename,
  formatExportTimestamp,
  predictionToExportRow,
  triggerBlobDownload,
  type ExportRow,
} from './shared';

function mdEscapeField(value: string | number): string {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function rowToMdLine(row: ExportRow): string {
  return `| ${EXPORT_COLUMNS.map((col) => mdEscapeField(row[col] as string | number)).join(' | ')} |`;
}

export function buildMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): string {
  const now = opts?.now ?? new Date();
  const settledCount = rows.filter((p) => p.actualResult !== undefined).length;
  const header =
    `# Premier League Oracle — Predictions Log\n` +
    `> Exported ${formatExportTimestamp(now)} · Model ${MODEL_VERSION} · ${settledCount} settled predictions\n\n`;

  const tableHeader = `| ${EXPORT_COLUMNS.join(' | ')} |`;
  const tableSeparator = `| ${EXPORT_COLUMNS.map(() => '---').join(' | ')} |`;

  if (rows.length === 0) return `${header}${tableHeader}\n${tableSeparator}\n`;

  const tableBody = rows.map((p) => rowToMdLine(predictionToExportRow(p))).join('\n');
  return `${header}${tableHeader}\n${tableSeparator}\n${tableBody}\n`;
}

export function exportMarkdown(rows: StoredPrediction[], opts?: { now?: Date }): void {
  const md = buildMarkdown(rows, opts);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const filename = buildFilename('markdown', opts?.now ?? new Date());
  triggerBlobDownload(blob, filename);
}
