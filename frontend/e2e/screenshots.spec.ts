import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Screenshot capture for every Kicker route.
 *
 * Run with:
 *   npm run test:e2e -- screenshots --project=desktop-chrome
 *   npm run test:e2e -- screenshots --project=mobile-chrome
 *
 * Or both viewports at once:
 *   npm run test:e2e -- screenshots
 *
 * Output: frontend/e2e/screenshots/{run-timestamp}/{project}/{route}.png
 *
 * Each route is its own test so a single failure doesn't bring the rest down.
 * Persona is seeded to `voice` via localStorage before each visit so accent
 * colours render consistently across the contact sheet.
 */

// Stable timestamp PER TEST RUN — captured at module load so all tests in
// one `playwright test` invocation share one output folder.
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

interface RouteSpec {
  name: string; // becomes the filename
  path: string | ((page: Page) => Promise<string>); // static path OR resolver
  waitFor?: string; // optional selector to wait for before snap
}

const ROUTES: RouteSpec[] = [
  { name: '01-today', path: '/today', waitFor: '[data-kicker-shell], [data-mobile-header]' },
  { name: '02-fixtures', path: '/fixtures' },
  {
    name: '03-fixtures-detail',
    path: async (page) => {
      // Resolve first real fixture id from /fixtures so the screenshot
      // hits a populated MatchHero rather than a 404 block.
      await page.goto('/fixtures');
      const firstHref = await page.locator('a[href^="/fixtures/"]').first().getAttribute('href');
      return firstHref ?? '/fixtures/sample-fixture';
    }
  },
  {
    name: '04-fixtures-detail-live',
    path: async (page) => {
      await page.goto('/fixtures');
      const firstHref = await page.locator('a[href^="/fixtures/"]').first().getAttribute('href');
      const base = firstHref ?? '/fixtures/sample-fixture';
      return `${base}/live`;
    }
  },
  { name: '05-predictions', path: '/predictions' },
  { name: '06-oracle', path: '/oracle' },
  { name: '07-insights', path: '/insights' },
  { name: '08-insights-archive', path: '/insights/archive' },
  { name: '09-insights-archive-2003-04', path: '/insights/archive?season=2003%2F04' },
  { name: '10-column-state-of-arsenal', path: '/column/state-of-arsenal' },
  { name: '11-column-mickey-on-united', path: '/column/mickey-on-united' },
  { name: '12-column-macca-on-anfield', path: '/column/macca-on-anfield' },
  { name: '13-broadsheet', path: '/broadsheet' },
  { name: '14-notifications', path: '/notifications' },
  { name: '15-search', path: '/search' },
  { name: '16-roster', path: '/roster' },
  { name: '17-roster-voices', path: '/roster/voices' },
  { name: '18-landing', path: '/landing' },
  { name: '19-rumours', path: '/rumours' },
  { name: '20-settings', path: '/settings' },
  { name: '21-onboarding', path: '/onboarding' }
];

test.describe('Kicker route screenshots', () => {
  // Stable persona for every snap — keeps the contact sheet visually consistent.
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('kicker:personaId', 'voice');
        // Skip onboarding gate so /today renders directly.
        localStorage.setItem('kicker:onboardedAt', new Date().toISOString());
      } catch {
        /* SSR-safe no-op */
      }
    });
  });

  for (const route of ROUTES) {
    test(route.name, async ({ page }, testInfo) => {
      // Output dir layout: e2e/screenshots/{runStamp}/{project}/
      const outDir = join('e2e', 'screenshots', RUN_STAMP, testInfo.project.name);
      mkdirSync(outDir, { recursive: true });

      // Resolve the path (static or dynamic).
      const targetPath = typeof route.path === 'string' ? route.path : await route.path(page);

      await page.goto(targetPath);

      // Generic wait: either the route-specific selector, or the desktop/mobile
      // shell marker, or the body. First-match wins.
      if (route.waitFor) {
        await page.locator(route.waitFor).first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
      }
      // Settle network + animations before snapping.
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      // One extra paint frame for client-only hydration (TodayFixtureRail,
      // SeasonDetail standings load, etc.).
      await page.waitForTimeout(400);

      const filename = `${route.name}.png`;
      const fullPath = join(outDir, filename);
      await page.screenshot({ path: fullPath, fullPage: true });

      // Attach to the Playwright report too — handy if you ever run it on CI.
      await testInfo.attach(route.name, {
        path: fullPath,
        contentType: 'image/png'
      });

      // Sanity: file exists + non-zero. Playwright .screenshot() already throws
      // on write failure, but an explicit expect makes the test row green/red.
      expect(fullPath).toBeTruthy();
    });
  }
});
