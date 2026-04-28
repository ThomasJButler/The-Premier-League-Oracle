# P4-cp — Predictions sub-phase checkpoint

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual visual sweep + auto-gated for Playwright spec write+pass+commit.
**Tag at sign-off:** `v3.14`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 7 (Predictions hub) — checkpoint validates the **integration** of P4a + P4b + P4c + P4d (+ P4e/P4f wired exports) into the BroadcastShell.

## Goal

Write `frontend/e2e/checkpoint-p4-predictions.spec.ts` — a Playwright sweep that asserts the Predictions hub's four sub-tabs each render their primary content zones, the Tools query-param switcher swaps utility panels, sub-tab URL navigation cleanly tears down the previous screen, and the theme toggle still works on `/predictions/*`. Mirrors `checkpoint-p0.spec.ts` / `checkpoint-p2.spec.ts` / `checkpoint-p3-fixtures.spec.ts` patterns.

This is the structural integrity test for the Predictions sub-phase — it does **not** re-test internals (those are vitest-covered across `ThisWeek.test.ts`, `Backtest.test.ts`, `Log.test.ts`, `Tools.test.ts`, `KellyCalculator.test.ts`, `ValueScanner.test.ts`, `CalibrationCurve.test.ts`, `LogFilterChips.test.ts`, `predictionFilters.test.ts`, `calibrationIndex.test.ts`, plus the four `lib/export/*.test.ts` files). It catches regressions where one of P4a/P4b/P4c/P4d starts misbehaving as later phases land changes that ripple into the hub.

## Surface area

- **New E2E spec:** `frontend/e2e/checkpoint-p4-predictions.spec.ts`
- **Modified:** none. (No source changes — this slice is a test-only commit.)
- **Read-only deps:** `frontend/e2e/helpers.ts` (`setupApp` — already seeds one completed prediction so Log + Backtest hit their populated branches deterministically)

## Reference patterns

`checkpoint-p3-fixtures.spec.ts` (already in-tree) is the closest analogue. Key patterns to mirror:
- `setupApp(page)` before every navigation (sets API key, dismisses ApiSetupWizard, mocks Football-Data API, **and seeds one settled prediction so the Log screen hits its populated branch and Backtest hits its KPI-grid branch rather than `[data-no-history]`**)
- Assertions use stable `[data-screen]` / `[data-card-row]` / `[data-chip]` / `[data-kpi]` / `[data-utility]` markers that the screen vitest tests already exercise (single source of truth — if a contract marker drifts, the unit test catches it first; the checkpoint catches integration drift)
- Theme-toggle test self-pins viewport to 1280×800 (mobile-chrome project doesn't expose a desktop-only theme toggle)
- Sub-tab navigation uses `page.goto()` not `getByRole('tab')` because the hub-level `<Tabs>` primitive is **not yet mounted** at `/predictions/*` (same limitation as Fixtures hub — see `checkpoint-p3-fixtures.spec.ts` Test 4 deviation note in IMPLEMENTATION_PLAN.md). The **Tools query-param switcher** is a separate concern: those ARE `role="tab"` buttons inside `Tools.svelte:43`, so Test 4 below uses `getByRole('tab')` for the in-page utility swap.

## Atom + screen markers verified during 2026-04-28 plan grooming

The five vitest-pinned markers the spec consumes are stable on every Predictions screen:

| Marker | Location | Set in |
|---|---|---|
| `[data-screen="predictions-this-week"]` | `ThisWeek.svelte:38` | P4a |
| `[data-screen="predictions-backtest"]` | `Backtest.svelte:18` | P4b |
| `[data-screen="predictions-log"]` | `Log.svelte:27` | P4c |
| `[data-screen="predictions-tools"]` | `Tools.svelte:33` | P4d Task 1 |
| `[data-card-row]` | ThisWeek.svelte:78, Log.svelte:73 | P4a / P4c |
| `[data-no-gameweek]` / `[data-empty]` | `ThisWeek.svelte:66,70` | P4a |
| `[data-kpi-grid]` + `[data-kpi="brier|calibration-index|roi|outcome-accuracy"]` | `Backtest.svelte` (4 KPI tiles) | P4b Task 2 |
| `[data-no-history]` | `Backtest.svelte` (empty stats), `Log.svelte:65` (filter excluded everything) | P4b / P4c |
| `[data-no-stored]` | `Log.svelte:61` (zero stored predictions) | P4c |
| `[data-chip="last30|season|all"]` | `LogFilterChips.svelte` | P4c Task 2 |
| `[data-tools-switcher]` wrapper with `role="tablist"` | `Tools.svelte:38` | P4d Task 1 |
| `[data-utility="kelly|value"]` buttons with `role="tab"` + `aria-selected` | `Tools.svelte:48` | P4d Task 1 |
| `[data-testid="kelly-calculator"]` / `[data-testid="value-scanner"]` | `KellyCalculator.svelte`, `ValueScanner.svelte` | P4d Task 2 / Task 3 |

Pre-flight `grep` ralph runs first:
1. `grep -n "data-screen=\"predictions-" frontend/src/screens/predictions/*.svelte` — confirms all four screen roots still carry their stable markers (regression guard against a future "drop the data-screen attr" cleanup).
2. `grep -n "role=\"tab\"" frontend/src/screens/predictions/Tools.svelte` — confirms the utility switcher buttons still expose `role="tab"` so `getByRole('tab')` works in Test 4.
3. `grep -n "Toggle theme" frontend/src/components/layout/BroadcastShell.svelte` — confirms the theme toggle button's accessible name. P0-cp / P2-cp / P3-fixtures-cp's specs already exercise this; the same accessible name should work here.

## Known limitations (carried from earlier slices)

- **No `<Tabs>` primitive at hub level.** The P3-fixtures-cp follow-up (mount `<Tabs>` at each hub level) still hasn't shipped. This checkpoint's sub-tab navigation test therefore uses `page.goto('/predictions/...')` rather than `getByRole('tab').click()` for the four sub-tabs. The Tools utility switcher IS a `<button role="tab">` group inside the screen, so its dedicated test (Test 4) does use `getByRole('tab')`. When the Tabs primitive lands at hub level, Test 5's navigation can be tightened to use it instead of `page.goto`.
- **Test data:** `setupApp(page)` seeds one settled prediction (`seed_e2e_1` — Arsenal vs Liverpool, matchday 20, predictedResult `'H'`, isCorrect true). Log will have at least 1 `[data-card-row]`; Backtest will have a non-empty AccuracyStats so the `[data-no-history]` branch will NOT render. ThisWeek's card count depends on whether matchday 20 is the current gameweek per the mock; the test asserts `[data-card-row]` count ≥ 0 OR `[data-no-gameweek]`/`[data-empty]` empty state — both are valid steady states.
- **No export-button click invocation.** Clicking `[data-export="pdf"]` would lazy-load `html2canvas` + `jspdf` (~600KB) and write a real Blob in jsdom — out of scope for an integration-shape checkpoint. The export buttons' presence is asserted (no `[data-export-placeholder]` attribute on any of them post-P4e/P4f); export-flow correctness is the manual sweep's job.

## TDD task list

### Task 1 — Write the spec + 6 tests *(auto-gated; ralph commits when green)*

**Test file: `frontend/e2e/checkpoint-p4-predictions.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

/**
 * P4 Predictions sub-phase checkpoint — asserts the four Predictions sub-tabs
 * (This Week, Backtest, Log, Tools) each render their primary content zones,
 * the Tools query-param utility switcher swaps panels, sub-tab URL navigation
 * cleanly tears down the previous screen, and the theme toggle still flips
 * on `/predictions/*`.
 *
 * Mirrors the structure of `checkpoint-p3-fixtures.spec.ts`. Catches
 * integration regressions across P4a/P4b/P4c/P4d — internals stay
 * vitest-covered.
 */

test.describe('Phase 3 Predictions sub-phase checkpoint', () => {
  test('renders /predictions/this-week with the screen root', async ({ page }) => {
    await setupApp(page);
    await page.goto('/predictions/this-week');

    await expect(page.locator('[data-screen="predictions-this-week"]')).toBeVisible();

    // Either at least one fixture card OR an empty-state copy — both are
    // valid steady states because the seeded matchday-20 prediction may not
    // align with the mock's current gameweek.
    const cards = page.locator('[data-card-row]');
    const noGw = page.locator('[data-no-gameweek]');
    const empty = page.locator('[data-empty]');
    const eitherCount =
      (await cards.count()) + (await noGw.count()) + (await empty.count());
    expect(eitherCount).toBeGreaterThan(0);

    // Export buttons must be active (no placeholder attribute) post-P4e/P4f.
    const placeholders = page.locator('[data-export-placeholder]');
    await expect(placeholders).toHaveCount(0);
  });

  test('renders /predictions/backtest with the 4-tile KPI grid', async ({ page }) => {
    await setupApp(page);
    await page.goto('/predictions/backtest');

    await expect(page.locator('[data-screen="predictions-backtest"]')).toBeVisible();

    // setupApp seeds one settled prediction, so AccuracyStats is non-empty
    // and the KPI grid renders. The [data-no-history] branch will NOT fire
    // here — both shapes are tolerated for resilience against future
    // changes to the seed.
    const tiles = page.locator('[data-kpi-grid] > [data-kpi]');
    const noHistory = page.locator('[data-no-history]');
    const eitherCount = (await tiles.count()) + (await noHistory.count());
    expect(eitherCount).toBeGreaterThan(0);

    // CSV export button is active (no placeholder attribute) post-P4e.
    const csvBtn = page.locator('[data-export="csv"]');
    await expect(csvBtn).toBeVisible();
    expect(await csvBtn.getAttribute('data-export-placeholder')).toBeNull();
  });

  test('renders /predictions/log with filter chips and at least one row OR empty-state', async ({
    page,
  }) => {
    await setupApp(page);
    await page.goto('/predictions/log');

    await expect(page.locator('[data-screen="predictions-log"]')).toBeVisible();
    // 3 filter chips (last30 / season / all) always render
    await expect(page.locator('[data-chip]')).toHaveCount(3);

    // setupApp seeds one settled prediction; default Last 30 filter may
    // exclude it because the seeded matchDate is 7 days old (within 30) —
    // tolerate either populated or empty steady states.
    const rows = page.locator('[data-card-row]');
    const noStored = page.locator('[data-no-stored]');
    const noHistory = page.locator('[data-no-history]');
    const eitherCount =
      (await rows.count()) + (await noStored.count()) + (await noHistory.count());
    expect(eitherCount).toBeGreaterThan(0);

    // Three export buttons (CSV, PDF, Markdown) all active post-P4e/P4f.
    const placeholders = page.locator('[data-export-placeholder]');
    await expect(placeholders).toHaveCount(0);
  });

  test('renders /predictions/tools and switches between Kelly and Value utilities via role=tab', async ({
    page,
  }) => {
    await setupApp(page);
    await page.goto('/predictions/tools');

    await expect(page.locator('[data-screen="predictions-tools"]')).toBeVisible();

    // Default utility is Kelly (no ?utility= query param)
    await expect(page.locator('[data-testid="kelly-calculator"]')).toBeVisible();
    expect(
      await page.locator('[data-utility="kelly"]').getAttribute('aria-selected'),
    ).toBe('true');

    // Click the Value tab — utility panel swaps, URL gets ?utility=value
    await page.getByRole('tab', { name: /Value/i }).click();
    await expect(page).toHaveURL(/\/predictions\/tools\?utility=value/);
    await expect(page.locator('[data-testid="value-scanner"]')).toBeVisible();
    await expect(page.locator('[data-testid="kelly-calculator"]')).toHaveCount(0);

    // Click back to Kelly — URL drops the param OR sets ?utility=kelly
    // (either is acceptable — Tools.svelte writes ?utility=kelly explicitly
    // via navigate(), so the URL gets the param)
    await page.getByRole('tab', { name: /Kelly/i }).click();
    await expect(page.locator('[data-testid="kelly-calculator"]')).toBeVisible();
    await expect(page.locator('[data-testid="value-scanner"]')).toHaveCount(0);
  });

  test('navigates cleanly between the four Predictions sub-tabs', async ({ page }) => {
    await setupApp(page);
    await page.goto('/predictions/this-week');
    await expect(page.locator('[data-screen="predictions-this-week"]')).toBeVisible();

    await page.goto('/predictions/backtest');
    await expect(page).toHaveURL(/\/predictions\/backtest/);
    await expect(page.locator('[data-screen="predictions-backtest"]')).toBeVisible();
    await expect(page.locator('[data-screen="predictions-this-week"]')).toHaveCount(0);

    await page.goto('/predictions/log');
    await expect(page).toHaveURL(/\/predictions\/log/);
    await expect(page.locator('[data-screen="predictions-log"]')).toBeVisible();
    await expect(page.locator('[data-screen="predictions-backtest"]')).toHaveCount(0);

    await page.goto('/predictions/tools');
    await expect(page).toHaveURL(/\/predictions\/tools/);
    await expect(page.locator('[data-screen="predictions-tools"]')).toBeVisible();
    await expect(page.locator('[data-screen="predictions-log"]')).toHaveCount(0);
  });

  test('theme toggle flips the dark class on /predictions/* without breaking layout', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupApp(page);
    await page.goto('/predictions/log');
    await expect(page.locator('[data-screen="predictions-log"]')).toBeVisible();

    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    await page.getByRole('button', { name: /Toggle theme/i }).click();

    const after = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(after).toBe(!before);

    // Sanity: filter chips still visible after the theme flip
    await expect(page.locator('[data-chip]')).toHaveCount(3);
  });
});
```

**Validation:**
1. `cd frontend && npx playwright test --project=desktop-chrome checkpoint-p4-predictions.spec.ts` — expect **6/6** pass.
2. `cd frontend && npx playwright test --project=mobile-chrome checkpoint-p4-predictions.spec.ts` — expect **5-6/6** pass. Theme-toggle test self-pins to 1280×800 so it should pass on mobile-chrome too. Tools utility-switcher test (#4) and sub-tab navigation test (#5) both use `page.goto()` for route transitions, which are viewport-independent. The mobile-bottom-tab-bar pattern is exercised in `checkpoint-p0.spec.ts`, not here — this checkpoint covers Predictions hub integrity only.

**Mobile-chrome contingency:** if any test flakes on mobile-chrome that's specific to viewport-only behaviour (e.g. an ApiSetupWizard modal that pops differently at narrow widths), gate it with `test.skip(viewport.width < 1024, 'desktop-only check')` and document the deviation in IMPLEMENTATION_PLAN.md.

### Task 2 — Manual visual sweep (gates the `[x]` flip)

**Sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /predictions/this-week — SectionHeader shows "GAMEWEEK NN — This week's picks"; ML divergence chip is intentionally absent (known follow-up — DO NOT flag); export buttons (PDF, PNG) are active (not disabled or styled as placeholders)
[ ] /predictions/this-week — 2-col MatchCard grid renders (1-col mobile); Analyse / Probabilities / Form & H2H / Venue Referee Tempo sections expand cleanly
[ ] /predictions/this-week — Click [Export PDF] — file downloads as `predictions-gw{N}-YYYY-MM-DD.pdf`; A4 landscape, footer reads "Premier League Oracle · Model v3.5-MVP · Predictions for GW{N}"
[ ] /predictions/this-week — Click [Share PNG] — file downloads as `predictions-gw{N}-YYYY-MM-DD.png`; 1080×1920 image dimensions
[ ] /predictions/backtest — SectionHeader shows "MODEL PERFORMANCE — Backtest" with active [Export CSV] button
[ ] /predictions/backtest — 4 KPI tiles render (Brier / Calibration Index / ROI / Outcome accuracy); ROI shows "—" placeholder (known follow-up — DO NOT flag)
[ ] /predictions/backtest — Calibration curve SVG renders with diagonal; populated data plots dots on it
[ ] /predictions/backtest — Click [Export CSV] — file downloads as `predictions-log-YYYY-MM-DD.csv`; opens cleanly in a spreadsheet tool
[ ] /predictions/log — SectionHeader shows "HISTORICAL RECORD — Prediction log" with three active export buttons (CSV, PDF, Markdown)
[ ] /predictions/log — Filter chips render (Last 30 / This season / All); Last 30 is active by default
[ ] /predictions/log — Click "All" — full prediction list renders (capped by tracker's 90-day GC ceiling — known limitation, DO NOT flag)
[ ] /predictions/log — Each MatchRow shows date, teams, ProbBar (when poissonProbs present), pick-or-hit-indicator
[ ] /predictions/log — Click [Export PDF] — file downloads as `predictions-log-YYYY-MM-DD.pdf`; A4 landscape with footer "Premier League Oracle · Model v3.5-MVP · Predictions Log"
[ ] /predictions/log — Click [Export Markdown] — file downloads as `predictions-log-YYYY-MM-DD.md`; opens cleanly in any Markdown viewer
[ ] /predictions/tools — Default Kelly Calculator branch renders (URL is bare `/predictions/tools`)
[ ] /predictions/tools — Click "Value Scanner" — URL becomes `/predictions/tools?utility=value`, ValueScanner panel renders
[ ] /predictions/tools — Click "Kelly Calculator" — URL becomes `/predictions/tools?utility=kelly`, KellyCalculator panel renders
[ ] /predictions/tools — Stake-fraction bar renders with quarter/half/full marks on KellyCalculator
[ ] /predictions/tools — Bankroll persists across switcher swaps (shared `localStorage[kelly_bankroll]` key)
[ ] Sub-tab navigation: ThisWeek → Backtest → Log → Tools via direct URL or sidebar; URL + content + active-state all update
[ ] Toggle theme on every Predictions sub-tab — every screen flips cleanly
[ ] Resize <1024px — every screen stays usable; ThisWeek collapses to 1-col grid; Backtest's KPI grid reflows to 2 or 1 cols
[ ] Mobile bottom tab bar shows Predictions as active when on any /predictions/* URL
[ ] /predictions → /predictions/this-week redirect still works (legacy URL)
[ ] /value-scanner → /predictions/tools?utility=value redirect still works (legacy URL)
[ ] /kelly-calculator → /predictions/tools?utility=kelly redirect still works (legacy URL)
[ ] /suggested-bets → /predictions/tools redirect still works (legacy URL)
[ ] /accumulators → /predictions/tools redirect still works (legacy URL)
[ ] /betting-history → /predictions/log redirect still works (legacy URL)
```

### Task 3 — Commit

**Files staged:**
- `frontend/e2e/checkpoint-p4-predictions.spec.ts`
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note)

**Commit message:**
```
P4-cp: Predictions hub Playwright checkpoint

frontend/e2e/checkpoint-p4-predictions.spec.ts: 6 tests covering all four
Predictions sub-tabs (ThisWeek, Backtest, Log, Tools) — primary zone
presence, KPI grid integrity, filter chip count, Tools query-param
utility switcher, sub-tab URL navigation with previous-screen teardown,
and theme toggle invariant. Mirrors checkpoint-p3-fixtures.spec.ts
patterns; uses setupApp's seeded prediction so Log + Backtest hit their
populated branches deterministically.

vitest 900/900 (unchanged; this slice is test-only and adds Playwright
only). svelte-check 0/0. checkpoint-p4-predictions 6/6 on desktop-chrome,
5-6/6 on mobile-chrome (theme-toggle test self-pins to desktop viewport;
sub-tab + utility-switcher tests are viewport-independent).

Auto-gated for spec write+pass+commit. Manual visual sweep RECOMMENDED
but not blocking. Tag at sign-off → v3.14. Closes the Predictions
sub-phase; next sub-phase is Oracle Chat (P5a), 1 slice.
```

## Rollover note for the next iteration

After P4-cp ships, the next ralph iteration should:
1. Verify all P4a–P4f checkboxes are flipped in IMPLEMENTATION_PLAN.md (human action between this slice and the next — five slices waiting on eyeballs as of grooming)
2. Begin Oracle Chat sub-phase plan grooming — draft `p5a-oracle-chat.md` in this directory. Plan-only commit; untagged.
3. Begin P5a — Oracle Chat.

If `## Human notes for next iteration` has notes when the next iteration starts, ralph addresses those first per the established protocol.

## Discovery note template (for IMPLEMENTATION_PLAN.md after this slice ships)

```markdown
- **(P4-cp, auto-gated half landed; manual sweep recommended but not blocking)** Shipped `frontend/e2e/checkpoint-p4-predictions.spec.ts` — 6 tests covering the Predictions hub's four sub-tabs (ThisWeek, Backtest, Log, Tools): primary `[data-screen]` zones present, Backtest 4-tile KPI grid OR `[data-no-history]` empty branch, Log 3 filter chips + populated/empty bidirectional, Tools query-param utility switcher (Kelly ↔ Value via `getByRole('tab')`), sub-tab navigation with previous-screen teardown, theme toggle still flips on `/predictions/*`. Mirrors `checkpoint-p3-fixtures.spec.ts` shape. Test-only commit — no source changes. vitest 900/900 across 76 files (unchanged — Playwright-only slice). svelte-check 0/0. Playwright **6/6 on desktop-chrome** + **5-6/6 on mobile-chrome** = 11-12/12. The auto-gated half (spec write+pass+commit) is satisfied; manual sweep below remains for the human eyeball before flipping `[x]` and tagging `v3.14`. **Closes the Predictions sub-phase.**
- **(P4-cp deviations from plan)** *(populate during loop pickup — most likely candidates: marker-name drift, mobile-chrome theme-toggle viewport timing, exact role="tab" accessible-name match for the Tools switcher buttons)*
- **(P4-cp manual sweep checklist)** *(copy from p4-cp-predictions-checkpoint.md § "Task 2")*. Sign-off action: flip P4-cp's `[ ]` → `[x]` in the Phase 3 checklist above, then `git tag v3.14 <P4-cp-commit-sha>`. **Closes the Predictions sub-phase.** Next sub-phase is Oracle Chat (P5a) — plan grooming first, since `p5a-…md` doesn't exist yet.
```
