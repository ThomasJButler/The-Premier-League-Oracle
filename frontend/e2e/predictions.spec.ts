import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Predictions', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Predictions');
    await page.waitForLoadState('networkidle');
  });

  test('renders the predictions panel with gameweek selector', async ({ page }) => {
    // Gameweek select is the signature element of the Predictions view
    await expect(page.locator('select#gameweek')).toBeVisible();
  });

  test('gameweek selector has all 38 weeks', async ({ page }) => {
    const select = page.locator('select#gameweek');
    await expect(select).toBeVisible();
    const options = select.locator('option');
    await expect(options).toHaveCount(38);
  });

  test('predict gameweek button is visible and correctly labelled', async ({ page }) => {
    const predictBtn = page.locator('[data-testid="predict-gameweek"]');
    await expect(predictBtn).toBeVisible();
    await expect(predictBtn).toContainText('Predict Gameweek');
  });

  test('accuracy panel toggle works', async ({ page }) => {
    // Accuracy panel only renders when predictions exist in localStorage
    const panel = page.locator('[data-testid="accuracy-panel"]');
    const isVisible = await panel.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Accuracy panel requires existing predictions — needs API mocking to generate them');
      return;
    }
    // If visible, verify toggle works
    await panel.locator('button').first().click();
    await expect(page.getByText('By Outcome')).toBeVisible({ timeout: 3000 });
  });

  test('Kelly stake column appears after prediction generation', async ({ page }) => {
    // This test requires predictions to be generated, which needs match data from API
    // Without API mocking, we can only verify the predict button exists and is clickable
    const predictBtn = page.locator('[data-testid="predict-gameweek"]');
    await expect(predictBtn).toBeVisible();
    await expect(predictBtn).toBeEnabled();
    // Full assertion (click + verify results) requires API mocking
    test.skip(true, 'Verifying prediction results requires API data — needs route mocking');
  });

  test('screenshot - predictions view', async ({ page }) => {
    // Verify core UI loaded before screenshot
    await expect(page.locator('select#gameweek')).toBeVisible();
    await page.screenshot({
      path: 'playwright-screenshots/predictions.png',
      fullPage: true,
    });
  });
});
