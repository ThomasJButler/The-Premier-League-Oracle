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
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
    await expect(statCards).toHaveCount(4);

    // Verify each card has a rendered value (not blank)
    for (let i = 0; i < 4; i++) {
      const value = statCards.nth(i).locator('.text-xl');
      await expect(value).toBeVisible();
      await expect(value).not.toBeEmpty();
    }

    // Check specific stat labels exist within the stat cards container
    const cardsContainer = page.locator('[data-testid="stat-cards"]');
    await expect(cardsContainer.getByText('Prediction Accuracy')).toBeVisible();
    await expect(cardsContainer.getByText('Total Predictions')).toBeVisible();
    await expect(cardsContainer.getByText('Bets Placed', { exact: true })).toBeVisible();
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
    await expect(accuracyCard.locator('.text-xl')).toContainText('%');
  });

  test('"View All Matches" button exists and navigates', async ({ page }) => {
    // The "view-all-matches" CTA only renders on the Upcoming activity tab.
    // Click the tab before asserting the button is present.
    await page.locator('[data-testid="tab-upcoming"]').click();
    const viewBtn = page.locator('[data-testid="view-all-matches"]');
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    // Scroll into view in case bottom nav obscures the button on mobile
    await viewBtn.scrollIntoViewIfNeeded();
    await viewBtn.click();
    // The dashboard hero should no longer be visible — we've navigated away
    await expect(page.locator('[data-testid="stat-cards"]')).not.toBeVisible({ timeout: 5000 });
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
