// Pure builder for the marquee tape items. Given a plain snapshot of model
// state it returns the honest strings the ticker should scroll — no claim the
// data can't back up. Every string is formatted from the input values;
// nothing is hardcoded. Kept dependency-free (no dataService/tracker/storage,
// no Date.now) so it unit-tests per branch and is safe on the server.

import type { AccuracyStats } from '../context/types';

export interface TickerInput {
  /** True once the Butler model has real fitted coefficients — gates MODEL LIVE. */
  fitted: boolean;
  /** Current gameweek number, or null when no schedule is resolved yet. */
  currentGw: number | null;
  /** Not-yet-played fixtures in the current gameweek. */
  fixtureCount: number;
  /** Accuracy line from resolveAccuracyStats — carries its own provenance. */
  stats: AccuracyStats;
  /** Persona on duty; rendered uppercased in the final item. */
  personaName: string;
  /** Desktop tape carries more; mobile trims to the essentials. */
  variant: 'desktop' | 'mobile';
}

/**
 * Schedule item: the honest gameweek line. Mobile shows only the number;
 * desktop appends the fixture count. Null gameweek reuses the app's own
 * "AWAITING SCHEDULE" copy (today/+page.svelte, predictions/+page.svelte).
 */
function scheduleItem(
  currentGw: number | null,
  fixtureCount: number,
  variant: 'desktop' | 'mobile'
): string {
  if (currentGw === null) return 'AWAITING SCHEDULE';
  if (variant === 'mobile') return `GW${currentGw}`;
  return `GW${currentGw} - ${fixtureCount} FIXTURES`;
}

/**
 * Accuracy items, labelled by provenance so a viewer always knows whether the
 * numbers are live-tracked or the model's fit-time walk-forward evidence.
 * Backtest numbers are explicitly tagged as such; live numbers are only shown
 * once at least one prediction has been probability-scored (a zero scored
 * sample makes brier/rps meaningless, so we say nothing rather than lie).
 */
function metricItems(stats: AccuracyStats, variant: 'desktop' | 'mobile'): string[] {
  if (stats.source === 'backtest') {
    const rps = `RPS ${stats.rps.toFixed(3)}`;
    if (variant === 'mobile') return [rps];
    return [`BACKTEST - ${stats.sampleSize} MATCHES`, rps];
  }
  // Live tracker numbers, presented as live — but only when they mean something.
  if (stats.scoredSampleSize > 0) {
    const brier = stats.brier.toFixed(2);
    if (variant === 'mobile') return [`BRIER ${brier}`];
    return [`BRIER ${brier} - LIVE`];
  }
  return [];
}

/**
 * Assemble the tape. Order: MODEL LIVE (only when truly fitted) → schedule →
 * accuracy → ON DUTY. Mobile returns fewer, shorter items.
 */
export function buildTickerItems(input: TickerInput): string[] {
  const { fitted, currentGw, fixtureCount, stats, personaName, variant } = input;
  const items: string[] = [];
  if (fitted) items.push('MODEL LIVE');
  items.push(scheduleItem(currentGw, fixtureCount, variant));
  items.push(...metricItems(stats, variant));
  if (personaName) items.push(`ON DUTY: ${personaName.toUpperCase()}`);
  return items;
}
