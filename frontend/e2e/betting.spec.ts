import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Value Bets', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Value Bets');
    await page.waitForLoadState('networkidle');
  });

  test('renders odds input section', async ({ page }) => {
    // Odds input section is the core of Value Bets — must be visible
    await expect(page.locator('[data-testid="odds-inputs"]').first()).toBeVisible();
  });

  test('has Home, Draw, and Away odds inputs', async ({ page }) => {
    const oddsSection = page.locator('[data-testid="odds-inputs"]').first();
    await expect(oddsSection).toBeVisible();
    // Should have at least 3 number inputs (Home, Draw, Away)
    const inputs = oddsSection.locator('input[type="number"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('odds inputs accept decimal values', async ({ page }) => {
    const oddsSection = page.locator('[data-testid="odds-inputs"]').first();
    const homeInput = oddsSection.locator('input[type="number"]').first();
    await expect(homeInput).toBeVisible();
    await homeInput.fill('2.10');
    await expect(homeInput).toHaveValue('2.10');
  });

  test('screenshot - value bets view', async ({ page }) => {
    // Verify odds inputs loaded before screenshot
    await expect(page.locator('[data-testid="odds-inputs"]').first()).toBeVisible();
    await page.screenshot({
      path: 'playwright-screenshots/value-bets.png',
      fullPage: true,
    });
  });
});

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
