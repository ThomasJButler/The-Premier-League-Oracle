import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TodayPage from './+page.svelte';

// The body snippet is rendered once per shell (desktop + mobile), so all counts are x2.

describe('Today route', () => {
  it('renders without error', () => {
    const { body } = render(TodayPage);
    expect(body).toBeTruthy();
  });

  it('renders data-kpi-strip with 4 KpiTile elements per shell (8 total)', () => {
    const { body } = render(TodayPage);
    expect(body).toContain('data-kpi-strip');
    const tileCount = (body.match(/data-kpi-tile/g) ?? []).length;
    // 4 tiles * 2 shells = 8
    expect(tileCount).toBe(8);
  });

  it('renders KPI tile labels in canonical order', () => {
    const { body } = render(TodayPage);
    const labels = ['NEXT KICKOFF', 'MODEL ACCURACY', 'MODEL EDGE', 'STREAK'];
    const positions = labels.map((l) => body.indexOf(l));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it('MODEL EDGE and STREAK tiles carry accent, NEXT KICKOFF and MODEL ACCURACY do not', () => {
    const { body } = render(TodayPage);
    // 2 accent tiles * 2 shells = 4 each
    const accentTrue = (body.match(/data-kpi-accent="true"/g) ?? []).length;
    const accentFalse = (body.match(/data-kpi-accent="false"/g) ?? []).length;
    expect(accentTrue).toBe(4);
    expect(accentFalse).toBe(4);
  });

  it('KPI strip lays out as a 2x2 grid on mobile (no horizontal scroll)', () => {
    const { body } = render(TodayPage);
    const strip = body.match(/<div[^>]*data-kpi-strip[^>]*>/);
    expect(strip).not.toBeNull();
    expect(strip![0]).toContain('grid-cols-2');
    // Regression pin: must not revert to the cropped horizontal-scroll strip.
    expect(strip![0]).not.toContain('overflow-x-auto');
    expect(strip![0]).not.toContain('snap-x');
  });

  it('KPI strip upgrades to lg:grid-cols-4 on large screens', () => {
    const { body } = render(TodayPage);
    const strip = body.match(/<div[^>]*data-kpi-strip[^>]*>/);
    expect(strip![0]).toContain('lg:grid-cols-4');
  });

  it('renders no betting copy strings', () => {
    const { body } = render(TodayPage);
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly criterion/i);
  });

  it('renders fallback CheersGeoffCallout when cheers state is null', () => {
    const { body } = render(TodayPage);
    expect(body).toContain('data-cheers-callout');
    expect(body).toContain('CHEERS, GEOFF');
  });

  it('renders both desktop-shell and mobile-shell wrappers in the markup', () => {
    const { body } = render(TodayPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
  });

  it('renders a [Predict GW] button per shell, disabled in the empty-SSR state', () => {
    const { body } = render(TodayPage);
    const buttons = body.match(/<button[^>]*data-predict-gw[^>]*>/g) ?? [];
    // 1 button per shell * 2 shells = 2
    expect(buttons.length).toBe(2);
    for (const btn of buttons) {
      expect(btn).toContain('data-predict-gw-disabled="true"');
      expect(btn).toContain('aria-disabled="true"');
      expect(btn).toContain('disabled');
    }
    // No betting copy in the chip label
    expect(body).not.toMatch(/\bbet\b/i);
    expect(body).not.toMatch(/odds/i);
  });

  it('Predict GW button shows AWAITING SCHEDULE copy in null-GW SSR state, not a bare "Predict GW"', () => {
    const { body } = render(TodayPage);
    // Null-GW state (SSR) must surface the scheduled-fallback label, once per shell.
    // The GeoffTicker's honest neutral tape also carries AWAITING SCHEDULE (doubled
    // for the marquee loop), so strip the ticker run before counting page content.
    const pageBody = body.replace(/<span class="kicker-ticker__run[^"]*">[\s\S]*?<\/span>/g, '');
    const awaitingMatches = pageBody.match(/AWAITING SCHEDULE/g) ?? [];
    expect(awaitingMatches.length).toBe(2);
    // Regression pin: the previous bare "Predict GW" (no number, no fallback context) must not reappear.
    expect(body).not.toMatch(/>\s*Predict GW\s*</);
  });

  it('marks today as the active nav link in the desktop KickerShell', () => {
    const { body } = render(TodayPage);
    const todayLink = body.match(/<a[^>]*data-nav-id="today"[^>]*>/);
    expect(todayLink).not.toBeNull();
    expect(todayLink![0]).toContain('aria-current="page"');
  });
});
