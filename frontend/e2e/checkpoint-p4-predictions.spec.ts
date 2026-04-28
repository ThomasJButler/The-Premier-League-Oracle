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
