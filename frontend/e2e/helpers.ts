import { type Page } from '@playwright/test';
import { mockFootballApi } from './mockApi';

/**
 * Sets up API mocking and a mock API key in localStorage so the setup
 * wizard is skipped. Call this at the start of every test.
 *
 * Route interception is registered BEFORE navigation so the app's
 * initial data fetches hit the mock handler instead of the real API.
 */
export async function setupApp(page: Page, apiKey = 'test-api-key-e2e') {
  // Register API mocks before any navigation
  await mockFootballApi(page);

  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem('football_data_api_key', key);
  }, apiKey);
  // Reload so the app reads the key from localStorage
  await page.reload();
  // Wait for the main content area to appear (setup wizard dismissed)
  await page.waitForSelector('main', { timeout: 10000 });
  // Allow time for API data to load (the app rate-limits requests at 6s intervals)
  await page.waitForLoadState('networkidle');
}

/**
 * Navigates to a view by name.
 *
 * On desktop the sidebar is always visible, so we click the nav button directly.
 * On mobile the app uses a bottom nav bar with a "More" popup for secondary items.
 */
export async function navigateTo(page: Page, viewName: string) {
  const viewport = page.viewportSize();
  // Mobile nav is visible below lg breakpoint (1024px), sidebar above
  const isMobile = viewport && viewport.width < 1024;

  if (isMobile) {
    // MobileNav primary items (shown directly on bottom bar)
    const primaryMap: Record<string, string> = {
      'Dashboard': 'Dashboard',
      'Live Matches': 'Live',
      'Predictions': 'Predictions',
      'Standings': 'Standings',
    };

    if (primaryMap[viewName]) {
      // Click directly on the bottom nav button
      await page.locator('.mobile-nav button').filter({ hasText: primaryMap[viewName] }).click();
    } else {
      // Open "More" menu, then click the target item
      await page.locator('button[aria-label="More options"]').click();
      await page.locator('.grid.grid-cols-4').waitFor({ state: 'visible' });
      await page.locator('.grid.grid-cols-4 button').filter({ hasText: viewName }).click();
    }
  } else {
    await page.getByRole('button', { name: viewName }).click();
  }

  // Wait for the view transition to complete (App.svelte uses 200ms + 50ms delays)
  await page.waitForTimeout(400);
  await page.waitForLoadState('domcontentloaded');
}
