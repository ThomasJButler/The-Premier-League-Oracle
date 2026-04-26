# Phase 0 — Slice P0d — Shells

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-0-foundation/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`  
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P0d — Shells slice

**Slice goal:** Build `BroadcastShell.svelte` (the new sidebar + topbar + slot), `Tabs.svelte` (segmented pill for sub-tabs), `MobileTabBar.svelte` (5-tab bottom bar), `MobileBottomSheet.svelte` (overflow sheet for "More" entry). Also create the new stores: `density`, `supportingClub`. Mount `BroadcastShell` as the new app shell — `App.svelte`'s outer chrome now uses it; the existing legacy components inside still render.

**Manual gate:** human eyeball on desktop + mobile, dark + light. Smoke test: app boots, navigates between hubs via sidebar/tabbar, theme toggle works, supporting-club picker effect lands.

### Task 1: Create the density and supportingClub stores

**Files:**
- Create: `frontend/src/stores/density.ts`
- Create: `frontend/src/stores/supportingClub.ts`

- [ ] **Step 1: Write density.ts**

```ts
import { writable } from 'svelte/store';
import type { Density } from '../types/redesign';

const KEY = 'oracle_density';

function read(): Density {
  if (typeof window === 'undefined') return 'comfortable';
  return (localStorage.getItem(KEY) as Density) ?? 'comfortable';
}

function createDensityStore() {
  const { subscribe, set: rawSet } = writable<Density>(read());
  return {
    subscribe,
    set(value: Density) {
      rawSet(value);
      if (typeof window !== 'undefined') localStorage.setItem(KEY, value);
    },
  };
}

export const density = createDensityStore();
```

- [ ] **Step 2: Write supportingClub.ts**

```ts
import { writable } from 'svelte/store';

const KEY = 'favourite_team';   // matches the existing localStorage key, preserves user data

function read(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

function applyDom(team: string | null) {
  if (typeof document === 'undefined') return;
  if (team) document.documentElement.dataset.team = team;
  else delete document.documentElement.dataset.team;
}

function createSupportingClubStore() {
  const { subscribe, set: rawSet } = writable<string | null>(read());
  applyDom(read());
  return {
    subscribe,
    set(value: string | null) {
      rawSet(value);
      if (typeof window !== 'undefined') {
        if (value) localStorage.setItem(KEY, value);
        else localStorage.removeItem(KEY);
      }
      applyDom(value);
    },
  };
}

export const supportingClub = createSupportingClubStore();
```

- [ ] **Step 3: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

### Task 2: BroadcastShell — write smoke test, then component

**Files:**
- Create: `frontend/src/components/layout/BroadcastShell.test.ts`
- Create: `frontend/src/components/layout/BroadcastShell.svelte`

- [ ] **Step 1: Write the smoke test**

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BroadcastShell from './BroadcastShell.svelte';

describe('BroadcastShell', () => {
  it('renders sidebar items from the route table', () => {
    const { getByText } = render(BroadcastShell);
    // 6 hubs in sidebar: Today, Fixtures, Predictions, Oracle, Insights, Settings
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Fixtures')).toBeTruthy();
    expect(getByText('Predictions')).toBeTruthy();
    expect(getByText('Oracle')).toBeTruthy();
    expect(getByText('Insights')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders a slot for content', () => {
    const { container } = render(BroadcastShell);
    expect(container.querySelector('main')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, see fail, then implement BroadcastShell.svelte**

```svelte
<script lang="ts">
  import { Link } from 'svelte-routing';
  import { ROUTES } from '../../routes';
  import Icon from '../atoms/Icon.svelte';
  import { isDarkMode } from '../../stores/theme';

  $: sidebarItems = ROUTES.filter((r) => r.inSidebar);

  function toggleTheme() { isDarkMode.toggle(); }
</script>

<div class="flex h-screen bg-background text-foreground overflow-hidden">
  <!-- Sidebar -->
  <aside class="hidden lg:flex w-64 flex-col bg-card border-r border-border">
    <div class="p-4 border-b border-border">
      <span class="text-display">Oracle</span>
    </div>
    <nav class="flex-1 overflow-y-auto p-2">
      {#each sidebarItems as item}
        <Link to={item.path} class="flex items-center gap-3 px-3 py-2 rounded-md text-label hover:bg-surface-hover">
          {item.label}
        </Link>
      {/each}
    </nav>
    <button on:click={toggleTheme} class="p-3 m-2 rounded-md hover:bg-surface-hover text-label flex items-center gap-2">
      <Icon name={$isDarkMode ? 'circle' : 'dot'} size={16} />
      Toggle theme
    </button>
  </aside>

  <!-- Content -->
  <main class="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8" aria-label="Premier League Oracle content">
    <slot />
  </main>
</div>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/layout/BroadcastShell.test.ts`

Expected: 2 tests PASS.

If the test fails because `Link` isn't being rendered without a `<Router>` wrapper, wrap the test render in a `<Router>` test helper:

```ts
import { Router } from 'svelte-routing';
import { render } from '@testing-library/svelte';
import BroadcastShell from './BroadcastShell.svelte';
// ...
const { getByText } = render(Router, {
  props: { url: '/today' },
  // pass BroadcastShell via slot
});
```

If `@testing-library/svelte` slot APIs aren't ergonomic, an alternative is to mock `svelte-routing`:

```ts
vi.mock('svelte-routing', () => ({ Link: (await import('./LinkStub.svelte')).default }));
```

Pick whichever is simpler given the test runner shape.

### Task 3: Tabs — write test, then component

**Files:**
- Create: `frontend/src/components/layout/Tabs.test.ts`
- Create: `frontend/src/components/layout/Tabs.svelte`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Tabs from './Tabs.svelte';

describe('Tabs', () => {
  const tabs = [
    { slug: 'live', label: 'Live' },
    { slug: 'matches', label: 'Matches' },
    { slug: 'standings', label: 'Standings' },
  ];

  it('renders all tabs from props', () => {
    const { getByText } = render(Tabs, { props: { tabs, active: 'matches', basePath: '/fixtures' } });
    expect(getByText('Live')).toBeTruthy();
    expect(getByText('Matches')).toBeTruthy();
    expect(getByText('Standings')).toBeTruthy();
  });

  it('marks the active tab with aria-selected', () => {
    const { getByText } = render(Tabs, { props: { tabs, active: 'matches', basePath: '/fixtures' } });
    expect(getByText('Matches').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('true');
    expect(getByText('Live').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('false');
  });
});
```

- [ ] **Step 2: Implement Tabs.svelte**

```svelte
<script lang="ts">
  import { Link } from 'svelte-routing';
  import type { SubTabDef } from '../../routes';

  export let tabs: SubTabDef[];
  export let active: string;
  export let basePath: string;
</script>

<nav role="tablist" class="inline-flex rounded-md border border-border bg-bg-inset p-1">
  {#each tabs as tab}
    <Link
      to={`${basePath}/${tab.slug}`}
      role="tab"
      aria-selected={tab.slug === active}
      class="px-3 py-1 rounded-sm text-label {tab.slug === active ? 'bg-card text-foreground' : 'text-text-muted hover:text-foreground'}"
    >
      {tab.label}
    </Link>
  {/each}
</nav>
```

- [ ] **Step 3: Run test, confirm green**

Run: `cd frontend && npm run test -- --run src/components/layout/Tabs.test.ts`

Expected: 2 tests PASS.

### Task 4: MobileTabBar + MobileBottomSheet — implement (smoke-test only)

**Files:**
- Create: `frontend/src/components/layout/MobileTabBar.svelte`
- Create: `frontend/src/components/layout/MobileBottomSheet.svelte`

- [ ] **Step 1: Implement MobileTabBar.svelte**

```svelte
<script lang="ts">
  import { Link } from 'svelte-routing';
  import { ROUTES } from '../../routes';
  import Icon, { type IconName } from '../atoms/Icon.svelte';

  // Phase 0d: 5 tabs — Today, Fixtures, Predictions, Oracle, More.
  // The 'More' tab opens a bottom sheet (slot fired by parent on click).
  const ICON_FOR: Record<string, IconName> = {
    '/today':       'home',
    '/fixtures':    'calendar',
    '/predictions': 'target',
    '/oracle':      'chart-line',
  };

  $: primary = ROUTES.filter((r) => r.inMobileBar);
  export let onMore: () => void = () => {};
</script>

<nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around p-2 z-30">
  {#each primary as item}
    <Link to={item.path} class="flex flex-col items-center gap-1 px-2 py-1 text-body-sm text-text-muted">
      <Icon name={ICON_FOR[item.path]} size={20} />
      {item.label}
    </Link>
  {/each}
  <button on:click={onMore} class="flex flex-col items-center gap-1 px-2 py-1 text-body-sm text-text-muted">
    <Icon name="menu" size={20} />
    More
  </button>
</nav>
```

- [ ] **Step 2: Implement MobileBottomSheet.svelte**

```svelte
<script lang="ts">
  import Icon from '../atoms/Icon.svelte';
  export let open: boolean = false;
  export let onClose: () => void = () => {};
</script>

{#if open}
  <div
    class="lg:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
    on:click={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    role="presentation"
  >
    <div
      class="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
    >
      <header class="flex items-center justify-between mb-4">
        <span class="text-title">More</span>
        <button on:click={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </header>
      <slot />
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Run svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

### Task 5: Mount BroadcastShell in App.svelte

**Files:**
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: Refactor App.svelte to use BroadcastShell as the outer chrome**

Replace App.svelte from Task 3 of P0b with:

```svelte
<script lang="ts">
  import { Router, Route, navigate } from 'svelte-routing';
  import BroadcastShell from './components/layout/BroadcastShell.svelte';
  import MobileTabBar from './components/layout/MobileTabBar.svelte';
  import MobileBottomSheet from './components/layout/MobileBottomSheet.svelte';
  import LiveTicker from './components/LiveTicker.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import MatchList from './components/MatchList.svelte';
  import Predictions from './components/Predictions.svelte';
  import LiveMatches from './components/LiveMatches.svelte';
  import StandingsTable from './components/StandingsTable.svelte';
  import KellyCalculator from './components/betting/KellyCalculator.svelte';
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
  import { supportingClub } from './stores/supportingClub';
  import { REDIRECTS } from './routes';

  export let url = '';

  let showApiSetup = false;
  let mobileSheetOpen = false;
  let dashboardComponent: Dashboard;

  function applyRedirect(): boolean {
    const here = window.location.pathname;
    const target = REDIRECTS[here];
    if (target && here !== target.split('?')[0]) {
      navigate(target, { replace: true });
      return true;
    }
    return false;
  }

  onMount(() => {
    isDarkMode.init();
    // supportingClub store self-initialises from localStorage at module load
    void supportingClub;
    applyRedirect();
    checkApiKey();
  });

  function checkApiKey() {
    const apiKey = localStorage.getItem('football_data_api_key');
    if (!apiKey) showApiSetup = true;
  }

  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
    if (dashboardComponent) setTimeout(() => dashboardComponent.refresh(), 100);
  }
</script>

<Router {url}>
  <BroadcastShell>
    <LiveTicker />

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
  </BroadcastShell>

  <MobileTabBar onMore={() => (mobileSheetOpen = true)} />
  <MobileBottomSheet open={mobileSheetOpen} onClose={() => (mobileSheetOpen = false)}>
    <a href="/insights/scorers" class="block py-2 text-label">Insights</a>
    <a href="/settings/account" class="block py-2 text-label">Settings</a>
  </MobileBottomSheet>

  {#if showApiSetup}
    <ApiSetupWizard on:complete={handleApiSetupComplete} />
  {/if}
</Router>
```

- [ ] **Step 2: Confirm svelte-check + vitest pass**

Run: `cd frontend && npm run check && npm run test -- --run`

Expected: both green. The legacy `Header.svelte`, `Sidebar.svelte`, `MobileNav.svelte` are now unimported — they remain in the tree, scheduled for P10 cleanup deletion.

### Task 6: Manual smoke + commit P0d

- [ ] **Step 1: Boot the dev server and click through every hub**

Run: `cd frontend && npm run dev`

Open `http://localhost:5173/today`. Verify:
- Sidebar shows the 6 hub labels (Today, Fixtures, Predictions, Oracle, Insights, Settings)
- Click each — URL updates and the corresponding legacy component renders
- Toggle theme — surfaces flip between cream and near-black
- Resize to <1024px — sidebar disappears, mobile bottom bar appears with 5 tabs (Today, Fixtures, Predictions, Oracle, More); clicking "More" opens the sheet
- Visit `/dashboard` (legacy URL) — redirects to `/today`
- Hard-refresh on `/predictions/log` — page still loads (Vercel SPA fallback works only on Vercel; in `npm run dev` Vite handles this natively)

- [ ] **Step 2: If anything is broken, append a note**

If a click-through reveals a broken behavior, append a one-line note to `ClaudeRalph/IMPLEMENTATION_PLAN.md` under `## Notes / discoveries` describing the issue, and stop the slice. Fix in a follow-up iteration; don't expand P0d's scope.

- [ ] **Step 3: Commit P0d**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/src/stores/density.ts frontend/src/stores/supportingClub.ts
git add frontend/src/components/layout/
git add frontend/src/App.svelte
git commit -m "P0d: shells slice — BroadcastShell, Tabs, MobileTabBar, MobileBottomSheet; new shell mounted around legacy screens"
```

---

