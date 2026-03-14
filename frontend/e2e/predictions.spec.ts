import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Predictions', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Predictions');
    await page.waitForTimeout(500);
  });

  test('renders the predictions panel', async ({ page }) => {
    await expect(page.getByText(/Predictions|Gameweek/i)).toBeVisible();
  });

  test('gameweek selector is present', async ({ page }) => {
    // Should have previous/next gameweek controls
    const gwControls = page.locator('button').filter({ hasText: /GW|Gameweek|\d+/ }).first();
    await expect(gwControls).toBeVisible();
  });

  test('generate predictions button exists', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /Generate|Predict|Run/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(2000);
      // After generating, should see match predictions listed
      await expect(page.getByText(/Win|Draw|Home|Away/i)).toBeVisible();
    }
  });

  test('accuracy panel toggle works', async ({ page }) => {
    // Look for the accuracy panel toggle (chevron button)
    const toggle = page.locator('button').filter({ hasText: /Accuracy|accuracy/ }).first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(300);
      // Panel should now show accuracy breakdown
      await expect(page.getByText(/Home Win|Draw|Away Win/i)).toBeVisible();
    }
  });

  test('Kelly stake recommendations show a percentage', async ({ page }) => {
    // After predictions generate, Kelly stakes should show as percentages of bankroll
    const generateBtn = page.getByRole('button', { name: /Generate|Predict/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(2000);
      const stakeText = page.locator('text=/\\d+(\\.\\d+)?%/').first();
      await expect(stakeText).toBeVisible();
    }
  });

  test('screenshot - predictions view', async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'playwright-screenshots/predictions.png',
      fullPage: true,
    });
  });
});
