import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
  });

  test('loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('renders the sidebar with nav items', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Predictions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Standings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Live Matches' })).toBeVisible();
  });

  test('navigates to Predictions view', async ({ page }) => {
    await navigateTo(page, 'Predictions');
    await expect(page.getByText(/Predictions|Gameweek|Generate/i)).toBeVisible();
  });

  test('navigates to Standings view', async ({ page }) => {
    await navigateTo(page, 'Standings');
    await expect(page.getByText(/Standings|Position|Points/i)).toBeVisible();
  });

  test('navigates to Value Bets view', async ({ page }) => {
    await navigateTo(page, 'Value Bets');
    await expect(page.getByText(/Value Bets|odds|Expected Value/i)).toBeVisible();
  });

  test('navigates to Kelly Calculator', async ({ page }) => {
    await navigateTo(page, 'Kelly Calculator');
    await expect(page.getByText(/Kelly|Bankroll|Stake/i)).toBeVisible();
  });

  test('navigates to Betting History', async ({ page }) => {
    await navigateTo(page, 'Betting History');
    await expect(page.getByText(/Betting History|No bets|P\/L/i)).toBeVisible();
  });

  test('navigates to Settings', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await expect(page.getByText(/Settings|API|Cache/i)).toBeVisible();
  });

  test('navigates to Help', async ({ page }) => {
    await navigateTo(page, 'Help');
    await expect(page.getByText(/Help|FAQ|Getting Started/i)).toBeVisible();
  });

  test('takes screenshot of all main views', async ({ page }) => {
    const views = ['Dashboard', 'Predictions', 'Standings', 'Live Matches', 'Value Bets'];
    for (const view of views) {
      await navigateTo(page, view);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `playwright-screenshots/${view.toLowerCase().replace(' ', '-')}.png`, fullPage: true });
    }
  });
});
