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

  it('renders empty-state copy when no fixtures or settled rows are present', () => {
    const { body } = render(PredictionsPage);
    expect(body).toContain('data-picks-empty');
    expect(body).toContain('data-settled-empty');
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
