import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CalibrationCurve from './CalibrationCurve.svelte';
import type { CalibrationBin } from '../../services/predictionTracker';

const emptyBins: CalibrationBin[] = Array.from({ length: 10 }, (_, i) => ({
  bin: i,
  predicted: (i + 0.5) / 10,
  actual: 0,
  sampleCount: 0,
}));

const populatedBins: CalibrationBin[] = [
  { bin: 0, predicted: 0.05, actual: 0, sampleCount: 0 },
  { bin: 1, predicted: 0.15, actual: 0, sampleCount: 0 },
  { bin: 2, predicted: 0.25, actual: 0.2, sampleCount: 5 },
  { bin: 3, predicted: 0.35, actual: 0.4, sampleCount: 10 },
  { bin: 4, predicted: 0.45, actual: 0.5, sampleCount: 20 },
  { bin: 5, predicted: 0.55, actual: 0, sampleCount: 0 },
  { bin: 6, predicted: 0.65, actual: 0.7, sampleCount: 15 },
  { bin: 7, predicted: 0.75, actual: 0, sampleCount: 0 },
  { bin: 8, predicted: 0.85, actual: 0.9, sampleCount: 8 },
  { bin: 9, predicted: 0.95, actual: 0, sampleCount: 0 },
];

describe('CalibrationCurve', () => {
  it('renders an SVG with the perfect-calibration diagonal', () => {
    const { container } = render(CalibrationCurve, { bins: emptyBins });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(container.querySelector('[data-curve-diagonal]')).toBeTruthy();
  });

  it('renders [data-curve-empty] when every bin has sampleCount === 0', () => {
    const { container } = render(CalibrationCurve, { bins: emptyBins });
    expect(container.querySelector('[data-curve-empty]')).toBeTruthy();
    // No data points should be drawn in the empty state
    expect(container.querySelectorAll('[data-curve-point]')).toHaveLength(0);
  });

  it('renders one [data-curve-point] per non-empty bin when populated', () => {
    const { container } = render(CalibrationCurve, { bins: populatedBins });
    // populatedBins has 5 non-empty entries (sampleCount > 0)
    expect(container.querySelectorAll('[data-curve-point]')).toHaveLength(5);
    expect(container.querySelector('[data-curve-empty]')).toBeNull();
  });
});
