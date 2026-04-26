# P3a — Fixtures Live

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual.
**Tag at sign-off:** `v3.4`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 → "Fixtures hub — Phase 3 → `/fixtures/live`".

## Goal

Build the `/fixtures/live` screen — the in-play matches view of the Fixtures hub. Renders 1–3 currently-live `MatchCard`s, each preceded by a `<LiveBanner />` row showing minute, score, xG running totals (when available), and in-play probability shift since kickoff. Auto-refreshes every 30s and pauses when `document.hidden` is true (browser tab unfocused). Mounts at `/fixtures/live` via `App.svelte`'s `<Router>`.

## Surface area

- **New screen:** `frontend/src/screens/fixtures/Live.svelte` (+ `.test.ts`)
- **New atom-ish:** `frontend/src/components/fixtures/LiveBanner.svelte` (+ `.test.ts`)
- **Modified:** `frontend/src/App.svelte` — add `<Route path="/fixtures/live">` mounting `Live`
- **Read-only deps:** `dataService.getLiveMatches()`, `matchToFixture()`, `predictionToV3()`, `<MatchCard>`

Legacy `LiveMatches.svelte` and `LiveTicker.svelte` are **not** modified — they stay in tree (unimported after this slice) until P10 cleanup. Strangler-fig contract: ship-and-leave, delete later.

## Type contracts

### LiveBanner props

```ts
export interface LiveBannerProps {
  minute: number;            // 0..120 (caps at 120 for ET)
  score: string;             // "2-1" format, always two digits separated by dash
  xgHome?: number;           // 0..10 typically; absent when API doesn't expose xG
  xgAway?: number;           // same; render the xG row only when BOTH are present
  probShift?: {              // delta vs kickoff prediction; absent for first poll
    home: number;            // -1..1
    draw: number;
    away: number;
  };
}
```

### Live.svelte derived state

```ts
let liveMatches: Match[] = [];     // populated by dataService.getLiveMatches()
let loaded = false;                // first-load flag
let pollIntervalId: number | null = null;

$: liveFixtures = liveMatches.map(matchToFixture);
$: livePredictions = liveMatches.map(m => pickPredictionForMatch(m.id));  // returns Map<id, MatchPrediction|undefined>
```

## TDD task list

Each task is one ralph iteration. Run in order. Auto-gated sub-tasks may be folded into the parent commit if the diff is small (e.g. Task 1 is small enough to merge into Task 2's commit).

### Task 1 — `LiveBanner.svelte` + 6 tests *(auto-gated sub-step)*

Pure presentational component. No data fetching, no side effects.

**Test file: `frontend/src/components/fixtures/LiveBanner.test.ts`**

```ts
import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LiveBanner from './LiveBanner.svelte';

describe('LiveBanner', () => {
  it('renders with the [data-live-banner] root and [data-pulse] indicator', () => {
    const { container } = render(LiveBanner, { props: { minute: 23, score: '0-0' } });
    expect(container.querySelector('[data-live-banner]')).toBeTruthy();
    expect(container.querySelector('[data-pulse]')).toBeTruthy();
  });

  it('renders the minute formatted as "MIN 67\'" inside [data-minute]', () => {
    const { container } = render(LiveBanner, { props: { minute: 67, score: '2-1' } });
    expect(container.querySelector('[data-minute]')?.textContent).toContain("67'");
  });

  it('renders the score in [data-score] using text-metric-lg sizing', () => {
    const { container } = render(LiveBanner, { props: { minute: 90, score: '3-2' } });
    const scoreEl = container.querySelector('[data-score]');
    expect(scoreEl?.textContent).toBe('3-2');
    expect(scoreEl?.className).toContain('text-metric-lg');
  });

  it('omits the [data-xg] row entirely when only one of xgHome/xgAway is provided', () => {
    const { container } = render(LiveBanner, { props: { minute: 30, score: '0-0', xgHome: 0.42 } });
    expect(container.querySelector('[data-xg]')).toBeNull();
  });

  it('renders the [data-xg] row when both xgHome AND xgAway are provided', () => {
    const { container } = render(LiveBanner, { props: { minute: 30, score: '0-0', xgHome: 0.42, xgAway: 0.18 } });
    const xg = container.querySelector('[data-xg]');
    expect(xg?.textContent).toContain('0.42');
    expect(xg?.textContent).toContain('0.18');
  });

  it('renders the [data-prob-shift] row when probShift is provided, omits when absent', () => {
    const withShift = render(LiveBanner, {
      props: { minute: 60, score: '1-1', probShift: { home: 0.05, draw: -0.10, away: 0.05 } }
    });
    expect(withShift.container.querySelector('[data-prob-shift]')).toBeTruthy();
    withShift.unmount();

    const noShift = render(LiveBanner, { props: { minute: 5, score: '0-0' } });
    expect(noShift.container.querySelector('[data-prob-shift]')).toBeNull();
  });
});
```

**Implementation template — `frontend/src/components/fixtures/LiveBanner.svelte`:**

```svelte
<script lang="ts">
  export let minute: number;
  export let score: string;
  export let xgHome: number | undefined = undefined;
  export let xgAway: number | undefined = undefined;
  export let probShift:
    | { home: number; draw: number; away: number }
    | undefined = undefined;

  $: hasXg = typeof xgHome === 'number' && typeof xgAway === 'number';
  $: hasProbShift = probShift !== undefined;
  $: clampedMinute = Math.min(Math.max(minute, 0), 120);
</script>

<div
  class="flex items-center gap-3 px-4 py-2 bg-card-raised border-l-2 border-destructive"
  data-live-banner
>
  <span class="w-2 h-2 rounded-full bg-destructive animate-pulse" data-pulse aria-hidden="true"></span>
  <span class="text-eyebrow tracking-wide text-text-dim" data-minute>MIN {clampedMinute}'</span>
  <span class="text-metric-lg font-semibold tabular-nums" data-score>{score}</span>

  {#if hasXg}
    <span class="text-body-sm text-text-dim ml-auto" data-xg>
      xG <span class="tabular-nums">{xgHome!.toFixed(2)}</span>
      —
      <span class="tabular-nums">{xgAway!.toFixed(2)}</span>
    </span>
  {/if}

  {#if hasProbShift}
    <span class="text-body-sm text-text-dim" data-prob-shift>
      Δ {(probShift!.home * 100).toFixed(0)}% / {(probShift!.draw * 100).toFixed(0)}% / {(probShift!.away * 100).toFixed(0)}%
    </span>
  {/if}
</div>
```

**TDD-discipline check:** all 6 tests fail pre-fix (component doesn't exist → import throws). All 6 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/components/fixtures/LiveBanner.test.ts`. Expect: 6/6 pass.

### Task 2 — `Live.svelte` skeleton + 4 baseline tests *(auto-gated sub-step)*

Just the screen with mounted `<LiveBanner>` + `<MatchCard>` per live match. **No polling yet** — that's Task 3. This split lets the rendering-shape tests land independently of the timer-mock tests.

**Test file: `frontend/src/screens/fixtures/Live.test.ts`**

```ts
import { act, render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Live from './Live.svelte';

vi.mock('../../services/dataService', () => ({
  dataService: {
    getLiveMatches: vi.fn().mockResolvedValue([]),
    getLastFetched: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../services/predictionTracker', () => ({
  predictionTracker: {
    getMatchPredictions: vi.fn().mockReturnValue([]),
  },
}));

const liveMatchFixture = (id: string, minute: number, score: [number, number]) => ({
  id,
  season_id: '2025-26',
  date: new Date(Date.now() - minute * 60_000).toISOString(),
  home_team: 'Liverpool FC',
  away_team: 'Arsenal FC',
  home_goals: score[0],
  away_goals: score[1],
  result: null,
  home_odds: null, draw_odds: null, away_odds: null,
  first_half_home_goals: null, first_half_away_goals: null,
  full_time_result: null, half_time_result: null,
  referee: null,
  home_shots: null, away_shots: null,
  home_shots_target: null, away_shots_target: null,
  home_fouls: null, away_fouls: null,
  home_corners: null, away_corners: null,
  home_yellows: null, away_yellows: null,
  home_reds: null, away_reds: null,
  created_at: new Date().toISOString(),
  status: 'IN_PLAY',
  minute,
});

describe('Live (Fixtures Live screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders [data-screen="fixtures-live"] root unconditionally', () => {
    const { container } = render(Live);
    expect(container.querySelector('[data-screen="fixtures-live"]')).toBeTruthy();
  });

  it('shows [data-live-empty] copy when no live matches after load', async () => {
    const { container, component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-live-empty]')).toBeTruthy();
    expect(container.querySelectorAll('[data-live-row]')).toHaveLength(0);
  });

  it('renders one [data-live-row] per live match (LiveBanner + MatchCard)', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getLiveMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      liveMatchFixture('m1', 23, [0, 0]),
      liveMatchFixture('m2', 67, [2, 1]),
      liveMatchFixture('m3', 89, [3, 2]),
    ]);
    const { container, component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelectorAll('[data-live-row]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-live-banner]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-block]')).toHaveLength(3); // MatchCard contract marker from P1a
  });

  it('does not render [data-live-empty] when there is at least one live match', async () => {
    const { dataService } = await import('../../services/dataService');
    (dataService.getLiveMatches as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      liveMatchFixture('m1', 23, [0, 0]),
    ]);
    const { container, component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(container.querySelector('[data-live-empty]')).toBeNull();
  });
});
```

**Implementation template — `frontend/src/screens/fixtures/Live.svelte`:**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { dataService } from '../../services/dataService';
  import { predictionTracker } from '../../services/predictionTracker';
  import { matchToFixture, predictionToV3 } from '../../lib/adapters/v3';
  import MatchCard from '../../components/matchcard/MatchCard.svelte';
  import LiveBanner from '../../components/fixtures/LiveBanner.svelte';
  import type { Match } from '../../types';
  import type { Fixture, MatchPrediction } from '../../types/redesign';

  let liveMatches: Match[] = [];
  let loaded = false;

  function pickPredictionForMatch(matchId: string): MatchPrediction | undefined {
    const stored = predictionTracker.getMatchPredictions(matchId)[0];
    return stored ? predictionToV3(stored) : undefined;
  }

  function bannerScore(m: Match): string {
    const h = m.home_goals ?? 0;
    const a = m.away_goals ?? 0;
    return `${h}-${a}`;
  }

  function bannerMinute(m: Match): number {
    return m.minute ?? 0;
  }

  export async function load(): Promise<void> {
    try {
      liveMatches = await dataService.getLiveMatches();
    } catch {
      liveMatches = [];
    }
    loaded = true;
  }

  onMount(load);
  // Polling added in Task 3.
</script>

<div class="flex flex-col gap-4 px-4 py-6" data-screen="fixtures-live">
  {#if loaded && liveMatches.length === 0}
    <div class="text-center text-text-dim py-8" data-live-empty>
      No matches in play right now. Check back during a kickoff window.
    </div>
  {:else}
    {#each liveMatches as match (match.id)}
      {@const fx = matchToFixture(match)}
      <div data-live-row>
        <LiveBanner minute={bannerMinute(match)} score={bannerScore(match)} />
        <MatchCard fixture={fx} prediction={pickPredictionForMatch(match.id)} />
      </div>
    {/each}
  {/if}
</div>
```

**TDD-discipline check:** all 4 tests fail pre-fix. All 4 pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/screens/fixtures/Live.test.ts`. Expect: 4/4 pass.

### Task 3 — Polling + visibility-pause + 3 polling tests *(auto-gated sub-step)*

**Polling note (added 2026-04-26 plan grooming):** use `vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })` rather than the broader default. The `await component.load()` call relies on real Promise microtasks; faking `Date.now` or `queueMicrotask` would break the existing `await component.load(); await act();` pattern that all P2 + P3 screen tests use. Restrict the fake to interval timers only.

**Visibility-pause note:** `document.hidden` is a getter that returns `false` by default in jsdom. To force it to `true` in a test, use `Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })` before dispatching the `visibilitychange` event. Restore in afterEach: `Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })`.

**Tests to append to `Live.test.ts`:**

```ts
describe('Live — polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('refetches getLiveMatches every 30s after initial load', async () => {
    const { dataService } = await import('../../services/dataService');
    const getMock = dataService.getLiveMatches as ReturnType<typeof vi.fn>;
    getMock.mockResolvedValue([]);

    const { component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(getMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT refetch when document.hidden is true', async () => {
    const { dataService } = await import('../../services/dataService');
    const getMock = dataService.getLiveMatches as ReturnType<typeof vi.fn>;
    getMock.mockResolvedValue([]);

    const { component } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    expect(getMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(1); // still 1 — paused
  });

  it('clears the interval on component destroy (no leaks)', async () => {
    const { dataService } = await import('../../services/dataService');
    const getMock = dataService.getLiveMatches as ReturnType<typeof vi.fn>;
    getMock.mockResolvedValue([]);

    const { component, unmount } = render(Live);
    await (component as { load(): Promise<void> }).load();
    await act();
    unmount();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getMock).toHaveBeenCalledTimes(1); // still 1 — interval cleared
  });
});
```

**Implementation patch on `Live.svelte`:**

```svelte
<script lang="ts">
  // … existing script content …
  const POLL_INTERVAL_MS = 30_000;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;

  async function poll(): Promise<void> {
    if (document.hidden) return;
    try {
      liveMatches = await dataService.getLiveMatches();
    } catch {
      // keep current state on transient failure
    }
  }

  function startPolling(): void {
    if (pollIntervalId !== null) return;
    pollIntervalId = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  onMount(() => {
    void load().then(startPolling);
    document.addEventListener('visibilitychange', startPolling);
  });

  onDestroy(() => {
    stopPolling();
    document.removeEventListener('visibilitychange', startPolling);
  });
</script>
```

**TDD-discipline check:** all 3 polling tests fail pre-fix (no interval, no visibility listener). All pass post-fix.

**Validation:** `cd frontend && npm run test -- --run src/screens/fixtures/Live.test.ts`. Expect: 7/7 pass (4 baseline + 3 polling).

### Task 4 — Mount the route on `App.svelte`

```svelte
<!-- in App.svelte's <Router> block, alongside existing <Route path="/today"> -->
<Route path="/fixtures/live" component={Live} />
```

Add the import at the top:

```svelte
import Live from './screens/fixtures/Live.svelte';
```

**No new test** — Playwright routing smoke (`frontend/e2e/routing.spec.ts`) already covers `/fixtures/live` via the redirect map (`/live-matches` → `/fixtures/live`). The existing 32-test suite must stay 32/32 green.

**Validation:**
- `cd frontend && npm run check` — 0/0
- `cd frontend && npm run test -- --run` — 782+ green (was 782/782; expect 782 + 6 LiveBanner + 7 Live = **795/795** across **58 files**)
- `cd frontend && npx playwright test --project=desktop-chrome routing.spec.ts` — 32/32 green

### Task 5 — Commit, surface manual sweep checklist

**Files to commit (verify all are intended before staging):**
- `frontend/src/components/fixtures/LiveBanner.svelte`
- `frontend/src/components/fixtures/LiveBanner.test.ts`
- `frontend/src/screens/fixtures/Live.svelte`
- `frontend/src/screens/fixtures/Live.test.ts`
- `frontend/src/App.svelte`
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note)

**Commit message:**
```
P3a: Fixtures Live — in-play MatchCards with LiveBanner + 30s polling

screens/fixtures/Live.svelte mounts at /fixtures/live, renders 1-3
in-play matches as <LiveBanner> + <MatchCard> stacks. Polls
dataService.getLiveMatches() every 30s; pauses when document.hidden.
Empty state when no live matches.

components/fixtures/LiveBanner.svelte: pulsing red dot, MIN N',
text-metric-lg score, optional xG running totals (rendered only
when both home + away xG present), optional probability-shift row.

vitest 795/795 (+13 across 2 new files: LiveBanner 6, Live 7),
svelte-check 0/0, Playwright routing 32/32 on desktop-chrome.

Manual gate: P3a's [ ] stays unchecked pending sweep at /fixtures/live;
checklist surfaced in IMPLEMENTATION_PLAN.md. Tag at sign-off → v3.4.
```

**Discovery note template (append to `## Notes / discoveries` in IMPLEMENTATION_PLAN.md):**

```md
- **(P3a, awaiting human eyeball)** P3a shipped `screens/fixtures/Live.svelte` (in-play MatchCards via `dataService.getLiveMatches()` + 30s polling that pauses on `document.hidden`) and `components/fixtures/LiveBanner.svelte` (pulsing red dot, MIN N', score, optional xG, optional prob-shift). vitest 795/795 across 58 files (+13 from new files: LiveBanner 6, Live 7), svelte-check 0/0, Playwright routing 32/32 on desktop-chrome. Manual sweep checklist surfaced below. Tag at sign-off → `v3.4`.
- **(P3a deviations from plan)** [Ralph fills this in based on actual deviations.]
```

**Manual sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /fixtures/live — at least one in-play MatchCard if matches are currently live (or empty-state copy if not)
[ ] /fixtures/live — LiveBanner above each card: pulsing red dot, MIN value, score, xG (when present)
[ ] /fixtures/live — leave the tab open for 60s — DevTools Network shows getLiveMatches firing every 30s
[ ] /fixtures/live — switch to a different tab for 30s, switch back — no extra fetches fired while hidden
[ ] /fixtures/live — Toggle theme — every banner + MatchCard flips cleanly
[ ] Resize <1024px — banners stay legible, MatchCards stack vertically
[ ] Empty state: when no live matches, "No matches in play right now" copy renders centered
```

**Sign-off action:** flip P3a's `[ ]` → `[x]` in IMPLEMENTATION_PLAN.md, then `git tag v3.4 <P3a-commit-sha>`.
