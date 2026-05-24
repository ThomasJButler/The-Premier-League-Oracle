import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ArchivePage from './+page.svelte';

describe('Insights archive route — K1d-β (33-season archive + persona verdict)', () => {
  it('renders without error', () => {
    const { body } = render(ArchivePage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells', () => {
    const { body } = render(ArchivePage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-archive-page-mobile');
  });

  it('marks insights as active in the desktop KickerShell', () => {
    const { body } = render(ArchivePage);
    const link = body.match(/<a\b[^>]*data-nav-id="insights"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('marks "more" as active in the mobile bottom-nav', () => {
    const { body } = render(ArchivePage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('SSRs 33 season rows per shell (66 total)', () => {
    const { body } = render(ArchivePage);
    expect((body.match(/data-season-row/g) ?? []).length).toBe(66);
  });

  it('defaults the active season to 2025/26 (most recent on file)', () => {
    const { body } = render(ArchivePage);
    // Svelte 5 SSR attribute order is not stable across `class` / `aria-*` /
    // `data-*`, so match the row open-tag substring then assert membership.
    const rowOpens = body.match(/<button\b[^>]*data-season="2025\/26"[^>]*>/g) ?? [];
    expect(rowOpens).toHaveLength(2);
    for (const open of rowOpens) {
      expect(open).toContain('aria-current="true"');
    }
  });

  it('renders a SeasonDetail panel per shell with the verdict empty-state', () => {
    const { body } = render(ArchivePage);
    expect((body.match(/data-season-detail(?![-\w])/g) ?? []).length).toBe(2);
    expect((body.match(/data-verdict-empty/g) ?? []).length).toBe(2);
    expect(body).toContain('No verdict on file');
  });

  it('exposes the archive footer pointing at the cache layer', () => {
    const { body } = render(ArchivePage);
    expect(body).toContain('data-archive-footer');
    expect(body).toContain('kicker:verdict:');
  });

  it('renders a Generate verdict CTA per shell when no verdict is cached', () => {
    const { body } = render(ArchivePage);
    expect((body.match(/data-verdict-generate/g) ?? []).length).toBe(2);
    expect(body).toContain('Generate verdict');
  });

  it('has no betting copy on the page', () => {
    const { body } = render(ArchivePage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
