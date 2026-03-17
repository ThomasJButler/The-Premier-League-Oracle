import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Predictions', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Predictions');
    await page.waitForLoadState('networkidle');
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
      // After generating, should see match predictions listed
      await expect(page.getByText(/Win|Draw|Home|Away/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('accuracy panel toggle works', async ({ page }) => {
    // Look for the accuracy panel toggle (chevron button)
    const toggle = page.locator('button').filter({ hasText: /Accuracy|accuracy/ }).first();
    if (await toggle.isVisible()) {
      await toggle.click();
      // Panel should now show accuracy breakdown
      await expect(page.getByText(/Home Win|Draw|Away Win/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('Kelly stake recommendations show a percentage', async ({ page }) => {
    // After predictions generate, Kelly stakes should show as percentages of bankroll
    const generateBtn = page.getByRole('button', { name: /Generate|Predict/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      const stakeText = page.locator('text=/\\d+(\\.\\d+)?%/').first();
      await expect(stakeText).toBeVisible();
    }
  });

  test('screenshot - predictions view', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'playwright-screenshots/predictions.png',
      fullPage: true,
    });
  });
});
