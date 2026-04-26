import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

/**
 * P2 checkpoint — Today screen renders all five zones at desktop and mobile
 * across both themes. Mirrors the structure of `checkpoint-p0.spec.ts`.
 */

test.describe('Phase 2 checkpoint — Today screen', () => {
  test('renders all five zones on /today (command strip + hero + KPI + grid + below-fold)', async ({
    page,
  }) => {
    await setupApp(page);
    await page.goto('/today');

    await expect(page.locator('[data-command-strip]')).toBeVisible();
    await expect(page.locator('[data-zone="hero"], [data-zone="hero-empty"]')).toBeVisible();
    await expect(page.locator('[data-zone="kpi-strip"]')).toBeVisible();
    await expect(page.locator('[data-zone="grid"], [data-zone="grid-empty"]')).toBeVisible();
    await expect(page.locator('[data-zone="trends"]')).toBeVisible();
    await expect(page.locator('[data-zone="log"]')).toBeVisible();
  });

  test('command strip is positioned sticky', async ({ page }) => {
    await setupApp(page);
    await page.goto('/today');
    const position = await page
      .locator('[data-command-strip]')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('theme toggle still flips the dark class while on /today', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupApp(page);
    await page.goto('/today');
    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    await page.getByText('Toggle theme').click();
    const after = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(after).toBe(!before);
  });
});
