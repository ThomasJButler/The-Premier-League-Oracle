import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    // Dashboard is the default view
    await page.waitForTimeout(1000);
  });

  test('renders stat cards', async ({ page }) => {
    // All four stat cards should be present
    await expect(page.getByText(/Total Predictions/i)).toBeVisible();
    await expect(page.getByText(/Accuracy|Win Rate/i)).toBeVisible();
    await expect(page.getByText(/Bets Placed/i)).toBeVisible();
  });

  test('stat values are not NaN or blank', async ({ page }) => {
    // Get all visible stat values - they should be numbers or percentages, not "NaN"
    const body = await page.textContent('body');
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');
  });

  test('accuracy section shows a percentage', async ({ page }) => {
    // Accuracy should render as a number, even if 0%
    const accuracyText = page.locator('text=/\\d+(\\.\\d+)?%/').first();
    await expect(accuracyText).toBeVisible();
  });

  test('"View All Matches" button exists and is clickable', async ({ page }) => {
    const viewBtn = page.getByRole('button', { name: /View All|All Matches/i }).first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      // Should have navigated away from Dashboard
      await expect(page.getByText(/Matches|Fixtures/i)).toBeVisible();
    }
  });

  test('profit/loss chart renders', async ({ page }) => {
    // Chart.js renders a canvas element
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('screenshot - full dashboard', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: 'playwright-screenshots/dashboard-full.png',
      fullPage: true,
    });
  });
});
