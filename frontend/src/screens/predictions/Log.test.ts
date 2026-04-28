import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Log from './Log.svelte';

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getRecentPredictions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../lib/export/csv', () => ({
  exportCsv: vi.fn(),
}));

vi.mock('../../lib/export/markdown', () => ({
  exportMarkdown: vi.fn(),
}));

vi.mock('../../lib/export/pdf', () => ({
  exportPdf: vi.fn(),
}));

describe('Log (Predictions Log screen)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders [data-screen="predictions-log"] root unconditionally', () => {
    const { container } = render(Log);
    expect(container.querySelector('[data-screen="predictions-log"]')).toBeTruthy();
  });

  it('renders [data-no-stored] when getRecentPredictions returns empty', () => {
    const { container } = render(Log);
    expect(container.querySelector('[data-no-stored]')).toBeTruthy();
    expect(container.querySelector('[data-log-table]')).toBeNull();
  });

  it('renders the LogFilterChips strip with three chips', () => {
    const { container } = render(Log);
    const chips = container.querySelectorAll('[data-chip]');
    expect(chips).toHaveLength(3);
    const ids = Array.from(chips).map((c) => c.getAttribute('data-chip'));
    expect(ids).toEqual(['last30', 'season', 'all']);
  });

  it('defaults to the last30 chip pressed', () => {
    const { container } = render(Log);
    const last30 = container.querySelector('[data-chip="last30"]');
    expect(last30?.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders 3 active export buttons (CSV + PDF + Markdown) with no placeholder attribute', () => {
    const { container } = render(Log);
    const csvBtn = container.querySelector('[data-export="csv"]');
    const pdfBtn = container.querySelector('[data-export="pdf"]');
    const mdBtn = container.querySelector('[data-export="markdown"]');
    expect(csvBtn).toBeTruthy();
    expect(pdfBtn).toBeTruthy();
    expect(mdBtn).toBeTruthy();
    expect(csvBtn?.hasAttribute('data-export-placeholder')).toBe(false);
    expect(pdfBtn?.hasAttribute('data-export-placeholder')).toBe(false);
    expect(mdBtn?.hasAttribute('data-export-placeholder')).toBe(false);
  });

  it('CSV button click calls exportCsv with the loaded rows', async () => {
    const { exportCsv } = await import('../../lib/export/csv');
    const { container } = render(Log);
    const csvBtn = container.querySelector('[data-export="csv"]') as HTMLButtonElement;
    await fireEvent.click(csvBtn);
    expect(exportCsv).toHaveBeenCalledOnce();
  });

  it('PDF button click calls exportPdf with the log-table element when rows are populated', async () => {
    const { exportPdf } = await import('../../lib/export/pdf');
    const { predictionTracker } = await import('../../services/predictionTracker');
    const now = new Date();
    (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { id: 'p1', matchId: 'm1', homeTeam: 'Liverpool FC', awayTeam: 'Arsenal FC',
        predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.62,
        timestamp: now.toISOString(), matchDate: now.toISOString(),
        poissonProbs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 } },
    ]);
    const { container } = render(Log);
    const pdfBtn = container.querySelector('[data-export="pdf"]') as HTMLButtonElement;
    expect(pdfBtn.hasAttribute('disabled')).toBe(false);
    await fireEvent.click(pdfBtn);
    expect(exportPdf).toHaveBeenCalledOnce();
    const [opts] = (exportPdf as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.kind).toBe('log');
    expect(opts.target).toBeInstanceOf(HTMLElement);
  });

  it('renders [data-card-row] per stored prediction once getRecentPredictions populates', async () => {
    const { predictionTracker } = await import('../../services/predictionTracker');
    const now = new Date();
    (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { id: 'p1', matchId: 'm1', homeTeam: 'Liverpool FC', awayTeam: 'Arsenal FC',
        predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 1, confidence: 0.62,
        timestamp: now.toISOString(), matchDate: now.toISOString(),
        poissonProbs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 } },
      { id: 'p2', matchId: 'm2', homeTeam: 'Manchester City FC', awayTeam: 'Chelsea FC',
        predictedResult: 'D', predictedHomeGoals: 1, predictedAwayGoals: 1, confidence: 0.5,
        timestamp: now.toISOString(), matchDate: now.toISOString() },
    ]);
    const { container } = render(Log);
    expect(container.querySelectorAll('[data-card-row]')).toHaveLength(2);
    expect(container.querySelector('[data-no-stored]')).toBeNull();
  });
});
