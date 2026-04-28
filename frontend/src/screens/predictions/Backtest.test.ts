import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Backtest from './Backtest.svelte';

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn().mockReturnValue({
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      brierScore: 0,
      scoreAccuracy: 0,
      highConfidenceAccuracy: 0,
      mediumConfidenceAccuracy: 0,
      lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0,
      awayWinAccuracy: 0,
      drawAccuracy: 0,
      averageConfidence: 0,
      streak: { current: 0, best: 0, worst: 0 },
    }),
    getAccuracyByGameweek: vi.fn().mockReturnValue([]),
    getCalibrationFactors: vi.fn().mockReturnValue({
      highBand: 1,
      mediumBand: 1,
      lowBand: 1,
    }),
    getCalibrationCurve: vi.fn().mockReturnValue(
      Array.from({ length: 10 }, (_, i) => ({
        bin: i,
        predicted: (i + 0.5) / 10,
        actual: 0,
        sampleCount: 0,
      })),
    ),
    getRecentPredictions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../lib/export/csv', () => ({
  exportCsv: vi.fn(),
}));

describe('Backtest (Predictions Backtest screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-screen="predictions-backtest"] root unconditionally', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-screen="predictions-backtest"]')).toBeTruthy();
  });

  it('renders 4 KPI tiles with the documented data-kpi markers', () => {
    const { container } = render(Backtest);
    const tiles = container.querySelectorAll('[data-kpi-grid] > [data-kpi]');
    expect(tiles).toHaveLength(4);
    const kinds = Array.from(tiles).map((t) => t.getAttribute('data-kpi'));
    expect(kinds).toEqual(
      expect.arrayContaining(['brier', 'calibration-index', 'roi', 'outcome-accuracy']),
    );
  });

  it('renders ROI placeholder cells (no market data yet)', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-kpi="roi"] [data-roi-placeholder]')).toBeTruthy();
    expect(
      container.querySelectorAll('[data-roi-table] [data-roi-placeholder]').length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('renders [data-no-history] copy when getAccuracyStats reports zero predictions', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-no-history]')).toBeTruthy();
  });

  it('renders [data-spark-empty] when getAccuracyByGameweek returns []', () => {
    const { container } = render(Backtest);
    expect(container.querySelector('[data-spark-empty]')).toBeTruthy();
  });

  it('renders [Export CSV] as an active button (no placeholder, no disabled)', () => {
    const { container } = render(Backtest);
    const btn = container.querySelector('[data-export="csv"]');
    expect(btn).toBeTruthy();
    expect(btn?.hasAttribute('data-export-placeholder')).toBe(false);
    expect(btn?.hasAttribute('disabled')).toBe(false);
    expect(btn?.textContent).toMatch(/Export CSV/i);
  });

  it('CSV button click calls exportCsv with the loaded predictions', async () => {
    const { exportCsv } = await import('../../lib/export/csv');
    const { container } = render(Backtest);
    const csvBtn = container.querySelector('[data-export="csv"]') as HTMLButtonElement;
    await fireEvent.click(csvBtn);
    expect(exportCsv).toHaveBeenCalledOnce();
  });
});
