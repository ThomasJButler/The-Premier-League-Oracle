import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

/**
 * P0-cp — Phase 0 checkpoint.
 *
 * Cumulative end-to-end probe of everything Phase 0 delivered:
 *   - Tokens + routing (P0a/P0b): every hub URL renders an app shell.
 *   - Shell (P0d): desktop sidebar above 1024px, mobile bottom bar below.
 *   - Theme toggle: clicking the sidebar control flips the `dark` class on <html>.
 *
 * Lives independently of per-feature specs so future regressions in the
 * shell / routing / theme plumbing fail loudly here even when the feature
 * specs would still pass.
 */

const HUBS = [
  '/today',
  '/fixtures/matches',
  '/predictions/this-week',
  '/oracle',
  '/insights/scorers',
  '/settings/account',
];

test.describe('P0 checkpoint — foundation works end-to-end', () => {
  for (const path of HUBS) {
    test(`hub renders at desktop: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setupApp(page);
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.locator('aside').first()).toBeVisible();
    });
  }

  test('mobile bottom bar appears at <1024px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupApp(page);
    await page.goto('/today');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('aside').first()).not.toBeVisible();
    await expect(page.locator('nav').getByText('More')).toBeVisible();
  });

  test('theme toggle changes the document class', async ({ page }) => {
    // Toggle lives in the desktop sidebar (P0d intentionally desktop-only),
    // so pin the viewport above the lg breakpoint regardless of project.
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
