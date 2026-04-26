import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

/**
 * P3 Fixtures sub-phase checkpoint — asserts the three Fixtures sub-tabs
 * (Live, Matches, Standings) each render their primary content zones,
 * sub-tab URL navigation cleanly swaps screens, and the theme toggle
 * still flips on `/fixtures/*`.
 *
 * Mirrors the structure of `checkpoint-p0.spec.ts` and `checkpoint-p2.spec.ts`.
 * Catches integration regressions across P3a/P3b/P3c — internals stay
 * vitest-covered.
 */

test.describe('Phase 3 Fixtures sub-phase checkpoint', () => {
  test('renders /fixtures/live with the live screen root', async ({ page }) => {
    await setupApp(page);
    await page.goto('/fixtures/live');

    await expect(page.locator('[data-screen="fixtures-live"]')).toBeVisible();

    // Either at least one live row OR the empty-state copy — both are valid
    // steady states because the mock returns no IN_PLAY matches and the
    // dataService filter therefore yields an empty list.
    const liveRows = page.locator('[data-live-row]');
    const liveEmpty = page.locator('[data-live-empty]');
    const eitherCount = (await liveRows.count()) + (await liveEmpty.count());
    expect(eitherCount).toBeGreaterThan(0);
  });

  test('renders /fixtures/matches with FilterChips and at least one fixture group', async ({
    page,
  }) => {
    await setupApp(page);
    await page.goto('/fixtures/matches');

    await expect(page.locator('[data-screen="fixtures-matches"]')).toBeVisible();
    await expect(page.locator('[data-chip]')).toHaveCount(4);

    const groups = page.locator('[data-fixture-group]');
    const empty = page.locator('[data-matches-empty]');
    const eitherCount = (await groups.count()) + (await empty.count());
    expect(eitherCount).toBeGreaterThan(0);
  });

  test('renders /fixtures/standings with 20 rows and 13 columns each', async ({ page }) => {
    await setupApp(page);
    await page.goto('/fixtures/standings');

    await expect(page.locator('[data-screen="fixtures-standings"]')).toBeVisible();

    const rows = page.locator('[data-standings-row]');
    await expect(rows).toHaveCount(20);

    const firstRowCols = rows.first().locator('[data-col]');
    await expect(firstRowCols).toHaveCount(13);
  });

  test('navigates cleanly between the three Fixtures sub-tabs', async ({ page }) => {
    await setupApp(page);
    await page.goto('/fixtures/live');
    await expect(page.locator('[data-screen="fixtures-live"]')).toBeVisible();

    await page.goto('/fixtures/matches');
    await expect(page).toHaveURL(/\/fixtures\/matches/);
    await expect(page.locator('[data-screen="fixtures-matches"]')).toBeVisible();
    await expect(page.locator('[data-screen="fixtures-live"]')).toHaveCount(0);

    await page.goto('/fixtures/standings');
    await expect(page).toHaveURL(/\/fixtures\/standings/);
    await expect(page.locator('[data-screen="fixtures-standings"]')).toBeVisible();
    await expect(page.locator('[data-screen="fixtures-matches"]')).toHaveCount(0);
  });

  test('theme toggle flips the dark class on /fixtures/* without breaking layout', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupApp(page);
    await page.goto('/fixtures/matches');
    await expect(page.locator('[data-screen="fixtures-matches"]')).toBeVisible();

    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    await page.getByRole('button', { name: /Toggle theme/i }).click();

    const after = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(after).toBe(!before);

    // Sanity: filter chips still visible after the theme flip
    await expect(page.locator('[data-chip]')).toHaveCount(4);
  });
});
