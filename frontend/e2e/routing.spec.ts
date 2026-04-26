import { test, expect } from '@playwright/test';

/**
 * P0b auto-gate. Asserts:
 * - every new v3 URL responds with the app shell (200, page renders)
 * - every legacy URL in the redirect map ends up at its v3 replacement
 */

const NEW_ROUTES = [
  '/today',
  '/fixtures/live',
  '/fixtures/matches',
  '/fixtures/standings',
  '/predictions/this-week',
  '/predictions/backtest',
  '/predictions/log',
  '/predictions/tools',
  '/oracle',
  '/insights/scorers',
  '/insights/stats',
  '/insights/timeline',
  '/settings/account',
  '/settings/api-data',
  '/settings/display',
  '/settings/predictions',
  '/settings/notifications',
  '/settings/privacy',
  '/settings/help',
];

const REDIRECTS: Array<[string, string]> = [
  ['/',                    '/today'],
  ['/dashboard',           '/today'],
  ['/matches',             '/fixtures/matches'],
  ['/live-matches',        '/fixtures/live'],
  ['/standings',           '/fixtures/standings'],
  ['/predictions',         '/predictions/this-week'],
  ['/top-scorers',         '/insights/scorers'],
  ['/season-stats',        '/insights/stats'],
  ['/season-timeline',     '/insights/timeline'],
  ['/oracle-chat',         '/oracle'],
  ['/suggested-bets',      '/predictions/tools'],
  ['/accumulators',        '/predictions/tools'],
  ['/betting-history',     '/predictions/log'],
];

for (const path of NEW_ROUTES) {
  test(`new route renders: ${path}`, async ({ page }) => {
    const resp = await page.goto(path);
    expect(resp?.status()).toBeLessThan(400);
    // App shell renders (the 'main' landmark exists)
    await expect(page.getByRole('main')).toBeVisible();
  });
}

for (const [from, to] of REDIRECTS) {
  test(`redirect ${from} -> ${to}`, async ({ page }) => {
    await page.goto(from);
    // Allow client-side router redirect to settle
    const target = to.split('?')[0];
    await page.waitForURL(new RegExp(target.replace(/\//g, '\\/')), { timeout: 5000 });
    expect(page.url()).toContain(target);
  });
}
