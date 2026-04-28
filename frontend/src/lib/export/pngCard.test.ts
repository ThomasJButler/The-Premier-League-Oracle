import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as shared from './shared';

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(new Blob(['fake-png'], { type: 'image/png' })),
  })),
}));

describe('export/pngCard', () => {
  let target: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    target = document.createElement('div');
    Object.defineProperty(target, 'offsetWidth', { value: 800, configurable: true });
    Object.defineProperty(target, 'offsetHeight', { value: 600, configurable: true });
    document.body.appendChild(target);
  });

  afterEach(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
  });

  it('capturePngCard lazy-imports html2canvas and uses gw-grid scale (1080 / target width)', async () => {
    const { capturePngCard } = await import('./pngCard');
    const html2canvas = (await import('html2canvas')).default;
    const blob = await capturePngCard(target, { kind: 'gw-grid', gameweek: 35 });
    expect(html2canvas).toHaveBeenCalledOnce();
    const [el, opts] = (html2canvas as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(el).toBe(target);
    expect(opts.scale).toBeCloseTo(1080 / 800, 5);
    expect(blob.type).toBe('image/png');
  });

  it('capturePngCard uses 1080-wide single-fixture scale on a 800px-wide target', async () => {
    const { capturePngCard } = await import('./pngCard');
    const html2canvas = (await import('html2canvas')).default;
    await capturePngCard(target, { kind: 'single-fixture', matchId: 'm1' });
    const [, opts] = (html2canvas as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.scale).toBeCloseTo(1080 / 800, 5);
  });

  it('exportPngCard composes capturePngCard + triggerBlobDownload with the right filename', async () => {
    const { exportPngCard } = await import('./pngCard');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    await exportPngCard({
      kind: 'gw-grid',
      gameweek: 35,
      target,
      now: new Date(2026, 3, 28),
    });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect((blob as Blob).type).toBe('image/png');
    expect(filename).toBe('predictions-gw35-2026-04-28.png');
    downloadSpy.mockRestore();
  });

  it('exportPngCard uses Date.now() when opts.now is absent', async () => {
    const { exportPngCard } = await import('./pngCard');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
    await exportPngCard({ kind: 'gw-grid', gameweek: 35, target });
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe('predictions-gw35-2026-04-28.png');
    downloadSpy.mockRestore();
    vi.useRealTimers();
  });

  it('exportPngCard rejects when gw-grid is missing gameweek', async () => {
    const { exportPngCard } = await import('./pngCard');
    await expect(
      exportPngCard({ kind: 'gw-grid', target } as Parameters<typeof exportPngCard>[0]),
    ).rejects.toThrow(/gameweek/);
  });
});
