# Phase 0 — Slice P0-cp — Checkpoint

> **Part of:** [`docs/superpowers/plans/2026-04-26-phase-0-foundation/index.md`](./index.md)  
> **Source spec:** `docs/superpowers/specs/2026-04-26-frontend-broadcast-redesign-design.md`  
> **State file:** `IMPLEMENTATION_PLAN.md` at repo root.

---

## P0-cp — Phase 0 checkpoint

**Slice goal:** End-to-end verification before Phase 1 begins. No new code; this is a Playwright spec + a manual visual sweep.

**Manual gate:** human eyeball on every viewport × theme combination.

### Task 1: Write the checkpoint Playwright spec

**Files:**
- Create: `frontend/e2e/checkpoint-p0.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

const HUBS = ['/today', '/fixtures/matches', '/predictions/this-week', '/oracle', '/insights/scorers', '/settings/account'];

test.describe('P0 checkpoint — foundation works end-to-end', () => {
  for (const path of HUBS) {
    test(`hub renders at desktop: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      // Sidebar visible at desktop
      await expect(page.locator('aside').first()).toBeVisible();
    });
  }

  test('mobile bottom bar appears at <1024px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });   // iPhone-12-ish
    await page.goto('/today');
    await expect(page.getByRole('main')).toBeVisible();
    // Sidebar hidden, bottom nav visible
    await expect(page.locator('aside').first()).not.toBeVisible();
    await expect(page.locator('nav').getByText('More')).toBeVisible();
  });

  test('theme toggle changes the document class', async ({ page }) => {
    await page.goto('/today');
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.getByText('Toggle theme').click();
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(after).toBe(!before);
  });
});
```

- [ ] **Step 2: Run the spec on both projects**

Run:
```bash
cd frontend
npx playwright test e2e/checkpoint-p0.spec.ts --project=desktop-chrome
npx playwright test e2e/checkpoint-p0.spec.ts --project=mobile-chrome
```

Expected: all green on both projects.

### Task 2: Manual visual sweep

This is a human checkpoint. Run `npm run dev` and visit:

- [ ] `/today` — desktop dark
- [ ] `/today` — desktop light
- [ ] `/today` — mobile (390×844 in DevTools) dark
- [ ] `/today` — mobile light
- [ ] `/fixtures/matches` — desktop dark + light
- [ ] `/fixtures/matches` — mobile dark + light
- [ ] `/predictions/this-week` — desktop dark + light
- [ ] `/oracle` — desktop dark + light
- [ ] `/insights/scorers` — desktop dark + light
- [ ] `/settings/display` — desktop dark + light

For each combination, confirm:
- The new shell renders (sidebar at desktop, bottom bar at mobile)
- Legacy content renders inside the new shell without overlap or clipping
- Surfaces use cream / near-black (not the old Stadium Nightfall blues)
- The Liverpool red accent appears wherever `--primary` is used (sidebar active state, "Toggle theme" indicator, etc.)
- No console errors

### Task 3: If sweep reveals issues, log under `## Human notes`

Open `ClaudeRalph/IMPLEMENTATION_PLAN.md` and append observations to the `## Human notes for next iteration` section, prefixed with the slice ID:

```md
## Human notes for next iteration

- (P0-cp) The new shell's sidebar overlaps the LiveTicker on desktop; LiveTicker should sit *inside* BroadcastShell's main slot, not before it.
- (P0-cp) Theme toggle button in the sidebar is positioned awkwardly; move to topbar in P0d follow-up.
```

Future ralph iterations consume these notes during the next slice's contract.

### Task 4: Commit the checkpoint spec (independent of any P0d follow-ups)

```bash
cd /Users/tombutler/Repos/The-Premier-League-Oracle
git add frontend/e2e/checkpoint-p0.spec.ts
git commit -m "P0-cp: phase 0 checkpoint — playwright sweep across hubs, viewports, themes"
```

If `## Human notes` was populated, commit that too:

```bash
git add ClaudeRalph/IMPLEMENTATION_PLAN.md
git commit -m "P0-cp: log checkpoint findings for next iteration"
```

---

## End-of-phase

By the end of P0-cp, the codebase has:
- The broadcast palette in place across the app, with team theming preserved
- URL-driven routing replacing the old view-state model
- Seven atom primitives ready for MatchCard composition in Phase 1
- A new shell wrapping the still-legacy screens
- Five orphaned betting components deleted
- A passing Playwright spec proving the routes work, and a manual sweep proving the visual language landed

**Next phase:** Phase 1 (MatchCard primitive). Write that plan as a separate document at `docs/superpowers/plans/2026-MM-DD-frontend-broadcast-redesign-phase-1-matchcard.md` once Phase 0's loop has completed and the checkpoint sweep is signed off.

## Self-review notes

- **Spec coverage:** Every Phase 0 deliverable in the spec maps to a task here — tokens table → Task P0a/2-3, type scale → P0a/3, Tailwind config → P0a/4, auto-gate test → P0a/5; routing migration → P0b; killed-feature deletions → P0b/5; redirect map → P0b/2; SPA fallback → P0b/4; seven atoms → P0c/2-8; BroadcastShell + Tabs + MobileTabBar + MobileBottomSheet → P0d/2-4; new stores (density, supportingClub) → P0d/1; checkpoint spec + manual sweep → P0-cp.
- **Placeholders:** None left. Every step has runnable commands or complete code blocks. The "if X happens, do Y" branches are explicit.
- **Type consistency:** `Density` and `Theme` types defined in `types/redesign.ts`; consumed by `density.ts` store and (later) by Settings. `IconName` exported from `icons.ts` and used by `Icon.svelte`. `SubTabDef` exported from `routes.ts` and consumed by `Tabs.svelte`. `Fixture`, `MatchPrediction`, `MatchCardProps` defined for Phase 1's use; not referenced in any P0 task except as a type-only import to verify they compile.
- **Ralph-loop sliceability:** Each `## P0X` section is one ralph iteration. Sub-tasks are micro-steps within the iteration. The slice's commit comes at the very end of the section.
