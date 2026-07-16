// The one honest sentence about model accuracy, shared by every prompt
// builder. Exists because an earlier version printed "Brier 0.000" when zero
// predictions had been scored — the columnists were told the model was
// perfect when in fact it was unmeasured. Never cite a proper score without
// its denominator.

import type { AccuracyStats } from '$lib/context/types';

export function describeAccuracy(stats: AccuracyStats): string {
  if (stats.scoredSampleSize === 0) {
    return stats.sampleSize > 0
      ? `not yet probability-scored (${stats.sampleSize} settled predictions lack stored probabilities) — do not cite Brier/RPS numbers`
      : 'no settled predictions yet — do not cite accuracy numbers';
  }
  if (stats.source === 'backtest') {
    return (
      `walk-forward backtest evidence (no live sample yet): ` +
      `Brier ${stats.brier.toFixed(3)}, RPS ${stats.rps.toFixed(3)}, ` +
      `calibration ${stats.calibration.toFixed(3)} over ${stats.scoredSampleSize} historical matches`
    );
  }
  return (
    `Brier ${stats.brier.toFixed(3)}, RPS ${stats.rps.toFixed(3)}, ` +
    `calibration ${stats.calibration.toFixed(3)} ` +
    `(scored n=${stats.scoredSampleSize} of ${stats.sampleSize} settled)`
  );
}
