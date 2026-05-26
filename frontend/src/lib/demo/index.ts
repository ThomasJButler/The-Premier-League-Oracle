/**
 * Demo data for screenshot / preview mode.
 * Activated via `?demo=1`, `localStorage.kicker:demoMode === 'on'`, or `VITE_DEMO_MODE`.
 * Never shown when a Football-Data API key is configured for the real user.
 */

export { DEMO_MATCHES } from './demoMatches.js';
export { DEMO_STANDINGS } from './demoStandings.js';
export { DEMO_SCORERS } from './demoScorers.js';
export type { FDScorer } from './demoScorers.js';
export { DEMO_SEASON } from './demoSeason.js';
export { DEMO_PREDICTIONS } from './demoPredictions.js';
