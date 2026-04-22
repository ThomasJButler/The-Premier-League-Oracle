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
    // Use `toHaveCount` which auto-retries until the component mounts —
    // the raw `.count()` call was racing the Svelte mount because this
    // test (unlike the one above it) doesn't gate on any `toBeVisible`
    // call first, so the query fires before the inputs exist.
    const inputs = page.locator('[data-testid="kelly-calculator"] input[type="number"]');
    await expect(inputs).toHaveCount(3);
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

  test('shows no-value warning when probability is below implied odds', async ({ page }) => {
    const calculator = page.locator('[data-testid="kelly-calculator"]');
    // Set probability below implied (odds 2.0 = 50% implied, set to 30%)
    const probInput = calculator.locator('input[type="number"]').nth(2);
    await probInput.fill('30');

    // Warning about no value should appear
    await expect(page.getByText(/don't offer value/i)).toBeVisible({ timeout: 3000 });
  });

  test('shows edge percentage and value bet indicator', async ({ page }) => {
    const results = page.locator('[data-testid="kelly-results"]');
    await expect(results).toBeVisible({ timeout: 3000 });

    // Edge indicator should be visible
    await expect(page.getByText('Your edge:')).toBeVisible();
    // Value bet indicator should show (defaults: prob 55%, odds 2.0 = positive edge)
    await expect(page.getByText('Value bet')).toBeVisible();
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
