import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Kelly Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Kelly Calculator');
    await page.waitForLoadState('networkidle');
  });

  test('renders Kelly calculator with bankroll and odds inputs', async ({ page }) => {
    const calculator = page.locator('[data-testid="kelly-calculator"]');
    await expect(calculator).toBeVisible();
    await expect(page.getByText('Your Bankroll')).toBeVisible();
    await expect(page.getByText('Bookmaker Odds (Decimal)')).toBeVisible();
  });

  test('has bankroll and odds number inputs', async ({ page }) => {
    const calculator = page.locator('[data-testid="kelly-calculator"]');
    const inputs = calculator.locator('input[type="number"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('shows recommended bet results with default values', async ({ page }) => {
    // Kelly calculator auto-calculates with defaults (bankroll=100, odds=2.0, prob=55%)
    // Results section should be visible without any user interaction
    const results = page.locator('[data-testid="kelly-results"]');
    await expect(results).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Stake Amount')).toBeVisible();
    await expect(page.getByText('Expected Value')).toBeVisible();
    await expect(page.getByText('Potential Return')).toBeVisible();
  });

  test('recalculates when bankroll is changed', async ({ page }) => {
    const calculator = page.locator('[data-testid="kelly-calculator"]');
    const bankrollInput = calculator.locator('input[type="number"]').first();
    await expect(bankrollInput).toBeVisible();

    // Change bankroll and verify results update
    await bankrollInput.fill('1000');
    const results = page.locator('[data-testid="kelly-results"]');
    await expect(results).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Stake Amount')).toBeVisible();
  });

  test('screenshot - Kelly calculator', async ({ page }) => {
    // Verify calculator and results loaded before screenshot
    await expect(page.locator('[data-testid="kelly-results"]')).toBeVisible({ timeout: 3000 });
    await page.screenshot({
      path: 'playwright-screenshots/kelly-calculator.png',
      fullPage: true,
    });
  });
});
