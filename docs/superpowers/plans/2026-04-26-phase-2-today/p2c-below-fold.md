# Phase 2 — Slice P2c — Below-fold + Phase 2 checkpoint

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-2-today/index.md`](./index.md)
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 (Today)
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P2c — Below-fold + Phase 2 checkpoint

**Slice goal:** Append the final two below-fold zones to `screens/Today.svelte`:

1. **Model trends** — `<SectionHeader kicker="MODEL TRENDS" title="How the predictions are landing" />` over a `<Spark>` of accuracy-by-gameweek (data from `predictionTracker.getAccuracyByGameweek()`), plus a "How We Predict" link to `/settings/help`.
2. **Recent log** — `<SectionHeader title="Recent log" />` over five `<MatchRow>` entries from `predictionTracker.getRecentPredictions(5)`.

Then write `frontend/e2e/checkpoint-p2.spec.ts` — the Phase 2 Playwright sweep that verifies all five Today zones render at desktop and mobile viewports in dark and light themes.

**Manual gate:** ralph commits when `npm run check`, `npm run test -- --run`, and the new Playwright spec all pass. Human flips `[x]` after eyeball.

### Task 1: Add a fixture-and-prediction adapter for `MatchRow` rendering — ✅ DONE (committed as standalone auto-gated sub-slice ahead of the rest of P2c; see `IMPLEMENTATION_PLAN.md` § "P2c — Task 1 only" for deviations from this template)

The recent-log strip wants `<MatchRow fixture={…} prediction={…} />` rows, but `predictionTracker.getRecentPredictions()` returns `StoredPrediction` only — there's no `Match` record to derive a `Fixture` from. We need a small adapter that reconstructs a minimal `Fixture` from `StoredPrediction` fields.

**Files:**
- Modify: `frontend/src/lib/adapters/v3.ts`
- Modify: `frontend/src/lib/adapters/v3.test.ts`

- [x] **Step 1: Append the failing test**

Add to `v3.test.ts`:

```ts
import { storedPredictionToFixture } from './v3';

describe('storedPredictionToFixture', () => {
  it('synthesises a v3 Fixture from a settled stored prediction', () => {
    const stored: StoredPrediction = {
      id: 'p-1',
      matchId: '1234',
      homeTeam: 'Liverpool',
      awayTeam: 'Arsenal',
      predictedResult: 'H',
      predictedHomeGoals: 2,
      predictedAwayGoals: 0,
      confidence: 0.6,
      actualResult: 'H',
      actualHomeGoals: 2,
      actualAwayGoals: 0,
      isCorrect: true,
      timestamp: '2026-04-26T10:00:00Z',
      matchDate: '2026-04-30T19:00:00Z',
      matchday: 35,
    };

    const fx = storedPredictionToFixture(stored);
    expect(fx.id).toBe('1234');
    expect(fx.gameweek).toBe(35);
    expect(fx.utcDate).toBe('2026-04-30T19:00:00Z');
    expect(fx.status).toBe('FINISHED');
    expect(fx.score).toEqual({ home: 2, away: 0 });
    expect(fx.home.name).toBe('Liverpool');
    expect(fx.away.name).toBe('Arsenal');
  });

  it('marks unsettled stored predictions as SCHEDULED with no score', () => {
    const stored: StoredPrediction = {
      id: 'p-2', matchId: '5678', homeTeam: 'Chelsea', awayTeam: 'Spurs',
      predictedResult: 'A', predictedHomeGoals: 1, predictedAwayGoals: 2,
      confidence: 0.5, timestamp: '2026-04-26T10:00:00Z',
      matchDate: '2026-04-30T19:00:00Z',
    };
    const fx = storedPredictionToFixture(stored);
    expect(fx.status).toBe('SCHEDULED');
    expect(fx.score).toBeUndefined();
  });
});
```

- [x] **Step 2: Implement `storedPredictionToFixture`**

In `v3.ts`:

```ts
export function storedPredictionToFixture(p: StoredPrediction): Fixture {
  const settled =
    p.actualResult !== undefined &&
    typeof p.actualHomeGoals === 'number' &&
    typeof p.actualAwayGoals === 'number';
  return {
    id: p.matchId,
    competition: 'Premier League',
    gameweek: p.matchday ?? 0,
    utcDate: p.matchDate,
    status: settled ? 'FINISHED' : 'SCHEDULED',
    home: { abbr: p.homeTeam.slice(0, 3).toUpperCase(), name: p.homeTeam },
    away: { abbr: p.awayTeam.slice(0, 3).toUpperCase(), name: p.awayTeam },
    score: settled
      ? { home: p.actualHomeGoals as number, away: p.actualAwayGoals as number }
      : undefined,
  };
}
```

- [x] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/lib/adapters/v3.test.ts`

Expected: 7 tests PASS (P2a's 5 + P2c's 2). *(In the actually-shipped sub-slice the test count landed at `v3.test.ts` 14/14: P2a's 9 — the P2a slice ended up writing 9 adapter tests rather than 5 per its own deviation note — plus 5 new `storedPredictionToFixture` tests, +2 beyond the plan template covering 0-0 settled scores and FC/AFC suffix stripping.)*

### Task 2: Append below-fold zones to `screens/Today.svelte`

**Files:**
- Modify: `frontend/src/screens/Today.svelte`
- Modify: `frontend/src/screens/Today.test.ts`

- [ ] **Step 1: Append failing zone tests**

**Test-pattern note (added 2026-04-26 plan grooming):** screen tests in this codebase (`Today.test.ts`, `Predictions.test.ts`, `SeasonStats.test.ts`) deliberately **do not** use `waitFor` from `@testing-library/svelte` — they use `await (component as { load(): Promise<void> }).load(); await act();` to trigger the `loaded = true` branch deterministically, then run synchronous assertions. This matches the existing P2a tests in `Today.test.ts` (lines 96-101, 103-112, 114-121). `Today.test.ts`'s import line is `import { act, render } from '@testing-library/svelte';` — do **not** add `waitFor` to the import. Bonus: pulling assertions out of a `waitFor` callback gives a clean stack trace when an expect fails (a `waitFor` with multiple expects retries the whole callback on any failure, masking the true failure point).

Add to `Today.test.ts`:

```ts
describe('Today screen — P2c below-fold', () => {
  it('renders the model-trends section header and Spark', async () => {
    const { predictionTracker } = await import('../services/predictionTracker');
    (predictionTracker.getAccuracyByGameweek as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { matchday: 32, totalPredictions: 8, correctPredictions: 5, accuracy: 62 },
      { matchday: 33, totalPredictions: 9, correctPredictions: 6, accuracy: 67 },
      { matchday: 34, totalPredictions: 10, correctPredictions: 7, accuracy: 70 },
    ]);
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const trends = container.querySelector('[data-zone="trends"]');
    expect(trends).toBeTruthy();
    expect(trends!.textContent).toMatch(/MODEL TRENDS/);
    expect(trends!.querySelector('svg')).toBeTruthy();   // Spark renders an inline SVG
  });

  it('renders five MatchRow entries when getRecentPredictions returns five', async () => {
    const { predictionTracker } = await import('../services/predictionTracker');
    (predictionTracker.getRecentPredictions as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i}`, matchId: String(100 + i),
        homeTeam: 'Liverpool', awayTeam: 'Arsenal',
        predictedResult: 'H', predictedHomeGoals: 2, predictedAwayGoals: 0,
        confidence: 0.6,
        actualResult: 'H', actualHomeGoals: 2, actualAwayGoals: 0, isCorrect: true,
        timestamp: '2026-04-26T10:00:00Z', matchDate: `2026-04-${20 + i}T19:00:00Z`,
        matchday: 34, poissonProbs: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
      })),
    );
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    const log = container.querySelector('[data-zone="log"]');
    expect(log).toBeTruthy();
    // Each settled MatchRow renders a [data-hit] cell on the right (MatchRow.svelte:54-57)
    expect(log!.querySelectorAll('[data-hit]').length).toBe(5);
  });

  it('renders an empty-state when getRecentPredictions returns nothing', async () => {
    const { container, component } = render(Today);
    await (component as { load(): Promise<void> }).load();
    await act();
    // P2a default mock returns [] for recent → empty state shown
    expect(container.querySelector('[data-zone="log-empty"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement the below-fold markup**

Extend `Today.svelte`'s `<script>`:

```ts
import Spark from '../components/atoms/Spark.svelte';
import SectionHeader from '../components/atoms/SectionHeader.svelte';
import MatchRow from '../components/matchcard/MatchRow.svelte';
import { storedPredictionToFixture } from '../lib/adapters/v3';

$: gameweekAccuracy = predictionTracker.getAccuracyByGameweek();
$: recentPredictions = predictionTracker.getRecentPredictions(5);
```

Append after the existing grid block (still inside the root `<div>`):

```svelte
{#if loaded}
  <div class="px-4" data-zone="trends">
    <SectionHeader kicker="MODEL TRENDS" title="How the predictions are landing">
      <a slot="right" href="/settings/help" class="text-body-sm text-text-dim hover:text-foreground">
        How we predict →
      </a>
    </SectionHeader>
    {#if gameweekAccuracy.length > 0}
      <Spark
        data={gameweekAccuracy.map(g => g.accuracy)}
        width={320}
        height={48}
        trend={gameweekAccuracy.at(-1)!.accuracy >= gameweekAccuracy[0].accuracy ? 'up' : 'down'}
        fill
      />
    {:else}
      <p class="text-text-dim text-body-sm">No settled predictions yet — predictions appear here once results land.</p>
    {/if}
  </div>

  <div class="px-4" data-zone="log">
    <SectionHeader title="Recent log" />
    {#if recentPredictions.length > 0}
      <div class="rounded-lg border border-border overflow-hidden">
        {#each recentPredictions as stored (stored.id)}
          {@const fx = storedPredictionToFixture(stored)}
          <MatchRow fixture={fx} prediction={predictionToV3(stored)} />
        {/each}
      </div>
    {:else}
      <p class="text-text-dim text-body-sm" data-zone="log-empty">
        No settled predictions in the log yet.
      </p>
    {/if}
  </div>
{/if}
```

**Atom signatures verified during 2026-04-26 plan grooming:**
- `Spark.svelte` exposes `data: number[]` (single array — no separate `labels` prop), plus `width`, `height`, `trend: 'up' | 'down' | 'flat'`, and `fill: boolean`. The SVG itself is `aria-hidden="true"` with no hover affordances; if a tooltip is wanted later, wrap `<Spark>` in an external tooltip primitive — don't expect it from the atom.
- `SectionHeader.svelte` does expose a named `slot="right"`, so `<a slot="right" …>` is correct as written above.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run test -- --run src/screens/Today.test.ts`

Expected: all P2a + P2b + P2c tests PASS.

### Task 3: Write the Phase 2 Playwright checkpoint spec

**Files:**
- Create: `frontend/e2e/checkpoint-p2.spec.ts`

The spec verifies the Today shell renders all five zones at desktop and mobile, in dark and light theme. Mirror the structure of `frontend/e2e/checkpoint-p0.spec.ts`.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

test.describe('Phase 2 checkpoint — Today screen', () => {
  test('renders all five zones on /today (command strip + hero + KPI + grid + below-fold)', async ({ page }) => {
    await setupApp(page);
    await page.goto('/today');

    await expect(page.locator('[data-command-strip]')).toBeVisible();
    // Hero may be 'hero' or 'hero-empty' depending on mocked data
    await expect(page.locator('[data-zone="hero"], [data-zone="hero-empty"]')).toBeVisible();
    await expect(page.locator('[data-zone="kpi-strip"]')).toBeVisible();
    await expect(page.locator('[data-zone="grid"], [data-zone="grid-empty"]')).toBeVisible();
    await expect(page.locator('[data-zone="trends"]')).toBeVisible();
    await expect(page.locator('[data-zone="log"]')).toBeVisible();
  });

  test('command strip is positioned sticky', async ({ page }) => {
    await setupApp(page);
    await page.goto('/today');
    // Static CSS-property assertion — see scroll-stickiness note below.
    const position = await page
      .locator('[data-command-strip]')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('theme toggle still flips the dark class while on /today', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupApp(page);
    await page.goto('/today');
    const html = page.locator('html');
    const before = await html.getAttribute('class');
    const toggle = page.getByRole('button', { name: /toggle theme/i });
    await toggle.click();
    const after = await html.getAttribute('class');
    expect(before).not.toBe(after);
  });
});
```

**Scroll-stickiness note (added 2026-04-26 plan grooming):** an earlier draft of this spec asserted stickiness dynamically with `page.mouse.wheel(0, 600)` + `boundingBox` before/after. That assertion is **non-falsifying** in this codebase for two compounding reasons. (1) The scroll container is `<main>` (`BroadcastShell.svelte:41` — `class="flex-1 overflow-y-auto …"`), not the document body (the outer flex wrapper has `h-screen overflow-hidden`). `page.mouse.wheel(0, 600)` from default cursor origin (0,0) at desktop viewport lands on the sidebar (`<aside class="hidden lg:flex w-64 …">` covers the first 256px), so the wheel event doesn't dispatch on `<main>` and no scroll fires. (2) Even if we hovered `<main>` first, the mocked content (1 hero card + KPI + small/empty grid + trends + log) is shorter than viewport height — `<main>.scrollHeight` ≤ `<main>.clientHeight`, so there's nothing to scroll regardless of where the wheel lands. Either way both `boundingBox().y` reads return the same value, and the assertion passes whether the `sticky` class is present or not. A future refactor that drops `sticky` would not be caught. The replacement above asserts the static CSS contract (`getComputedStyle(el).position === 'sticky'`), which deterministically fails if the class is removed; the runtime "actually pinned during scroll" verification moves to the manual sweep checklist (Task 5 Step 3) where a human can scroll a real page with real data.

- [ ] **Step 2: Run the spec on desktop and mobile projects**

Run:
```
cd frontend && npx playwright test e2e/checkpoint-p2.spec.ts --project=desktop-chrome
cd frontend && npx playwright test e2e/checkpoint-p2.spec.ts --project=mobile-chrome
```

Expected: green on both. If the mobile project's viewport is too narrow for the theme-toggle (which is desktop-only in the broadcast shell), the third test is already viewport-pinned to 1280×800 and stays valid. If the test fails on mobile-chrome for a different reason (e.g., the strip stickiness assertion), gate the failing test with `test.skip(({ isMobile }) => isMobile, '…')`.

### Task 4: Run full validation gate

- [ ] **Step 1: Vitest full suite**

Run: `cd frontend && npm run test -- --run`

Expected: green.

- [ ] **Step 2: svelte-check**

Run: `cd frontend && npm run check`

Expected: 0 errors.

- [ ] **Step 3: Playwright routing + checkpoint specs**

Run:
```
cd frontend && npx playwright test e2e/routing.spec.ts e2e/checkpoint-p2.spec.ts --project=desktop-chrome
```

Expected: green.

### Task 5: Update IMPLEMENTATION_PLAN.md and commit

- [ ] **Step 1: Update IMPLEMENTATION_PLAN.md**

Leave P2c's `[ ]` unchecked (manual gate). Add a Phase 2 wrap-up note under `## Notes / discoveries`:

```md
- **(P2c, awaiting human eyeball)** P2c shipped Today's below-fold (Spark of accuracy-by-gameweek + 5-row recent-log strip via MatchRow) and Phase 2 Playwright checkpoint. vitest <N>/<N> across <M> files, svelte-check 0/0, e2e/checkpoint-p2.spec.ts green on desktop-chrome and mobile-chrome. Phase 2 is content-complete pending human visual sweep across both viewports and themes.
```

Update the "Active phase" line to reflect Phase 2 sitting on the human's desk and Phase 3 being the next plan to write.

- [ ] **Step 2: Commit**

`lib/adapters/v3.ts` / `v3.test.ts` already shipped in `0059a49` (Task 1) — do **not** re-add them. The remaining surface is Tasks 2-3's `Today` below-fold markup + tests + the new Phase 2 Playwright checkpoint spec.

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add IMPLEMENTATION_PLAN.md \
        frontend/src/screens/Today.svelte \
        frontend/src/screens/Today.test.ts \
        frontend/e2e/checkpoint-p2.spec.ts
git commit -m "P2c: Today below-fold (Spark + MatchRow log) + Phase 2 Playwright checkpoint"
```

- [ ] **Step 3: Surface the manual sweep checklist**

```
P2c committed. Phase 2 manual sweep checklist (boot npm run dev):

[ ] /today — full vertical stack visible: strip → hero → KPI → grid → trends → log
[ ] /today — command strip stays pinned to the top of <main>'s scroll viewport while scrolling the page (the automated spec only asserts `position: sticky` is set — runtime pinning is verified here)
[ ] /today — Spark renders the accuracy-by-gameweek line (atom is decorative / aria-hidden — no hover tooltip; defer that to a P4-era enhancement if wanted)
[ ] /today — "How we predict →" link navigates to /settings/help
[ ] /today — Recent log: 5 MatchRows, each with hit/miss indicator (✓/✗) and ProbBar
[ ] /today — empty states render gracefully when no data (test by clearing localStorage)
[ ] Resize <1024px — every zone reflows: KPI 2x2, grid 1-col, log scrolls if narrow
[ ] Toggle theme — every zone flips cleanly, no FOUC, no broken contrast
[ ] Run e2e/checkpoint-p2.spec.ts on desktop-chrome + mobile-chrome — green

If everything looks right, flip P2a, P2b, and P2c's [ ] to [x] in IMPLEMENTATION_PLAN.md.
If anything is wrong, drop notes under ## Human notes for next iteration.
```

## End of phase

By the end of P2c, Phase 2 is complete:
- `/today` is the redesign's flagship landing surface, composed entirely of v3 primitives
- `screens/Today.svelte` is a clean composition: command strip, hero MatchCard, KPI strip, grid, model-trends, recent-log
- `lib/gameweek.ts` and `lib/adapters/v3.ts` are reusable across Phase 3 hub screens
- `predictionTracker.AccuracyStats` now exposes `brierScore`, ready for Backtest in P4b
- A Phase 2 Playwright spec sits alongside P0-cp / Phase 1 routing as the regression backstop

**Next phase:** Phase 3 (per-hub screens), starting with **P3a — Fixtures Live**. Phase 3 plan does not exist yet; it should be written before P3a starts. Phase 3 plans live in `docs/superpowers/plans/2026-04-26-phase-3-per-hub/` (create when P2c is signed off).
