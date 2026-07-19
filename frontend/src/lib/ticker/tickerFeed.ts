// Module-singleton feed behind the two marquee tickers. Its honest neutral
// value is [THE KICKER, AWAITING SCHEDULE] — that is what SSR renders and what
// a client sees until real model state resolves. Client init is browser-gated,
// idempotent (a start-notifier guard: two live subscribers never double-fetch),
// and lazy (dataService / predictionTracker are imported for their singletons
// but only *called* on the client — module eval runs during SSR).
//
// Wiring mirrors context/defaultPorts.ts: findCurrentGameweek + fixturesForGameweek
// off the upcoming fixtures, and resolveAccuracyStats over the tracker's stats
// with the Butler coefficients as the backtest fallback. The persona store is
// subscribed so the ON DUTY item tracks persona switches reactively.

import { derived, writable, type Readable } from 'svelte/store';
import { buildTickerItems } from './tickerItems';
import type { AccuracyStats } from '../context/types';
import { resolveAccuracyStats } from '../context/defaultPorts';
import { calibrationIndex } from '../calibrationIndex';
import { findCurrentGameweek, fixturesForGameweek } from '../gameweek';
import { coefficients as butlerCoefficients, isFitted as butlerFitted } from '../engine';
import { getPersona, type PersonaId } from '../personas';
import { personaStore } from '../stores/persona';
import { dataService } from '../../services/dataService';
import { predictionTracker } from '../../services/predictionTracker';

/** Honest neutral tape: the paper's name and an unresolved schedule. */
const NEUTRAL: readonly string[] = ['THE KICKER', 'AWAITING SCHEDULE'];

interface FeedState {
  fitted: boolean;
  currentGw: number | null;
  fixtureCount: number;
  stats: AccuracyStats | null;
  personaName: string;
  /** False until a client refresh has succeeded — SSR and pre-init stay neutral. */
  ready: boolean;
}

const INITIAL: FeedState = {
  fitted: false,
  currentGw: null,
  fixtureCount: 0,
  stats: null,
  personaName: '',
  ready: false
};

/** Guards against a second start-notifier firing another fetch. */
let started = false;

/**
 * Resolve live model state and flip the feed to ready. On any throw the feed
 * keeps its neutral value — a failed fetch must never invent live numbers.
 */
async function refresh(): Promise<void> {
  try {
    const matches = await dataService.getMatches({ upcoming: true, days: 3 });
    const currentGw = findCurrentGameweek(matches);
    const fixtureCount = currentGw !== null ? fixturesForGameweek(matches, currentGw).length : 0;

    const trackerStats = predictionTracker.getAccuracyStats();
    const factors = predictionTracker.getCalibrationFactors();
    const stats = resolveAccuracyStats(
      {
        brierScore: trackerStats.brierScore,
        rps: trackerStats.rps,
        scoredSampleSize: trackerStats.scoredSampleSize,
        totalPredictions: trackerStats.totalPredictions,
        calibration: calibrationIndex(factors)
      },
      butlerFitted ? butlerCoefficients : undefined
    );

    feedState.update((s) => ({
      ...s,
      fitted: butlerFitted,
      currentGw,
      fixtureCount,
      stats,
      ready: true
    }));
  } catch {
    // Keep neutral — no schedule, no numbers.
  }
}

/**
 * First-subscriber start notifier. Browser-only and idempotent. Subscribes the
 * persona store (so ON DUTY tracks switches) and kicks a one-shot refresh.
 */
function startClientFeed(): void {
  if (started) return;
  if (typeof window === 'undefined') return;
  started = true;

  personaStore.subscribe((id) => {
    const name = getPersona(id as PersonaId).name;
    feedState.update((s) => ({ ...s, personaName: name }));
  });

  void refresh();
}

const feedState = writable<FeedState>(INITIAL, () => {
  startClientFeed();
  // Module singleton — no teardown; the `started` guard makes restart a no-op.
});

function toItems(state: FeedState, variant: 'desktop' | 'mobile'): string[] {
  if (!state.ready || !state.stats) return [...NEUTRAL];
  return buildTickerItems({
    fitted: state.fitted,
    currentGw: state.currentGw,
    fixtureCount: state.fixtureCount,
    stats: state.stats,
    personaName: state.personaName,
    variant
  });
}

/** Desktop tape (GeoffTicker). Neutral until client state resolves. */
export const tickerDesktop: Readable<string[]> = derived(feedState, ($s) =>
  toItems($s, 'desktop')
);

/** Mobile tape (MobileTicker). Neutral until client state resolves. */
export const tickerMobile: Readable<string[]> = derived(feedState, ($s) =>
  toItems($s, 'mobile')
);
