# P3-fixtures-cp — Fixtures sub-phase checkpoint

**Status:** plan-ready, awaiting loop pickup.
**Gate:** Manual visual sweep + auto-gated for Playwright spec write+pass+commit.
**Tag at sign-off:** `v3.7`.
**Spec reference:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md` § 6 (Fixtures hub) — checkpoint validates the **integration** of P3a + P3b + P3c into the BroadcastShell + Tabs.

## Goal

Write `frontend/e2e/checkpoint-p3-fixtures.spec.ts` — a Playwright sweep that asserts the Fixtures hub's three sub-tabs each render their primary content zones, the Tabs component switches active state on URL change, and the theme toggle still works on `/fixtures/*`. Mirrors the structure of `frontend/e2e/checkpoint-p0.spec.ts` and `frontend/e2e/checkpoint-p2.spec.ts`.

This is the structural integrity test for the Fixtures sub-phase — it does **not** re-test internals (those are vitest-covered). It catches regressions where one of P3a/P3b/P3c starts misbehaving as later phases land changes that ripple into the hub.

## Surface area

- **New E2E spec:** `frontend/e2e/checkpoint-p3-fixtures.spec.ts`
- **Modified:** none. (No source changes — this slice is a test-only commit.)
- **Read-only deps:** `frontend/e2e/helpers.ts` (`setupApp`, `mockFootballApi`)

## Reference patterns

`checkpoint-p2.spec.ts` (already in-tree) is the closest analogue. Key patterns to mirror:
- `setupApp(page)` before every navigation (sets API key, dismisses ApiSetupWizard, mocks Football-Data API)
- Assertions use stable `[data-screen]` / `[data-zone]` / `[data-chip]` markers that the screen tests already exercise
- Theme-toggle test self-pins viewport to 1280×800 (mobile project doesn't expose a desktop-only theme toggle)

## TDD task list

### Task 1 — Write the spec + 5 tests *(auto-gated; ralph commits when green)*

**Test file: `frontend/e2e/checkpoint-p3-fixtures.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { setupApp, mockFootballApi } from './helpers';

test.beforeEach(async ({ page }) => {
  await setupApp(page);
  await mockFootballApi(page);
});

test('renders /fixtures/live with the live screen root', async ({ page }) => {
  await page.goto('/fixtures/live');
  await expect(page.locator('[data-screen="fixtures-live"]')).toBeVisible();
  // Either at least one live row OR the empty-state copy — both are valid steady states
  const liveRows = page.locator('[data-live-row]');
  const liveEmpty = page.locator('[data-live-empty]');
  const eitherCount = (await liveRows.count()) + (await liveEmpty.count());
  expect(eitherCount).toBeGreaterThan(0);
});

test('renders /fixtures/matches with FilterChips and at least one fixture group', async ({ page }) => {
  await page.goto('/fixtures/matches');
  await expect(page.locator('[data-screen="fixtures-matches"]')).toBeVisible();
  // 4 chips always render
  await expect(page.locator('[data-chip]')).toHaveCount(4);
  // Default filter "all" should produce at least one group OR the empty-state
  const groups = page.locator('[data-fixture-group]');
  const empty = page.locator('[data-matches-empty]');
  const eitherCount = (await groups.count()) + (await empty.count());
  expect(eitherCount).toBeGreaterThan(0);
});

test('renders /fixtures/standings with 20 rows and 13 columns each', async ({ page }) => {
  await page.goto('/fixtures/standings');
  await expect(page.locator('[data-screen="fixtures-standings"]')).toBeVisible();
  // The mock should provide a full 20-row table
  const rows = page.locator('[data-standings-row]');
  await expect(rows).toHaveCount(20);
  // First row must have all 13 columns
  const firstRowCols = rows.first().locator('[data-col]');
  await expect(firstRowCols).toHaveCount(13);
});

test('Tabs switches between the three Fixtures sub-tabs and updates URL', async ({ page }) => {
  await page.goto('/fixtures/live');
  await expect(page.locator('[data-screen="fixtures-live"]')).toBeVisible();

  // Click the Matches tab — URL changes, content swaps
  await page.getByRole('tab', { name: /Matches/i }).click();
  await expect(page).toHaveURL(/\/fixtures\/matches/);
  await expect(page.locator('[data-screen="fixtures-matches"]')).toBeVisible();
  await expect(page.locator('[data-screen="fixtures-live"]')).toBeHidden();

  // Click Standings — URL + content swap again
  await page.getByRole('tab', { name: /Standings/i }).click();
  await expect(page).toHaveURL(/\/fixtures\/standings/);
  await expect(page.locator('[data-screen="fixtures-standings"]')).toBeVisible();
});

test('theme toggle flips the dark class on /fixtures/* without breaking layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/fixtures/matches');
  await expect(page.locator('[data-screen="fixtures-matches"]')).toBeVisible();

  const html = page.locator('html');
  const beforeHasDark = await html.evaluate((el: HTMLElement) => el.classList.contains('dark'));

  await page.getByRole('button', { name: /Toggle theme/i }).click();

  const afterHasDark = await html.evaluate((el: HTMLElement) => el.classList.contains('dark'));
  expect(afterHasDark).toBe(!beforeHasDark);

  // Sanity: filter chips still visible after the theme flip
  await expect(page.locator('[data-chip]')).toHaveCount(4);
});
```

**Pre-flight checks ralph runs first:**
1. `grep -n "role=\"tab\"\|role='tab'" frontend/src/components/layout/Tabs.svelte` — confirm the Tabs primitive uses `role="tab"` for its buttons (per P0d's contract). If it uses `role="button"` instead, the `getByRole('tab', ...)` queries above need adjusting.
2. `grep -n "Toggle theme" frontend/src/components/layout/BroadcastShell.svelte` — confirm the theme toggle button's accessible name. P0-cp's spec already exercises this pattern; the same accessible name should work here.
3. **`mockFootballApi` payload sanity** — verify the mock provides a 20-row standings response. If the existing mock only returns a partial table, extend it (in `helpers.ts`) so the standings count assertion passes deterministically. Note this as a deviation if extension is needed.

**Validation:** `cd frontend && npx playwright test --project=desktop-chrome checkpoint-p3-fixtures.spec.ts` — expect 5/5 pass. Then `--project=mobile-chrome` — expect 4/5 (the theme-toggle test self-pins to desktop viewport, but it should pass; the Tabs-switch test may need verification because the mobile bottom-bar pattern uses `MobileTabBar` not `Tabs`). **Mobile-chrome contingency:** if any test flakes on mobile-chrome that's specific to viewport-only behaviour, gate it with `test.skip(viewport.width < 1024, 'desktop-only check')` and document the deviation.

### Task 2 — Manual visual sweep (gates the `[x]` flip)

**Sweep checklist** (boot `cd frontend && npm run dev`):

```
[ ] /fixtures/live — at least one live MatchCard if matches are in progress, or the empty-state copy
[ ] /fixtures/live — LiveBanner pulses, MIN ticks, score legible
[ ] /fixtures/matches — fixtures grouped by date, all 4 filter chips work
[ ] /fixtures/matches — Top 6 / Relegation filters narrow the list correctly
[ ] /fixtures/standings — 20 rows, qualification zones tinted, FormDot rows correct
[ ] /fixtures/standings — clicking a row with an upcoming fixture navigates (placeholder URL OK)
[ ] Tabs switching: click Live → Matches → Standings — URL + content + active-state all update
[ ] Toggle theme on /fixtures/live, /fixtures/matches, /fixtures/standings — every screen flips cleanly
[ ] Resize <1024px — every screen stays usable; standings may need horizontal scroll (acceptable)
[ ] Mobile bottom tab bar shows Fixtures as active when on any /fixtures/* URL
[ ] /matches → /fixtures/matches redirect still works (legacy URL)
[ ] /standings → /fixtures/standings redirect still works (legacy URL)
[ ] /live-matches → /fixtures/live redirect still works (legacy URL)
```

### Task 3 — Commit

**Files staged:**
- `frontend/e2e/checkpoint-p3-fixtures.spec.ts`
- `IMPLEMENTATION_PLAN.md` (Active phase narrative + discovery note)
- `frontend/e2e/helpers.ts` *only if mockFootballApi was extended in Task 1's pre-flight*

**Commit message:**
```
P3-fixtures-cp: Fixtures hub Playwright checkpoint

frontend/e2e/checkpoint-p3-fixtures.spec.ts: 5 tests covering all three
Fixtures sub-tabs (Live, Matches, Standings) — primary zone presence,
13-column standings layout, Tabs switching with URL change, and theme
toggle invariant. Mirrors checkpoint-p0.spec.ts and checkpoint-p2.spec.ts
patterns; uses setupApp + mockFootballApi for deterministic state.

vitest 825/825 (unchanged; this slice is test-only and adds Playwright
only). svelte-check 0/0. checkpoint-p3-fixtures 5/5 on desktop-chrome,
4-5/5 on mobile-chrome (theme-toggle test desktop-only).

Auto-gated for spec write+pass+commit. Manual visual sweep RECOMMENDED
but not blocking. Tag at sign-off → v3.7. Closes the Fixtures sub-phase;
next sub-phase is Predictions hub (P4a-P4-cp), 7 slices.
```

## Rollover note for the next iteration

After P3-fixtures-cp ships, the next ralph iteration should:
1. Verify all P3a–P3c checkboxes are flipped in IMPLEMENTATION_PLAN.md (human action between this slice and the next)
2. Begin Predictions sub-phase plan grooming — draft `p4a-predictions-this-week.md`, `p4b-predictions-backtest.md`, `p4c-predictions-log.md`, `p4d-predictions-tools.md`, `p4e-export-text.md`, `p4f-export-binary.md`, `p4-cp-predictions-checkpoint.md` in this directory. Plan-only commits are precedent (`bdc551f`, `9726119`); they're untagged.
3. Begin P4a — Predictions This Week.

If `## Human notes for next iteration` has notes when the next iteration starts, ralph addresses those first per the established protocol.
