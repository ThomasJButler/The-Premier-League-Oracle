import { type Page } from '@playwright/test';
import { mockFootballApi } from './mockApi';

/**
 * Timeout strategy:
 *   3000ms — UI elements expected instantly (nav, buttons, headings)
 *  10000ms — elements requiring API data or app bootstrap
 *  30000ms — CPU-intensive operations (prediction computation)
 */

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

    // Seed one completed + correct prediction so Dashboard renders its
    // `stat-cards` state rather than the empty `onboarding-card` state.
    // `hasActivity = rawTotalPredictions > 0 || rawTotalBets > 0` — one stored
    // settled prediction flips that to true. Tests expecting specific
    // stat-cards elements depend on this seed.
    const seededPrediction = {
      'seed_e2e_1': {
        id: 'seed_e2e_1',
        matchId: 'seed_e2e_match_1',
        homeTeam: 'Arsenal',
        awayTeam: 'Liverpool',
        predictedResult: 'H',
        predictedHomeGoals: 2,
        predictedAwayGoals: 1,
        confidence: 0.72,
        actualResult: 'H',
        actualHomeGoals: 2,
        actualAwayGoals: 1,
        isCorrect: true,
        timestamp: new Date(Date.now() - 7 * 86400_000).toISOString(),
        matchDate: new Date(Date.now() - 7 * 86400_000).toISOString(),
        matchday: 20,
      },
    };
    localStorage.setItem('pl_oracle_predictions', JSON.stringify(seededPrediction));
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
      await page.locator('[data-testid="more-menu-grid"]').waitFor({ state: 'visible' });
      await page.locator('[data-testid="more-menu-grid"] button').filter({ hasText: viewName }).click();
    }
  } else {
    // Scope to the sidebar (role="complementary") because main-content views
    // now host their own buttons with overlapping accessible names — e.g.
    // the Dashboard has a "Predictions" tab button and an "Open Kelly
    // Calculator" CTA that collide with the sidebar's nav items. Matching
    // globally returns 2+ elements and trips Playwright's strict mode.
    // Combine sidebar-scope with `exact: true` so only the nav item matches.
    await page.getByRole('complementary').getByRole('button', { name: viewName, exact: true }).click();
  }

  await page.waitForLoadState('domcontentloaded');
}
