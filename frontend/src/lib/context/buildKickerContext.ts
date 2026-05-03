// buildKickerContext — aggregates the prediction-engine outputs into a single
// KickerContext payload for system-prompt injection (chat) and screen render
// (Today, Predictions). Engines are passed in as ports so this module stays
// decoupled from the still-quarantined preserved/ tree. K0e-ii will graduate
// the real engines and ship a default-wired adapter at the consumer site.

import type {
  BuildKickerContextOptions,
  KickerContext,
  KickerContextPorts
} from './types';

const DEFAULT_DAYS_AHEAD = 7;
const ZERO_ACCURACY = { brier: 0, calibration: 0, sampleSize: 0 } as const;

export async function buildKickerContext(
  ports: KickerContextPorts,
  options: BuildKickerContextOptions = {}
): Promise<KickerContext> {
  const daysAhead = options.daysAhead ?? DEFAULT_DAYS_AHEAD;
  const includeStandings = options.includeStandings ?? true;

  const [fixtures, standings, accuracyStats] = await Promise.all([
    ports.getUpcomingFixtures({ daysAhead }).catch(() => []),
    includeStandings ? ports.getStandings().catch(() => []) : Promise.resolve([]),
    ports.getAccuracyStats().catch(() => ({ ...ZERO_ACCURACY }))
  ]);

  return {
    fixtures,
    standings,
    accuracyStats,
    generatedAt: new Date().toISOString()
  };
}
