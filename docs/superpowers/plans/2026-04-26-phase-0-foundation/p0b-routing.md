# Phase 0 — Slice P0b — Routing

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-0-foundation/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`  
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P0b — Routing slice

**Slice goal:** Install `svelte-routing`, refactor `App.svelte` from `currentView` state to `<Router>` + `<Route>` blocks, create `routes.ts` (route table + redirect map + sub-tab declarations), add Vercel SPA fallback, set up redirect map for old flat URLs, delete orphaned betting components (Suggested/Accumulators/History) — they become unreachable in this slice's commit.

**Auto-gate:** Playwright spec hits every new URL (200 + correct component renders) and every old URL (redirects to its replacement).

### Task 1: Install svelte-routing

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Install svelte-routing**

Run: `cd frontend && npm install svelte-routing@latest`

Expected: Package added to `dependencies`. Confirm with `grep svelte-routing package.json`.

- [ ] **Step 2: Confirm svelte-check is happy with the new dep**

Run: `cd frontend && npm run check`

Expected: 0 errors. (`svelte-routing` ships its own types.)

### Task 2: Create the routes table

**Files:**
- Create: `frontend/src/routes.ts`

- [ ] **Step 1: Write routes.ts with route table + redirect map + sub-tab declarations**

```ts
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
```

### Task 3: Refactor App.svelte to use Router

**Files:**
- Modify: `frontend/src/App.svelte` (full rewrite)

- [ ] **Step 1: Replace App.svelte with Router-driven version**

Replace the entire file contents with:

```svelte
<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
  import ValueBets from './components/betting/ValueBets.svelte';
  import Settings from './components/Settings.svelte';
  import ApiSetupWizard from './components/ApiSetupWizard.svelte';
  import Help from './components/Help.svelte';
  import TopScorers from './components/TopScorers.svelte';
  import SeasonStats from './components/SeasonStats.svelte';
  import SeasonTimeline from './components/SeasonTimeline.svelte';
  import ChatBot from './components/ChatBot.svelte';
  import { dataService } from './services/dataService';
  import { footballDataAPI } from './services/api/footballData';
  import { onMount } from 'svelte';
  import { isDarkMode } from './stores/theme';
  import { REDIRECTS } from './routes';

  export let url = '';

  let isSidebarOpen = false;
  let showApiSetup = false;
  let hasApiKey = false;
  let dashboardComponent: Dashboard;

  function applyRedirect(): boolean {
    const here = window.location.pathname + window.location.search;
    const target = REDIRECTS[window.location.pathname];
    if (target && here !== target) {
      navigate(target, { replace: true });
      return true;
    }
    return false;
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  onMount(() => {
    if (window.innerWidth >= 1024) {
      isSidebarOpen = true;
    }
    isDarkMode.init();
    const savedTeam = localStorage.getItem('favourite_team');
    if (savedTeam) {
      document.documentElement.dataset.team = savedTeam;
    }
    applyRedirect();
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    hasApiKey = !!apiKey;
    if (!hasApiKey) {
      showApiSetup = true;
    }
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    hasApiKey = true;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
    if (dashboardComponent) {
      setTimeout(() => dashboardComponent.refresh(), 100);
    }
  }
</script>

<Router {url}>
  <div class="flex h-screen bg-background text-foreground overflow-hidden relative noise-bg">
    <Sidebar bind:isOpen={isSidebarOpen} on:closeSidebar={() => (isSidebarOpen = false)} />

    <div class="flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ease-in-out {isSidebarOpen ? 'lg:ml-64' : ''}">
      <Header toggleSidebar={toggleSidebar} {isSidebarOpen} />
      <LiveTicker />

      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8 relative" aria-label="Premier League Oracle content">
        <!-- Phase 0b: routes mount LEGACY components by URL.
             Phase 0d swaps the shell; later phases swap the components. -->
        <Route path="/today"><Dashboard bind:this={dashboardComponent} /></Route>
        <Route path="/fixtures/live"><LiveMatches /></Route>
        <Route path="/fixtures/matches"><MatchList /></Route>
        <Route path="/fixtures/standings"><StandingsTable /></Route>
        <Route path="/predictions/this-week"><Predictions /></Route>
        <Route path="/predictions/backtest"><Predictions /></Route>
        <Route path="/predictions/log"><Predictions /></Route>
        <Route path="/predictions/tools"><KellyCalculator /></Route>
        <Route path="/oracle"><ChatBot /></Route>
        <Route path="/insights/scorers"><TopScorers /></Route>
        <Route path="/insights/stats"><SeasonStats /></Route>
        <Route path="/insights/timeline"><SeasonTimeline /></Route>
        <Route path="/settings/account"><Settings /></Route>
        <Route path="/settings/api-data"><Settings /></Route>
        <Route path="/settings/display"><Settings /></Route>
        <Route path="/settings/predictions"><Settings /></Route>
        <Route path="/settings/notifications"><Settings /></Route>
        <Route path="/settings/privacy"><Settings /></Route>
        <Route path="/settings/help"><Help /></Route>
      </main>
    </div>

    <MobileNav />

    {#if showApiSetup}
      <ApiSetupWizard on:complete={handleApiSetupComplete} />
    {/if}
  </div>
</Router>

<style global lang="postcss">
  .page-content { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
</style>
```

Note: the existing `Sidebar` and `MobileNav` still emit `navigate` CustomEvents. They will be replaced in P0d with the new `BroadcastShell` + `MobileTabBar` that use `navigate()` from `svelte-routing` directly. Until then, leave them — they keep working as long as their `navigate` event handler updates `window.location` (existing behavior).

- [ ] **Step 2: Patch Sidebar.svelte's nav emit to use svelte-routing's navigate**

Open `frontend/src/components/Sidebar.svelte`, find the `navigate` event dispatch, and route it through `svelte-routing`'s `navigate()`. Find the existing dispatch (it uses `createEventDispatcher` and emits `{ view }`). Add an import at top:

```svelte
<script lang="ts">
  import { navigate as routerNavigate } from 'svelte-routing';
  // ... existing imports
</script>
```

In the function that handles a sidebar item click (search for `dispatch('navigate'`), replace the dispatch with a path-based router navigate. Build a small map at the top of the script:

```ts
const VIEW_TO_PATH: Record<string, string> = {
  'Dashboard': '/today',
  'Matches': '/fixtures/matches',
  'Live Matches': '/fixtures/live',
  'Standings': '/fixtures/standings',
  'Predictions': '/predictions/this-week',
  'Suggested Bets': '/predictions/tools',
  'Kelly Calculator': '/predictions/tools?utility=kelly',
  'Value Scanner': '/predictions/tools?utility=value',
  'Accumulators': '/predictions/tools',
  'Betting History': '/predictions/log',
  'Top Scorers': '/insights/scorers',
  'Season Stats': '/insights/stats',
  'Season Timeline': '/insights/timeline',
  'Oracle Chat': '/oracle',
  'Settings': '/settings/account',
  'Help': '/settings/help',
};
```

Replace the dispatch call with `routerNavigate(VIEW_TO_PATH[view] ?? '/today')`.

- [ ] **Step 3: Patch MobileNav.svelte to use svelte-routing's navigate**

Open `frontend/src/components/MobileNav.svelte`. Add the same import:

```svelte
<script lang="ts">
  import { navigate as routerNavigate } from 'svelte-routing';
  // ... existing imports
</script>
```

Add the same `VIEW_TO_PATH` map at the top of the script (identical to the one in Sidebar.svelte from Step 2):

```ts
const VIEW_TO_PATH: Record<string, string> = {
  'Dashboard': '/today',
  'Matches': '/fixtures/matches',
  'Live Matches': '/fixtures/live',
  'Standings': '/fixtures/standings',
  'Predictions': '/predictions/this-week',
  'Suggested Bets': '/predictions/tools',
  'Kelly Calculator': '/predictions/tools?utility=kelly',
  'Value Scanner': '/predictions/tools?utility=value',
  'Accumulators': '/predictions/tools',
  'Betting History': '/predictions/log',
  'Top Scorers': '/insights/scorers',
  'Season Stats': '/insights/stats',
  'Season Timeline': '/insights/timeline',
  'Oracle Chat': '/oracle',
  'Settings': '/settings/account',
  'Help': '/settings/help',
};
```

Search for `dispatch('navigate'` (or the equivalent `createEventDispatcher` call) in the file and replace it with `routerNavigate(VIEW_TO_PATH[view] ?? '/today')`. The `view` variable is whatever the click handler uses to identify the destination — most likely a `view: string` parameter or a string from the click event payload.

Strip the now-unused `createEventDispatcher` import and any unused `dispatch` variable.

- [ ] **Step 4: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors. If errors appear about `navigate` being shadowed, alias the import (`import { navigate as routerNavigate } from 'svelte-routing'`).

- [ ] **Step 5: Run vitest to confirm legacy tests still pass**

Run: `cd frontend && npm run test -- --run`

Expected: tests still green. Some tests for `Header.svelte` / `Sidebar.svelte` may break if they assert on the dispatched `navigate` CustomEvent. If so, update those tests to mock `svelte-routing`'s `navigate()` instead. Pattern:

```ts
import { navigate } from 'svelte-routing';
vi.mock('svelte-routing', () => ({ navigate: vi.fn() }));
// ...
expect(navigate).toHaveBeenCalledWith('/today');
```

### Task 4: Add Vercel SPA fallback

**Files:**
- Modify: `vercel.json` (repo root)

- [ ] **Step 1: Read existing vercel.json to confirm structure**

Run: `cat vercel.json` (from repo root, not frontend/)

- [ ] **Step 2: Add SPA fallback to the `rewrites` array**

The fallback rule must be **last** in the rewrites array (most-specific-first ordering). Add this entry at the end of the existing `rewrites`:

```json
{ "source": "/((?!api/|_next/|favicon\\.ico|.*\\..*).*)", "destination": "/index.html" }
```

This matches any path that does NOT start with `api/`, does NOT contain a `.` (so static assets are still served), and rewrites it to `/index.html`. The Svelte SPA then routes from there.

- [ ] **Step 3: Verify the rewrites are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && echo OK`

Expected: `OK`.

### Task 5: Delete killed-feature components

**Files:**
- Delete: `frontend/src/components/betting/SuggestedBets.svelte`
- Delete: `frontend/src/components/betting/AccumulatorBuilder.svelte`
- Delete: `frontend/src/components/betting/AccumulatorBuilder.test.ts`
- Delete: `frontend/src/components/BettingHistory.svelte`
- Delete: `frontend/src/components/BettingHistory.test.ts`

- [ ] **Step 1: Verify these components have no remaining importers (after the App.svelte rewrite)**

Run: `cd frontend && grep -rn "SuggestedBets\|AccumulatorBuilder\|BettingHistory" src/ --include='*.svelte' --include='*.ts' | grep -v '\.test\.\|\.svelte:'`

Expected: only the file declarations themselves; no remaining `import` statements (the App.svelte rewrite in Task 3 dropped these).

- [ ] **Step 2: Delete the files**

```bash
cd frontend
rm src/components/betting/SuggestedBets.svelte
rm src/components/betting/AccumulatorBuilder.svelte
rm src/components/betting/AccumulatorBuilder.test.ts
rm src/components/BettingHistory.svelte
rm src/components/BettingHistory.test.ts
```

- [ ] **Step 3: Run svelte-check + vitest to confirm no broken references**

Run: `cd frontend && npm run check && npm run test -- --run`

Expected: both green. If a test file we didn't list references one of these components, delete that test file too and re-run.

### Task 6: Write the routing auto-gate Playwright spec

**Files:**
- Create: `frontend/e2e/routing.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

/**
 * P0b auto-gate. Asserts:
 * - every new v3 URL responds with the app shell (200, page renders)
 * - every legacy URL in the redirect map ends up at its v3 replacement
 */

const NEW_ROUTES = [
  '/today',
  '/fixtures/live',
  '/fixtures/matches',
  '/fixtures/standings',
  '/predictions/this-week',
  '/predictions/backtest',
  '/predictions/log',
  '/predictions/tools',
  '/oracle',
  '/insights/scorers',
  '/insights/stats',
  '/insights/timeline',
  '/settings/account',
  '/settings/api-data',
  '/settings/display',
  '/settings/predictions',
  '/settings/notifications',
  '/settings/privacy',
  '/settings/help',
];

const REDIRECTS: Array<[string, string]> = [
  ['/',                    '/today'],
  ['/dashboard',           '/today'],
  ['/matches',             '/fixtures/matches'],
  ['/live-matches',        '/fixtures/live'],
  ['/standings',           '/fixtures/standings'],
  ['/predictions',         '/predictions/this-week'],
  ['/top-scorers',         '/insights/scorers'],
  ['/season-stats',        '/insights/stats'],
  ['/season-timeline',     '/insights/timeline'],
  ['/oracle-chat',         '/oracle'],
  ['/suggested-bets',      '/predictions/tools'],
  ['/accumulators',        '/predictions/tools'],
  ['/betting-history',     '/predictions/log'],
];

for (const path of NEW_ROUTES) {
  test(`new route renders: ${path}`, async ({ page }) => {
    const resp = await page.goto(path);
    expect(resp?.status()).toBeLessThan(400);
    // App shell renders (the 'main' landmark exists)
    await expect(page.getByRole('main')).toBeVisible();
  });
}

for (const [from, to] of REDIRECTS) {
  test(`redirect ${from} -> ${to}`, async ({ page }) => {
    await page.goto(from);
    // Allow client-side router redirect to settle
    await page.waitForURL(new RegExp(to.replace(/\?.*/, '').replace(/\//g, '\\/')), { timeout: 5000 });
    expect(page.url()).toContain(to.split('?')[0]);
  });
}
```

- [ ] **Step 2: Run the spec to confirm it passes**

Run: `cd frontend && npx playwright test e2e/routing.spec.ts --project=desktop-chrome`

Expected: all `NEW_ROUTES` tests pass; all `REDIRECTS` tests pass.

If a NEW_ROUTES test fails because the route's component throws (e.g. legacy `KellyCalculator` is rendered at `/predictions/tools` but expects an API key context that's missing in test mode), the loop's response is to record the failure in `## Notes / discoveries` of `IMPLEMENTATION_PLAN.md` rather than fix the component (which is rebuilt later in P4d). For P0b we accept "renders the shell" as sufficient — if the inner component errors, that's a known transitional state.

### Task 7: Commit P0b

- [ ] **Step 1: Verify all changes**

Run: `cd .. && git status && git diff --stat HEAD`

Expected: shows the new routes.ts, modified App.svelte/Sidebar/MobileNav, modified package.json/lock, modified vercel.json, deleted 5 files, new e2e/routing.spec.ts.

- [ ] **Step 2: Commit**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/package.json frontend/package-lock.json
git add frontend/src/routes.ts frontend/src/App.svelte
git add frontend/src/components/Sidebar.svelte frontend/src/components/MobileNav.svelte
git add vercel.json frontend/e2e/routing.spec.ts
git add -u frontend/src/components/betting/ frontend/src/components/BettingHistory.svelte frontend/src/components/BettingHistory.test.ts
git commit -m "P0b: routing slice — svelte-routing + URL-driven sub-tabs, redirect map, killed-feature components removed"
```

---

