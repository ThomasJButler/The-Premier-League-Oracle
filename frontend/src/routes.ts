/**
 * Single source of truth for the v3 route table, redirect map, and per-hub sub-tab lists.
 * Consumed by App.svelte's <Router>, by the new sidebar/MobileTabBar (sub-tab rendering),
 * and by the redirect logic at the top of <Router>.
 */

// Phase 0d wires the screens; until then, App.svelte may render legacy components by route.
export type RouteDef = {
  path: string;
  /** Display label for sidebar / mobile tab bar. */
  label: string;
  /** Sub-tabs under this hub, in display order. */
  subTabs?: SubTabDef[];
  /** True if this route should appear in the primary sidebar. */
  inSidebar?: boolean;
  /** True if this route should appear in the mobile bottom tab bar. */
  inMobileBar?: boolean;
};

export type SubTabDef = {
  /** Final segment of the URL (e.g. 'live' for /fixtures/live). */
  slug: string;
  /** Display label. */
  label: string;
};

export const ROUTES: RouteDef[] = [
  { path: '/today',       label: 'Today',       inSidebar: true, inMobileBar: true },
  { path: '/fixtures',    label: 'Fixtures',    inSidebar: true, inMobileBar: true,
    subTabs: [
      { slug: 'live',      label: 'Live' },
      { slug: 'matches',   label: 'Matches' },
      { slug: 'standings', label: 'Standings' },
    ],
  },
  { path: '/predictions', label: 'Predictions', inSidebar: true, inMobileBar: true,
    subTabs: [
      { slug: 'this-week', label: 'This Week' },
      { slug: 'backtest',  label: 'Backtest' },
      { slug: 'log',       label: 'Log' },
      { slug: 'tools',     label: 'Tools' },
    ],
  },
  { path: '/oracle',      label: 'Oracle',      inSidebar: true, inMobileBar: true },
  { path: '/insights',    label: 'Insights',    inSidebar: true, inMobileBar: false,
    subTabs: [
      { slug: 'scorers',  label: 'Top Scorers' },
      { slug: 'stats',    label: 'Season Stats' },
      { slug: 'timeline', label: 'Timeline' },
    ],
  },
  { path: '/settings',    label: 'Settings',    inSidebar: true, inMobileBar: false,
    subTabs: [
      { slug: 'account',       label: 'Account' },
      { slug: 'api-data',      label: 'API & data' },
      { slug: 'display',       label: 'Display' },
      { slug: 'predictions',   label: 'Predictions' },
      { slug: 'notifications', label: 'Notifications' },
      { slug: 'privacy',       label: 'Privacy' },
      { slug: 'help',          label: 'Help' },
    ],
  },
];

/** Default sub-tab when a hub URL is hit without a sub-tab segment. */
export const HUB_DEFAULTS: Record<string, string> = {
  '/fixtures':    'matches',
  '/predictions': 'this-week',
  '/insights':    'scorers',
  '/settings':    'account',
};

/**
 * Old (v2) URL → new (v3) URL. Applied at the <Router> top level.
 * Order matters only when two patterns could match; current map has no overlaps.
 */
export const REDIRECTS: Record<string, string> = {
  '/':                    '/today',
  '/dashboard':           '/today',
  '/matches':             '/fixtures/matches',
  '/live-matches':        '/fixtures/live',
  '/standings':           '/fixtures/standings',
  '/predictions':         '/predictions/this-week',
  '/value-scanner':       '/predictions/tools?utility=value',
  '/kelly-calculator':    '/predictions/tools?utility=kelly',
  '/suggested-bets':      '/predictions/tools',
  '/accumulators':        '/predictions/tools',
  '/betting-history':     '/predictions/log',
  '/top-scorers':         '/insights/scorers',
  '/season-stats':        '/insights/stats',
  '/season-timeline':     '/insights/timeline',
  '/oracle-chat':         '/oracle',
  '/settings':            '/settings/account',
};

/** Find a route def by its top-level path. */
export function findRoute(path: string): RouteDef | undefined {
  return ROUTES.find((r) => r.path === path);
}
