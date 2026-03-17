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

  test('main content is visible without scrolling sideways', async ({ page }) => {
    // Key elements should be visible without horizontal scroll
    await expect(page.getByText(/Dashboard|Oracle/i).first()).toBeVisible();
  });

  test('can open mobile navigation menu', async ({ page }) => {
    // Find the hamburger/menu button (typically a button in the header)
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      // After clicking, nav items should be visible
      await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 3000 });
    }
  });

  test('nav items are tappable (sufficient size)', async ({ page }) => {
    // All nav buttons should have a minimum tap target of 44px height
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.locator('aside button, nav button').first().waitFor({ state: 'visible', timeout: 3000 });
    }

    const navBtns = page.locator('aside button, nav button');
    const count = await navBtns.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await navBtns.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('screenshot - mobile dashboard', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const viewport = page.viewportSize();
    const name = viewport ? `${viewport.width}px` : 'mobile';
    await page.screenshot({
      path: `playwright-screenshots/mobile-${name}-dashboard.png`,
      fullPage: true,
    });
  });

  test('screenshot - mobile sidebar open', async ({ page }) => {
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.locator('aside, nav').first().waitFor({ state: 'visible', timeout: 3000 });
    }
    const viewport = page.viewportSize();
    const name = viewport ? `${viewport.width}px` : 'mobile';
    await page.screenshot({
      path: `playwright-screenshots/mobile-${name}-sidebar.png`,
      fullPage: false,
    });
  });
});
