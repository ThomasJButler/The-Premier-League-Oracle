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
    // Gameweek select is unique to Predictions view
    await expect(page.locator('select#gameweek')).toBeVisible();
  });

  test('navigates to Standings view', async ({ page }) => {
    await navigateTo(page, 'Standings');
    // Standings renders a data table
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('navigates to Value Bets view', async ({ page }) => {
    await navigateTo(page, 'Value Bets');
    // Odds input section is unique to Value Bets
    await expect(page.locator('[data-testid="odds-inputs"]').first()).toBeVisible();
  });

  test('navigates to Kelly Calculator', async ({ page }) => {
    await navigateTo(page, 'Kelly Calculator');
    // Kelly calculator container is unique to this view
    await expect(page.locator('[data-testid="kelly-calculator"]')).toBeVisible();
  });

  test('navigates to Betting History', async ({ page }) => {
    await navigateTo(page, 'Betting History');
    await expect(page.getByRole('heading', { name: /Betting History/i })).toBeVisible();
  });

  test('navigates to Settings', async ({ page }) => {
    await navigateTo(page, 'Settings');
    // "API Key" label is unique to Settings
    await expect(page.getByText('API Key')).toBeVisible();
  });

  test('navigates to Help', async ({ page }) => {
    await navigateTo(page, 'Help');
    await expect(page.getByRole('heading', { name: /Getting Started/i })).toBeVisible();
  });

  test('takes screenshot of all main views', async ({ page }) => {
    const views = ['Dashboard', 'Predictions', 'Standings', 'Live Matches', 'Value Bets'];
    for (const view of views) {
      await navigateTo(page, view);
      await page.waitForLoadState('networkidle');
      // Verify page content loaded before screenshot
      await expect(page.locator('.main-content, main, [class*="main"]').first()).toBeVisible();
      await page.screenshot({ path: `playwright-screenshots/${view.toLowerCase().replace(' ', '-')}.png`, fullPage: true });
    }
  });
});
