import { test, expect, type Page } from '@playwright/test';

/**
 * K1.0 cutover checkpoint — gates the live deployment swap from v3 → The Kicker.
 *
 * Runs on `desktop-chrome` (≥1024px → KickerShell) and `mobile-chrome` (<1024px →
 * MobileHeader + MobileNav). The mobile project additionally verifies the 5-tab
 * bottom-nav order (today / fixtures / predictions / oracle / more) with NO
 * `betting` tab.
 *
 * Each route asserts no betting copy renders (regex: /value bets|bankroll|kelly/i).
 *
 * Spec is structural-only — no Football-Data backing required. Asserts on
 * SSR-rendered shell + always-present empty-state / strip markers.
 */

const BETTING_COPY = /value bets|bankroll|kelly/i;

const NO_BETTING_COPY = async (page: Page): Promise<void> => {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(BETTING_COPY);
};

const isMobile = (projectName: string): boolean => projectName === 'mobile-chrome';

const assertMobileBottomNav = async (page: Page): Promise<void> => {
  const nav = page.locator('[data-mobile-nav]');
  await expect(nav).toBeVisible();
  const tabs = nav.locator('a[data-nav-id]');
  await expect(tabs).toHaveCount(5);
  await expect(tabs.nth(0)).toHaveAttribute('data-nav-id', 'today');
  await expect(tabs.nth(1)).toHaveAttribute('data-nav-id', 'fixtures');
  await expect(tabs.nth(2)).toHaveAttribute('data-nav-id', 'predictions');
  await expect(tabs.nth(3)).toHaveAttribute('data-nav-id', 'oracle');
  await expect(tabs.nth(4)).toHaveAttribute('data-nav-id', 'more');
  await expect(nav.locator('[data-nav-id="betting"]')).toHaveCount(0);
};

/**
 * Both mobile + desktop shells co-exist in the SSR DOM with Tailwind's
 * `lg:hidden` / `hidden lg:block` toggling visibility. `:visible` scopes
 * locators to the shell that actually renders for the active viewport.
 */
const visible = (selector: string): string => `${selector}:visible`;

test.describe('K1.0 cutover checkpoint', () => {
  test('/today renders KickerShell + 4 KPI tiles', async ({ page }, testInfo) => {
    await page.goto('/today');
    await expect(page.locator(visible('[data-kpi-strip]'))).toBeVisible();
    await expect(page.locator(visible('[data-kpi-tile]'))).toHaveCount(4);
    if (isMobile(testInfo.project.name)) await assertMobileBottomNav(page);
    await NO_BETTING_COPY(page);
  });

  test('/fixtures renders filter chips + match list scaffold', async ({ page }, testInfo) => {
    await page.goto('/fixtures');
    await expect(page.locator(visible('[data-filter-bar]'))).toBeVisible();
    for (const chip of ['all', 'top6', 'relegation', 'tv']) {
      await expect(page.locator(visible(`[data-filter-chip="${chip}"]`))).toBeVisible();
    }
    // Either a populated match list or the empty-state copy renders.
    const populated = await page.locator(visible('[data-match-list]')).count();
    const empty = await page.locator(visible('[data-fixtures-empty]')).count();
    expect(populated + empty).toBeGreaterThan(0);
    if (isMobile(testInfo.project.name)) await assertMobileBottomNav(page);
    await NO_BETTING_COPY(page);
  });

  test('/predictions renders KPI strip + picks + settled scaffolds', async ({ page }, testInfo) => {
    await page.goto('/predictions');
    await expect(page.locator(visible('[data-kpi-strip]'))).toBeVisible();
    const picks =
      (await page.locator(visible('[data-picks-grid]')).count()) +
      (await page.locator(visible('[data-picks-empty]')).count());
    expect(picks).toBeGreaterThan(0);
    const settled =
      (await page.locator(visible('[data-settled-log]')).count()) +
      (await page.locator(visible('[data-settled-empty]')).count());
    expect(settled).toBeGreaterThan(0);
    if (isMobile(testInfo.project.name)) await assertMobileBottomNav(page);
    await NO_BETTING_COPY(page);
  });

  test('/settings renders 6 sub-nav rows + 10 pundit cards + API key inputs', async ({
    page
  }, testInfo) => {
    await page.goto('/settings');
    for (const id of ['pundit', 'api', 'display', 'account', 'notifications', 'privacy']) {
      await expect(page.locator(visible(`[data-subnav-id="${id}"]`))).toBeVisible();
    }
    // Default tab is `pundit` → 10 PunditPickerCard buttons render in `data-pundit-grid`.
    const grid = page.locator(visible('[data-pundit-grid]'));
    await expect(grid).toBeVisible();
    await expect(grid.locator('[data-picker-id]')).toHaveCount(10);
    // Switch to API tab and confirm the persisted-key save buttons render.
    await page.locator(visible('[data-subnav-id="api"]')).click();
    await expect(page.locator(visible('[data-action="save-football-data"]'))).toBeVisible();
    await expect(page.locator(visible('[data-action="save-anthropic"]'))).toBeVisible();
    if (isMobile(testInfo.project.name)) await assertMobileBottomNav(page);
    await NO_BETTING_COPY(page);
  });

  test('/onboarding renders the 3-step flow scaffold', async ({ page }) => {
    await page.goto('/onboarding');
    const root = page.locator('[data-onboard-current-step]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-onboard-current-step', '0');
    // Onboarding deliberately omits the global shell — no MobileNav assertion here.
    await NO_BETTING_COPY(page);
  });
});
