import { test, expect } from '@playwright/test';
import { setupApp } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    // Dashboard is the default view
    await page.waitForLoadState('networkidle');
  });

  test('renders all 4 stat cards with values', async ({ page }) => {
    const statCards = page.locator('[data-testid="stat-card"]');
    await expect(statCards).toHaveCount(4);

    // Verify each card has a rendered value (not blank)
    for (let i = 0; i < 4; i++) {
      const value = statCards.nth(i).locator('.text-2xl');
      await expect(value).toBeVisible();
      await expect(value).not.toBeEmpty();
    }

    // Check specific stat labels exist
    await expect(page.getByText('Prediction Accuracy')).toBeVisible();
    await expect(page.getByText('Total Predictions')).toBeVisible();
    await expect(page.getByText('Bets Placed')).toBeVisible();
  });

  test('stat values are not NaN or blank', async ({ page }) => {
    // Get all visible stat values - they should be numbers or percentages, not "NaN"
    const body = await page.textContent('body');
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');
  });

  test('accuracy stat card shows a percentage', async ({ page }) => {
    // Scope to the specific stat card, not the entire page
    const statCards = page.locator('[data-testid="stat-card"]');
    const accuracyCard = statCards.filter({ hasText: 'Prediction Accuracy' });
    await expect(accuracyCard).toBeVisible();
    await expect(accuracyCard.locator('.text-2xl')).toContainText('%');
  });

  test('"View All Matches" button exists and navigates', async ({ page }) => {
    const viewBtn = page.locator('[data-testid="view-all-matches"]');
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();
    // Should have navigated away from Dashboard
    await expect(page.getByText(/Matches|Fixtures/i)).toBeVisible();
  });

  test('profit/loss chart renders', async ({ page }) => {
    // Chart.js renders a canvas element
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('screenshot - full dashboard', async ({ page }) => {
    // Verify stat cards loaded before taking screenshot
    await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible();
    await page.screenshot({
      path: 'playwright-screenshots/dashboard-full.png',
      fullPage: true,
    });
  });
});
