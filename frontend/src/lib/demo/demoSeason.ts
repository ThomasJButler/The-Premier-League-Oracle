/**
 * Demo data for screenshot / preview mode.
 * Activated via `?demo=1`, `localStorage.kicker:demoMode === 'on'`, or `VITE_DEMO_MODE`.
 * Never shown when a Football-Data API key is configured for the real user.
 */

import type { Season } from '../../types/index.js';

export const DEMO_SEASON: Season = {
  id: '2025-26',
  name: '2025/26 Premier League',
  start_date: '2025-08-15',
  end_date: '2026-05-24',
  is_current: true,
  created_at: '2025-08-01T00:00:00Z',
  year: 2025,
  currentMatchday: 35,
};
