import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

// These tests run in the mobile-chrome and iphone-se projects defined in playwright.config.ts
// They specifically target mobile viewport issues

test.describe('Mobile UX', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await page.waitForLoadState('networkidle');
  });

  test('no horizontal overflow on dashboard', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });

  test('dashboard stat cards are visible', async ({ page }) => {
    // On mobile, stat cards should still render (stacked vertically)
    const statCards = page.locator('[data-testid="stat-card"]');
    await expect(statCards.first()).toBeVisible();
  });

  test('can open mobile navigation menu', async ({ page }) => {
    // Mobile menu button must exist on mobile viewports
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    // After clicking, nav items must be visible
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 3000 });
  });

  test('nav items are tappable (sufficient size)', async ({ page }) => {
    // Open the menu
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const navBtns = page.locator('aside button, nav button');
    await expect(navBtns.first()).toBeVisible({ timeout: 3000 });

    // All nav buttons must have a minimum tap target of 36px height
    const count = await navBtns.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await navBtns.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(36);
    }
  });

  test('screenshot - mobile dashboard', async ({ page }) => {
    // Verify content loaded before screenshot
    await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible();
    const viewport = page.viewportSize();
    const name = viewport ? `${viewport.width}px` : 'mobile';
    await page.screenshot({
      path: `playwright-screenshots/mobile-${name}-dashboard.png`,
      fullPage: true,
    });
  });

  test('screenshot - mobile sidebar open', async ({ page }) => {
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    // Verify sidebar opened before screenshot
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 3000 });
    const viewport = page.viewportSize();
    const name = viewport ? `${viewport.width}px` : 'mobile';
    await page.screenshot({
      path: `playwright-screenshots/mobile-${name}-sidebar.png`,
      fullPage: false,
    });
  });
});
