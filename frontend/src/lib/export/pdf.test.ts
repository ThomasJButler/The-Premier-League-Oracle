import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as shared from './shared';

const fakeBlob = new Blob(['fake-pdf'], { type: 'application/pdf' });
const docMock = {
  addImage: vi.fn(),
  text: vi.fn(),
  output: vi.fn(() => fakeBlob),
  save: vi.fn(),
  internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
};

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({ toBlob: () => {} })),
}));

vi.mock('jspdf', () => ({
  default: vi.fn(() => docMock),
}));

describe('export/pdf', () => {
  let target: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    docMock.addImage.mockClear();
    docMock.text.mockClear();
    docMock.output.mockClear();
    target = document.createElement('div');
    Object.defineProperty(target, 'offsetWidth', { value: 800, configurable: true });
    Object.defineProperty(target, 'offsetHeight', { value: 600, configurable: true });
    document.body.appendChild(target);
  });

  afterEach(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
  });

  it('buildPdfDocument lazy-imports html2canvas + jspdf and places the canvas page-fill', async () => {
    const { buildPdfDocument } = await import('./pdf');
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const doc = await buildPdfDocument(target, { kind: 'this-week', gameweek: 35 });
    expect(html2canvas).toHaveBeenCalledOnce();
    expect(jsPDF).toHaveBeenCalledWith({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    expect(doc.addImage).toHaveBeenCalledOnce();
    const addImageArgs = (doc.addImage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(addImageArgs[2]).toBe(0); // x
    expect(addImageArgs[3]).toBe(0); // y
    expect(addImageArgs[4]).toBe(297); // w (A4 landscape)
    expect(addImageArgs[5]).toBe(210); // h
  });

  it('buildPdfDocument draws the ThisWeek footer with gameweek number', async () => {
    const { buildPdfDocument } = await import('./pdf');
    const doc = await buildPdfDocument(target, { kind: 'this-week', gameweek: 35 });
    const textCall = (doc.text as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(textCall[0]).toBe('Premier League Oracle · Model v3.5-MVP · Predictions for GW35');
  });

  it('buildPdfDocument draws the Log footer (no gameweek)', async () => {
    const { buildPdfDocument } = await import('./pdf');
    const doc = await buildPdfDocument(target, { kind: 'log' });
    const textCall = (doc.text as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(textCall[0]).toBe('Premier League Oracle · Model v3.5-MVP · Predictions Log');
  });

  it('exportPdf composes buildPdfDocument + triggerBlobDownload (Log filename)', async () => {
    const { exportPdf } = await import('./pdf');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    await exportPdf({ kind: 'log', target, now: new Date(2026, 3, 28) });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect((blob as Blob).type).toBe('application/pdf');
    expect(filename).toBe('predictions-log-2026-04-28.pdf');
    downloadSpy.mockRestore();
  });

  it('exportPdf emits gameweek-stamped filename for ThisWeek', async () => {
    const { exportPdf } = await import('./pdf');
    const downloadSpy = vi.spyOn(shared, 'triggerBlobDownload').mockImplementation(() => {});
    await exportPdf({
      kind: 'this-week',
      gameweek: 35,
      target,
      now: new Date(2026, 3, 28),
    });
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe('predictions-gw35-2026-04-28.pdf');
    downloadSpy.mockRestore();
  });
});
