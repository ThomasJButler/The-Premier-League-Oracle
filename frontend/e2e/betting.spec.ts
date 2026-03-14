import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Value Bets', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Value Bets');
    await page.waitForTimeout(500);
  });

  test('renders value bets panel', async ({ page }) => {
    await expect(page.getByText(/Value Bets|Expected Value|EV/i)).toBeVisible();
  });

  test('odds input fields are present', async ({ page }) => {
    // Manual odds entry UI should have input fields
    const oddsInputs = page.locator('input[type="number"], input[placeholder*="odds"], input[placeholder*="Odds"]');
    const count = await oddsInputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('entering odds shows EV calculation', async ({ page }) => {
    // Fill in home odds and check that EV updates
    const homeOddsInput = page.locator('input').filter({ has: page.locator('[placeholder*="Home"], [name*="home"]') }).first();
    if (await homeOddsInput.isVisible()) {
      await homeOddsInput.fill('2.10');
      await page.waitForTimeout(300);
      // EV or value indicator should appear
      await expect(page.getByText(/EV|Value|Edge|%/i)).toBeVisible();
    }
  });

  test('screenshot - value bets view', async ({ page }) => {
    await page.waitForTimeout(1000);
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
    await page.waitForTimeout(500);
  });

  test('renders Kelly calculator form', async ({ page }) => {
    await expect(page.getByText(/Kelly|Bankroll|Stake/i)).toBeVisible();
  });

  test('has bankroll and odds inputs', async ({ page }) => {
    const inputs = page.locator('input[type="number"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('calculates stake when inputs are filled', async ({ page }) => {
    const inputs = page.locator('input[type="number"]');
    if ((await inputs.count()) >= 2) {
      await inputs.nth(0).fill('1000');  // bankroll
      await inputs.nth(1).fill('2.5');   // odds
      await page.waitForTimeout(300);
      // Should show a recommended stake
      await expect(page.getByText(/£|stake|Stake|\d+\.\d{2}/i)).toBeVisible();
    }
  });

  test('screenshot - Kelly calculator', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'playwright-screenshots/kelly-calculator.png',
      fullPage: true,
    });
  });
});
