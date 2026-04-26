# Phase 2 — Slice P2a — Command strip + hero match

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-2-today/index.md`](./index.md)
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 (Today)
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P2a — Command strip + hero match

**Slice goal:** Stand up `screens/Today.svelte` mounted at `/today`, replacing legacy `Dashboard.svelte` in the route table. The screen renders only two zones in this slice: a sticky 56px **command strip** (GW number, kickoff countdown, accuracy chip, API status dot, `[Predict GWxx]` button) and a **hero MatchCard** in `variant="emphasised"` with `defaultOpen="analyse"`. P2b/P2c append the rest of the page.

**Manual gate:** ralph commits when `npm run check`, `npm run test -- --run`, and Playwright routing smoke pass. Human flips `[x]` after eyeball — `/today` is the redesign's first user-visible flagship surface, so visual quality matters.

### Task 1: Create `lib/gameweek.ts` (pure helper)

**Files:**
- Create: `frontend/src/lib/gameweek.ts`
- Create: `frontend/src/lib/gameweek.test.ts`

The helper finds the "current" gameweek from a list of legacy `Match` records — first non-FINISHED match's `matchday` if any, else the highest matchday seen.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { findCurrentGameweek, fixturesForGameweek, nextKickoff } from './gameweek';
import type { Match } from '../types';

function mk(over: Partial<Match> = {}): Match {
  return {
    id: 'm-1',
    competition: { id: 1, name: 'Premier League', code: 'PL' },
    season: { id: 1, startDate: '', endDate: '', currentMatchday: 35 },
    utcDate: '2026-04-30T19:00:00Z',
    status: 'SCHEDULED',
    matchday: 35,
    homeTeam: { id: 1, name: 'Liverpool', shortName: 'Liverpool', tla: 'LIV', crest: '' },
    awayTeam: { id: 2, name: 'Arsenal',   shortName: 'Arsenal',   tla: 'ARS', crest: '' },
    score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    ...over,
  } as Match;
}

describe('lib/gameweek', () => {
  it('findCurrentGameweek returns the matchday of the next non-FINISHED fixture', () => {
    const matches = [
      mk({ id: 'a', matchday: 34, status: 'FINISHED' }),
      mk({ id: 'b', matchday: 35, status: 'SCHEDULED', utcDate: '2026-05-01T15:00:00Z' }),
      mk({ id: 'c', matchday: 36, status: 'SCHEDULED', utcDate: '2026-05-08T15:00:00Z' }),
    ];
    expect(findCurrentGameweek(matches)).toBe(35);
  });

  it('findCurrentGameweek returns null when all matches are finished', () => {
    expect(findCurrentGameweek([mk({ status: 'FINISHED' })])).toBe(null);
  });

  it('fixturesForGameweek filters by matchday and status SCHEDULED', () => {
    const matches = [
      mk({ id: 'a', matchday: 35, status: 'SCHEDULED' }),
      mk({ id: 'b', matchday: 35, status: 'FINISHED' }),
      mk({ id: 'c', matchday: 36, status: 'SCHEDULED' }),
    ];
    const out = fixturesForGameweek(matches, 35);
    expect(out.map(m => m.id)).toEqual(['a']);
  });

  it('nextKickoff returns the earliest upcoming fixture', () => {
    const earlier = mk({ id: 'early', utcDate: '2026-04-30T15:00:00Z' });
    const later   = mk({ id: 'late',  utcDate: '2026-04-30T19:00:00Z' });
    expect(nextKickoff([later, earlier])?.id).toBe('early');
  });

  it('nextKickoff returns null when no fixtures are scheduled', () => {
    expect(nextKickoff([mk({ status: 'FINISHED' })])).toBe(null);
  });
});
```

- [ ] **Step 2: Implement the helper to pass the test**

```ts
import type { Match } from '../types';

export function findCurrentGameweek(matches: Match[]): number | null {
  const upcoming = matches
    .filter(m => m.status !== 'FINISHED' && typeof m.matchday === 'number')
    .sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));
  return upcoming.length > 0 ? (upcoming[0].matchday as number) : null;
}

export function fixturesForGameweek(matches: Match[], matchday: number): Match[] {
  return matches
    .filter(m => m.matchday === matchday && m.status === 'SCHEDULED')
    .sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));
}

export function nextKickoff(matches: Match[]): Match | null {
  const upcoming = matches
    .filter(m => m.status !== 'FINISHED')
    .sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));
  return upcoming[0] ?? null;
}
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/lib/gameweek.test.ts`

Expected: 5 tests PASS.

### Task 2: Create `lib/adapters/v3.ts` (legacy → v3 type mapping)

**Files:**
- Create: `frontend/src/lib/adapters/v3.ts`
- Create: `frontend/src/lib/adapters/v3.test.ts`

These adapters convert the existing `Match` and `StoredPrediction` shapes into the v3 `Fixture` / `MatchPrediction` shapes that `MatchCard` and `MatchRow` expect.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { matchToFixture, predictionToV3 } from './v3';
import type { Match } from '../../types';
import type { StoredPrediction } from '../../services/predictionTracker';

const baseMatch: Match = {
  id: 1234,
  competition: { id: 1, name: 'Premier League', code: 'PL' },
  season: { id: 1, startDate: '', endDate: '', currentMatchday: 35 },
  utcDate: '2026-04-30T19:00:00Z',
  status: 'SCHEDULED',
  matchday: 35,
  homeTeam: { id: 1, name: 'Liverpool FC', shortName: 'Liverpool', tla: 'LIV', crest: 'https://x/liv.svg' },
  awayTeam: { id: 2, name: 'Arsenal FC',   shortName: 'Arsenal',   tla: 'ARS', crest: 'https://x/ars.svg' },
  score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
} as unknown as Match;

describe('matchToFixture', () => {
  it('produces a Fixture with TLAs as abbr and crest URLs preserved', () => {
    const fx = matchToFixture(baseMatch);
    expect(fx.id).toBe('1234');
    expect(fx.competition).toBe('Premier League');
    expect(fx.gameweek).toBe(35);
    expect(fx.utcDate).toBe('2026-04-30T19:00:00Z');
    expect(fx.status).toBe('SCHEDULED');
    expect(fx.home.abbr).toBe('LIV');
    expect(fx.home.crestUrl).toBe('https://x/liv.svg');
    expect(fx.away.abbr).toBe('ARS');
  });

  it('maps a finished score block to the v3 score field', () => {
    const finished = { ...baseMatch, status: 'FINISHED', score: { fullTime: { home: 2, away: 0 }, halfTime: { home: 1, away: 0 } } } as Match;
    const fx = matchToFixture(finished);
    expect(fx.score).toEqual({ home: 2, away: 0 });
  });

  it('omits score when fullTime values are null', () => {
    const fx = matchToFixture(baseMatch);
    expect(fx.score).toBeUndefined();
  });
});

describe('predictionToV3', () => {
  const stored: StoredPrediction = {
    id: 'p-1',
    matchId: '1234',
    homeTeam: 'Liverpool',
    awayTeam: 'Arsenal',
    predictedResult: 'H',
    predictedHomeGoals: 2,
    predictedAwayGoals: 0,
    confidence: 0.62,
    timestamp: '2026-04-26T10:00:00Z',
    matchDate: '2026-04-30T19:00:00Z',
    matchday: 35,
    poissonProbs: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
  };

  it('maps stored fields into the v3 MatchPrediction shape', () => {
    const v3 = predictionToV3(stored);
    expect(v3?.pick).toBe('HOME');
    expect(v3?.pickConfidence).toBeCloseTo(0.62);
    expect(v3?.ensemble).toEqual({ home: 0.55, draw: 0.25, away: 0.20 });
  });

  it('returns undefined when no poissonProbs are present (no probabilities to map)', () => {
    const noProbs = { ...stored, poissonProbs: undefined };
    expect(predictionToV3(noProbs)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement the adapters**

```ts
import type { Match } from '../../types';
import type { StoredPrediction } from '../../services/predictionTracker';
import type { Fixture, FixtureStatus, MatchPrediction, TeamSummary } from '../../types/redesign';

function teamFrom(t: Match['homeTeam']): TeamSummary {
  return {
    abbr: t.tla ?? t.shortName?.slice(0, 3).toUpperCase() ?? 'XXX',
    name: t.shortName ?? t.name,
    crestUrl: t.crest,
  };
}

export function matchToFixture(m: Match): Fixture {
  const fullHome = m.score?.fullTime?.home;
  const fullAway = m.score?.fullTime?.away;
  const score =
    typeof fullHome === 'number' && typeof fullAway === 'number'
      ? { home: fullHome, away: fullAway }
      : undefined;

  return {
    id: String(m.id),
    competition: m.competition?.name ?? '',
    gameweek: m.matchday ?? 0,
    utcDate: m.utcDate,
    status: (m.status as FixtureStatus) ?? 'SCHEDULED',
    home: teamFrom(m.homeTeam),
    away: teamFrom(m.awayTeam),
    score,
  };
}

const PICK_MAP: Record<StoredPrediction['predictedResult'], MatchPrediction['pick']> = {
  H: 'HOME', A: 'AWAY', D: 'DRAW',
};

export function predictionToV3(p: StoredPrediction): MatchPrediction | undefined {
  if (!p.poissonProbs) return undefined;
  return {
    ensemble: {
      home: p.poissonProbs.homeWin,
      draw: p.poissonProbs.draw,
      away: p.poissonProbs.awayWin,
    },
    models: [],
    topScorelines: [
      { home: p.predictedHomeGoals, away: p.predictedAwayGoals, prob: p.confidence },
    ],
    xg: { home: 0, away: 0 },
    elo: { home: 0, away: 0 },
    pick: PICK_MAP[p.predictedResult],
    pickConfidence: p.confidence,
    keyFactors: p.keyFactors,
  };
}
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/lib/adapters/`

Expected: 5 tests PASS. If field names on `Match` differ in this codebase (`fullTime.home` vs `home`), inspect `frontend/src/types.ts` and adjust the adapter accordingly — the **tests** are the contract; the implementation conforms to them.

### Task 3: Create `CommandStrip.svelte` (sticky 56px)

**Files:**
- Create: `frontend/src/components/today/CommandStrip.svelte`
- Create: `frontend/src/components/today/CommandStrip.test.ts`

The strip is dumb: it receives every value as a prop. Today.svelte does the wiring.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { Router } from 'svelte-routing';
import CommandStrip from './CommandStrip.svelte';
import LinkStub from '../../tests/LinkStub.svelte';

vi.mock('svelte-routing', async () => {
  const actual = await vi.importActual<typeof import('svelte-routing')>('svelte-routing');
  return { ...actual, Link: (await import('../../tests/LinkStub.svelte')).default, navigate: vi.fn() };
});

describe('CommandStrip', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-04-30T17:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('renders the gameweek number and accuracy chip', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: '2026-04-30T19:00:00Z', accuracyPct: 67, apiHealthy: true },
    });
    expect(container.textContent).toContain('GW 35');
    expect(container.textContent).toContain('67%');
  });

  it('formats the countdown as Hh Mm when more than an hour out', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: '2026-04-30T19:00:00Z', accuracyPct: 67, apiHealthy: true },
    });
    // 2h 0m remaining
    expect(container.textContent).toMatch(/2h 0m/);
  });

  it('falls back to "—" countdown when no kickoff is supplied', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: null, kickoffIso: null, accuracyPct: 0, apiHealthy: false },
    });
    expect(container.querySelector('[data-countdown]')?.textContent).toContain('—');
  });

  it('renders an api-dot with data-healthy reflecting the prop', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: null, accuracyPct: 50, apiHealthy: false },
    });
    expect(container.querySelector('[data-api-dot]')?.getAttribute('data-healthy')).toBe('false');
  });

  it('renders the [Predict GW{n}] button with the right label', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: null, accuracyPct: 50, apiHealthy: true },
    });
    expect(container.querySelector('[data-predict-cta]')?.textContent).toMatch(/Predict GW\s*35/);
  });
});
```

- [ ] **Step 2: Implement the component**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Link } from 'svelte-routing';

  export let gameweek: number | null;
  export let kickoffIso: string | null;
  export let accuracyPct: number;
  export let apiHealthy: boolean;

  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => { timer = setInterval(() => (now = Date.now()), 1000); });
  onDestroy(() => { if (timer) clearInterval(timer); });

  $: kickoffMs = kickoffIso ? +new Date(kickoffIso) : null;
  $: countdown = formatCountdown(kickoffMs, now);

  function formatCountdown(target: number | null, current: number): string {
    if (target === null) return '—';
    const diff = target - current;
    if (diff <= 0) return 'KICKING OFF';
    const totalMin = Math.floor(diff / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return `${d}d ${h % 24}h`;
    }
    return `${h}h ${m}m`;
  }
</script>

<div
  class="sticky top-0 z-20 h-14 px-4 flex items-center justify-between bg-bg-raised border-b border-border"
  data-command-strip
>
  <div class="flex items-center gap-4 text-body-sm">
    <span class="text-eyebrow text-text-dim">GW {gameweek ?? '—'}</span>
    <span class="font-mono text-text-dim" data-countdown>{countdown}</span>
    <span class="px-2 py-0.5 rounded-full bg-bg-inset text-label">
      {Math.round(accuracyPct)}% accuracy
    </span>
    <span
      class="inline-block h-2 w-2 rounded-full {apiHealthy ? 'bg-accent' : 'bg-warning'}"
      data-api-dot
      data-healthy={String(apiHealthy)}
      aria-label={apiHealthy ? 'API healthy' : 'API stale'}
    ></span>
  </div>

  {#if gameweek !== null}
    <Link to="/predictions/this-week" class="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-label" data-predict-cta>
      Predict GW {gameweek}
    </Link>
  {/if}
</div>
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/components/today/`

Expected: 5 tests PASS.

### Task 4: Create `screens/Today.svelte` (skeleton — strip + hero only)

**Files:**
- Create: `frontend/src/screens/Today.svelte`
- Create: `frontend/src/screens/Today.test.ts`

P2a's Today renders only the command strip and the hero `MatchCard`. P2b/P2c append KPIs, grid, and below-fold zones. The skeleton must already handle the "loading" and "no upcoming fixtures" states so the screen never blanks under degraded data.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import Today from './Today.svelte';

vi.mock('svelte-routing', async () => {
  const actual = await vi.importActual<typeof import('svelte-routing')>('svelte-routing');
  return { ...actual, Link: (await import('../tests/LinkStub.svelte')).default, navigate: vi.fn() };
});

vi.mock('../services/dataService', () => ({
  dataService: {
    getCurrentSeasonMatches: vi.fn().mockResolvedValue([
      { id: 1, matchday: 35, status: 'SCHEDULED', utcDate: '2026-05-01T15:00:00Z',
        competition: { name: 'Premier League' },
        homeTeam: { tla: 'LIV', name: 'Liverpool', shortName: 'Liverpool', crest: '' },
        awayTeam: { tla: 'ARS', name: 'Arsenal',   shortName: 'Arsenal',   crest: '' },
        score: { fullTime: { home: null, away: null } } },
    ]),
    getLastFetched: vi.fn().mockReturnValue(Date.now()),
  },
}));

vi.mock('../services/predictionTracker', () => ({
  predictionTracker: {
    getAccuracyStats: vi.fn().mockReturnValue({
      totalPredictions: 12, correctPredictions: 8, accuracy: 67,
      averageConfidence: 0.55, scoreAccuracy: 0,
      highConfidenceAccuracy: 0, mediumConfidenceAccuracy: 0, lowConfidenceAccuracy: 0,
      homeWinAccuracy: 0, awayWinAccuracy: 0, drawAccuracy: 0,
      streak: { current: 0, best: 0, worst: 0 },
    }),
    getRecentPredictions: vi.fn().mockReturnValue([]),
    getAccuracyByGameweek: vi.fn().mockReturnValue([]),
  },
}));

describe('Today screen — P2a skeleton', () => {
  it('renders the command strip with the resolved gameweek', async () => {
    const { container } = render(Today);
    await waitFor(() => {
      expect(container.querySelector('[data-command-strip]')).toBeTruthy();
    });
    expect(container.textContent).toContain('GW 35');
  });

  it('renders the hero match as an emphasised MatchCard with analyse open by default', async () => {
    const { container } = render(Today);
    await waitFor(() => {
      const hero = container.querySelector('[data-zone="hero"]');
      expect(hero).toBeTruthy();
      // shadow-emphasised proves variant="emphasised"
      expect(hero?.innerHTML).toMatch(/shadow-emphasised/);
      // analyse section open by default
      expect(hero?.querySelector('[data-section="analyse"] button')?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('renders an empty hero placeholder when no upcoming fixtures exist', async () => {
    const { dataService } = await import('../services/dataService');
    (dataService.getCurrentSeasonMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const { container } = render(Today);
    await waitFor(() => {
      expect(container.querySelector('[data-zone="hero-empty"]')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Implement the screen skeleton**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { dataService } from '../services/dataService';
  import { predictionTracker } from '../services/predictionTracker';
  import { findCurrentGameweek, nextKickoff } from '../lib/gameweek';
  import { matchToFixture, predictionToV3 } from '../lib/adapters/v3';
  import MatchCard from '../components/matchcard/MatchCard.svelte';
  import CommandStrip from '../components/today/CommandStrip.svelte';
  import type { Match } from '../types';
  import type { Fixture, MatchPrediction } from '../types/redesign';

  let matches: Match[] = [];
  let loaded = false;

  $: gameweek = loaded ? findCurrentGameweek(matches) : null;
  $: heroMatch = loaded ? nextKickoff(matches) : null;
  $: heroFixture = heroMatch ? matchToFixture(heroMatch) : null;
  $: heroPrediction = pickPredictionForMatch(heroFixture);
  $: kickoffIso = heroMatch?.utcDate ?? null;

  $: stats = predictionTracker.getAccuracyStats();
  $: apiHealthy = isApiHealthy();

  function isApiHealthy(): boolean {
    const last = dataService.getLastFetched('matches');
    if (!last) return false;
    return Date.now() - last < 5 * 60 * 1000;
  }

  function pickPredictionForMatch(fx: Fixture | null): MatchPrediction | undefined {
    if (!fx) return undefined;
    const stored = predictionTracker.getMatchPredictions(fx.id)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  onMount(async () => {
    try {
      matches = await dataService.getCurrentSeasonMatches();
    } catch {
      matches = [];
    }
    loaded = true;
  });
</script>

<div class="flex flex-col gap-6">
  <CommandStrip
    {gameweek}
    {kickoffIso}
    accuracyPct={stats.accuracy}
    {apiHealthy}
  />

  {#if heroFixture}
    <div class="px-4" data-zone="hero">
      <MatchCard
        fixture={heroFixture}
        prediction={heroPrediction}
        variant="emphasised"
        defaultOpen="analyse"
      />
    </div>
  {:else if loaded}
    <div class="px-4 py-8 text-center text-text-dim" data-zone="hero-empty">
      No upcoming fixtures. Check back when the next gameweek opens.
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/screens/Today.test.ts`

Expected: 3 tests PASS.

### Task 5: Wire `App.svelte` to mount `Today` at `/today`

**Files:**
- Modify: `frontend/src/App.svelte`

- [ ] **Step 1: Replace the import and the route**

In the `<script>` import block, **remove** the legacy `Dashboard` import (the new `Today` screen owns this surface):

```diff
- import Dashboard from './components/Dashboard.svelte';
+ import Today from './screens/Today.svelte';
```

The `dashboardComponent` ref and the `setTimeout(() => dashboardComponent.refresh(), 100)` call inside `handleApiSetupComplete` are no longer needed — `Today.svelte` re-fetches via its own `onMount` after the wizard's `complete` event triggers re-mount-on-key. Remove the ref:

```diff
- let dashboardComponent: Dashboard;
```

```diff
  async function handleApiSetupComplete(event: CustomEvent<{ apiKey: string }>) {
    showApiSetup = false;
    if (!event.detail.apiKey) return;
    footballDataAPI.setApiKey(event.detail.apiKey);
    await dataService.clearCache();
    await dataService.refreshApiConfiguration();
-   if (dashboardComponent) {
-     setTimeout(() => dashboardComponent.refresh(), 100);
-   }
  }
```

In the `<Router>` template, swap the `/today` route:

```diff
- <Route path="/today"><Dashboard bind:this={dashboardComponent} /></Route>
+ <Route path="/today"><Today /></Route>
```

`Dashboard.svelte` itself stays in the file tree (deleted in P10 cleanup) but is no longer imported anywhere.

- [ ] **Step 2: Verify svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors. If a stale reference to `dashboardComponent` slipped through, svelte-check will flag it.

### Task 6: Run the full validation gate

- [ ] **Step 1: Vitest full suite**

Run: `cd frontend && npm run test -- --run`

Expected: green. Test count grows by ~13 (gameweek 5 + adapters 5 + CommandStrip 5 + Today 3 = 18, minus any legacy `App.test.ts` cases that asserted on the `Dashboard`-mount path which need updating to look for `Today` instead).

If a legacy test asserts on Dashboard markup, update it to assert on `[data-command-strip]` or `[data-zone="hero"]` — those are the stable contracts going forward.

- [ ] **Step 2: svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 3: Playwright routing smoke**

Run: `cd frontend && npx playwright test e2e/routing.spec.ts --project=desktop-chrome`

Expected: green. The `/today` route still responds — but now with the new shell. If a routing assertion grepped for legacy Dashboard text ("Premier League Oracle" headline, etc.), update it to match the new strip's "GW xx" text.

### Task 7: Update IMPLEMENTATION_PLAN.md and commit (manual gate — human eyeball pending after commit)

- [ ] **Step 1: Update IMPLEMENTATION_PLAN.md**

Leave P2a's `[ ]` unchecked (manual gate — human flips). Add a Phase 2 progress note under `## Notes / discoveries`:

```md
- **(P2a, awaiting human eyeball)** P2a shipped Today.svelte skeleton + CommandStrip.svelte. App.svelte's /today route now mounts Today; legacy Dashboard.svelte stays in the tree until P10. vitest <N>/<N> across <M> files, svelte-check 0/0, routing smoke green. Manual sweep checklist below.
```

Update the "Active phase" line to reflect P2a sitting on the human's desk.

- [ ] **Step 2: Commit**

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add IMPLEMENTATION_PLAN.md \
        frontend/src/screens/Today.svelte \
        frontend/src/screens/Today.test.ts \
        frontend/src/components/today/CommandStrip.svelte \
        frontend/src/components/today/CommandStrip.test.ts \
        frontend/src/lib/gameweek.ts \
        frontend/src/lib/gameweek.test.ts \
        frontend/src/lib/adapters/v3.ts \
        frontend/src/lib/adapters/v3.test.ts \
        frontend/src/App.svelte
git commit -m "P2a: Today screen — sticky command strip + emphasised hero MatchCard"
```

- [ ] **Step 3: Surface the manual sweep checklist**

```
P2a committed. Phase 2 P2a manual sweep checklist (boot npm run dev):

[ ] /today — command strip sticks to top while scrolling (it doesn't matter that the page is short — verify the position class)
[ ] /today — countdown counter visibly ticks down (1s cadence)
[ ] /today — accuracy chip shows correct % from prediction tracker
[ ] /today — API status dot is green when matches just loaded; switch to airplane mode and reload to see amber
[ ] /today — [Predict GW xx] button navigates to /predictions/this-week
[ ] /today — hero is the most-imminent fixture, emphasised (primary ring), with AI ANALYSIS expanded by default
[ ] /today — no upcoming fixtures => empty-state placeholder shown (test by clearing matches in DevTools or seasons-end)
[ ] Toggle theme — colours flip cleanly, no FOUC

If everything looks right, flip P2a's [ ] to [x] in IMPLEMENTATION_PLAN.md.
If anything is wrong, drop notes under ## Human notes for next iteration.
```

## End of slice

By the end of P2a:
- `screens/Today.svelte` exists and renders at `/today`
- A reusable `lib/gameweek.ts` and `lib/adapters/v3.ts` are in place for P2b/P2c (and Phase 3) to consume
- `CommandStrip.svelte` is wired and ticking
- The hero `MatchCard` is the most-imminent fixture, emphasised, with analyse open

**Next slice:** [P2b — KPI strip + predictions grid](./p2b-kpi-strip-grid.md). P2b extends `predictionTracker.getAccuracyStats()` with a `brierScore` field, then appends the 4-tile KPI strip and the 2-col `MatchCard` grid below the hero.
