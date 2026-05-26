import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PredictionsPage from './+page.svelte';

// Body snippet renders once per shell (desktop + mobile), so KPI / row counts double.

describe('Predictions route', () => {
  it('renders without error', () => {
    const { body } = render(PredictionsPage);
    expect(body).toBeTruthy();
  });

  it('renders 4 KpiTile elements per shell (8 total) inside data-kpi-strip', () => {
    const { body } = render(PredictionsPage);
    expect(body).toContain('data-kpi-strip');
    const tileCount = (body.match(/data-kpi-tile/g) ?? []).length;
    expect(tileCount).toBe(8);
  });

  it('renders KPI tile labels in canonical order', () => {
    const { body } = render(PredictionsPage);
    const labels = ['MODEL ACCURACY', 'BRIER SCORE', 'CALIBRATION INDEX', 'MODEL EDGE'];
    const positions = labels.map((l) => body.indexOf(l));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it('only MODEL EDGE tile carries accent (1 per shell, 2 total)', () => {
    const { body } = render(PredictionsPage);
    const accentTrue = (body.match(/data-kpi-accent="true"/g) ?? []).length;
    const accentFalse = (body.match(/data-kpi-accent="false"/g) ?? []).length;
    expect(accentTrue).toBe(2);
    expect(accentFalse).toBe(6);
  });

  it('KPI strip has overflow-x-auto and snap-x classes for mobile horizontal scroll', () => {
    const { body } = render(PredictionsPage);
    const strip = body.match(/<div[^>]*data-kpi-strip[^>]*>/);
    expect(strip).not.toBeNull();
    expect(strip![0]).toContain('overflow-x-auto');
    expect(strip![0]).toContain('snap-x');
  });

  it('KPI strip upgrades to lg:grid-cols-4 on large screens', () => {
    const { body } = render(PredictionsPage);
    const strip = body.match(/<div[^>]*data-kpi-strip[^>]*>/);
    expect(strip![0]).toContain('lg:grid-cols-4');
  });

  it('mounts KpiSnapDots wrapped in lg:hidden, with 4 dots per shell (8 total)', () => {
    const { body } = render(PredictionsPage);
    const wrappers = body.match(/<div[^>]*data-kpi-dots-wrapper[^>]*>/g) ?? [];
    expect(wrappers.length).toBe(2);
    expect(wrappers[0]).toContain('lg:hidden');
    const dotCount = (body.match(/data-kpi-dot=/g) ?? []).length;
    expect(dotCount).toBe(8);
  });

  it('dots default to the first one being active before any scroll happens', () => {
    const { body } = render(PredictionsPage);
    const active = (body.match(/data-kpi-dot-active="true"/g) ?? []).length;
    const inactive = (body.match(/data-kpi-dot-active="false"/g) ?? []).length;
    expect(active).toBe(2);
    expect(inactive).toBe(6);
  });

  it('renders THIS WEEK\'S PICKS and SETTLED RESULTS rule headings', () => {
    const { body } = render(PredictionsPage);
    expect(body).toContain("THIS WEEK'S PICKS");
    expect(body).toContain('SETTLED RESULTS');
  });

  it('falls back to AWAITING SCHEDULE in the GW eyebrow when no gameweek is on file (K2-fix.6)', () => {
    const { body } = render(PredictionsPage);
    const kickers = body.match(/<p[^>]*data-rule-kicker[^>]*>([\s\S]*?)<\/p>/g) ?? [];
    expect(kickers.length).toBeGreaterThan(0);
    const picksKicker = kickers.find((k) => /AWAITING SCHEDULE/.test(k));
    expect(picksKicker).toBeTruthy();
    expect(picksKicker).not.toMatch(/>\s*GW\s*<\/p>/);
  });

  it('renders empty-state markers when no fixtures or settled rows are present', () => {
    const { body } = render(PredictionsPage);
    expect(body).toContain('data-picks-empty');
    expect(body).toContain('data-settled-empty');
  });

  it('renders demo picks under a "Sample picks · demo data" eyebrow chip in the empty state (K2-fix.8.1)', () => {
    const { body } = render(PredictionsPage);
    // Dual-shell convention: chip + grid render once per shell.
    const chips = (body.match(/data-picks-demo-chip(?=[\s>=])/g) ?? []).length;
    expect(chips).toBe(2);
    expect(body).toContain('Sample picks · demo data');
    const grids = (body.match(/data-picks-demo-grid(?=[\s>=])/g) ?? []).length;
    expect(grids).toBe(2);
  });

  it('demo picks render with at least 6 PredictionPickRow elements per shell (12 total)', () => {
    const { body } = render(PredictionsPage);
    // PredictionPickRow has both a mobile and desktop template gated by `lg:hidden`
    // / `hidden lg:grid` (K2a-β.1) — each row emits 2 `data-prediction-layout`
    // markers. 6 demo picks × 2 layouts × 2 shells = 24 layout markers.
    const layouts = (body.match(/data-prediction-layout=/g) ?? []).length;
    expect(layouts).toBeGreaterThanOrEqual(24);
  });

  it('renders no stale persona-empty-state line when demo picks are showing', () => {
    const { body } = render(PredictionsPage);
    // K2-fix.12 line was a single italic paragraph; K2-fix.8.1 replaces it with
    // the demo-pick grid. Anchor on the unique `getEmptyStateCopy('predictions', …)`
    // 'voice' default copy fragment so a future revert is caught.
    expect(body).not.toContain('Nothing to call this week — picks resume next gameweek.');
  });

  it('renders no betting / Kelly / bankroll copy', () => {
    const { body } = render(PredictionsPage);
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });

  it('renders both desktop-shell and mobile-shell wrappers', () => {
    const { body } = render(PredictionsPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
  });

  it('marks predictions as the active nav link in the desktop KickerShell', () => {
    const { body } = render(PredictionsPage);
    const link = body.match(/<a[^>]*data-nav-id="predictions"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('marks predictions as active in both desktop and mobile nav (2 links)', () => {
    const { body } = render(PredictionsPage);
    const links = body.match(/<a[^>]*data-nav-id="predictions"[^>]*aria-current="page"[^>]*>|<a[^>]*aria-current="page"[^>]*data-nav-id="predictions"[^>]*>/g) ?? [];
    expect(links.length).toBe(2);
  });
});
