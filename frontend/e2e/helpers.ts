import { type Page } from '@playwright/test';

/**
 * Sets a mock API key in localStorage so the setup wizard is skipped,
 * then navigates to the app root. Call this at the start of every test.
 */
export async function setupApp(page: Page, apiKey = 'test-api-key-e2e') {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem('football_data_api_key', key);
  }, apiKey);
  // Reload so the app reads the key from localStorage
  await page.reload();
  // Wait for the main content area to appear (setup wizard dismissed)
  await page.waitForSelector('.main-content, main, [class*="main"]', { timeout: 10000 });
}

/**
 * Clicks a sidebar nav item by its visible name.
 * On desktop the sidebar is already open; on mobile we open it first.
 */
export async function navigateTo(page: Page, viewName: string) {
  const viewport = page.viewportSize();
  const isMobile = viewport && viewport.width < 768;

  if (isMobile) {
    // Open the hamburger menu on mobile
    const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button[aria-label*="sidebar"]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.locator('aside, nav').first().waitFor({ state: 'visible' });
    }
  }

  await page.getByRole('button', { name: viewName }).click();
  await page.waitForLoadState('domcontentloaded');
}
