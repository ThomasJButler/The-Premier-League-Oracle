import {
  buildBinaryFilename,
  triggerBlobDownload,
  MODEL_VERSION,
  type BinaryFilenameOpts,
} from './shared';

export type PdfKind = 'log' | 'this-week';

export interface PdfOpts {
  kind: PdfKind;
  gameweek?: number;
}

export interface JsPdfDocLike {
  addImage: (...args: unknown[]) => void;
  text: (...args: unknown[]) => void;
  output: (kind: 'blob') => Blob;
  save: (filename: string) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}

function buildFooterText(opts: PdfOpts): string {
  const tail =
    opts.kind === 'this-week'
      ? `Predictions for GW${opts.gameweek}`
      : 'Predictions Log';
  return `Premier League Oracle · Model ${MODEL_VERSION} · ${tail}`;
}

function toFilenameOpts(opts: PdfOpts): BinaryFilenameOpts {
  if (opts.kind === 'log') return { kind: 'log' };
  return { kind: 'this-week', gameweek: opts.gameweek };
}

export async function buildPdfDocument(
  target: HTMLElement,
  opts: PdfOpts,
): Promise<JsPdfDocLike> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(target, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    scale: 2,
  });
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as unknown as JsPdfDocLike;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.addImage(canvas, 'PNG', 0, 0, w, h);
  doc.text(buildFooterText(opts), w / 2, h - 5, { align: 'center' });
  return doc;
}

export async function exportPdf(
  opts: PdfOpts & { target: HTMLElement; now?: Date },
): Promise<void> {
  const doc = await buildPdfDocument(opts.target, opts);
  const blob = doc.output('blob');
  const now = opts.now ?? new Date();
  const filename = buildBinaryFilename('pdf', now, toFilenameOpts(opts));
  triggerBlobDownload(blob, filename);
}
