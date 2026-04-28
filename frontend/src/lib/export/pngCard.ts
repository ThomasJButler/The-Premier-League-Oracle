import { buildBinaryFilename, triggerBlobDownload, type BinaryFilenameOpts } from './shared';

export type PngCardKind = 'single-fixture' | 'gw-grid';

export interface PngCardOpts {
  kind: PngCardKind;
  gameweek?: number;
  matchId?: string;
}

const TARGET_DIMS: Record<PngCardKind, { width: number; height: number }> = {
  'single-fixture': { width: 1080, height: 1080 },
  'gw-grid': { width: 1080, height: 1920 },
};

export async function capturePngCard(
  target: HTMLElement,
  opts: PngCardOpts,
): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { width, height } = TARGET_DIMS[opts.kind];
  const sourceWidth = Math.max(target.offsetWidth, 1);
  const scale = width / sourceWidth;
  const canvas = await html2canvas(target, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    scale,
    width: target.offsetWidth,
    height: Math.min(target.offsetHeight, height / scale),
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        reject(new Error('canvas.toBlob returned null'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function toFilenameOpts(opts: PngCardOpts): BinaryFilenameOpts {
  if (opts.kind === 'gw-grid') {
    if (opts.gameweek === undefined) {
      throw new Error("PngCardOpts.kind='gw-grid' requires gameweek");
    }
    return { kind: 'gw-grid', gameweek: opts.gameweek };
  }
  if (opts.matchId === undefined) {
    throw new Error("PngCardOpts.kind='single-fixture' requires matchId");
  }
  return { kind: 'single-fixture', matchId: opts.matchId };
}

export async function exportPngCard(
  opts: PngCardOpts & { target: HTMLElement; now?: Date },
): Promise<void> {
  const filenameOpts = toFilenameOpts(opts);
  const blob = await capturePngCard(opts.target, opts);
  const now = opts.now ?? new Date();
  const filename = buildBinaryFilename('png', now, filenameOpts);
  triggerBlobDownload(blob, filename);
}
