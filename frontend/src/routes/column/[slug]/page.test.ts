import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ColumnPage from './+page.svelte';
import { listColumnSlugs } from '$lib/fixtures/columns';

const KNOWN_SLUG = 'state-of-arsenal';

describe('Column route — K1e-α (/column/[slug])', () => {
  it('renders without error for a known slug', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    expect(body).toBeTruthy();
    expect(body).toContain('data-column-article');
    expect(body).toContain(`data-column-slug="${KNOWN_SLUG}"`);
  });

  it('mounts both desktop and mobile shells', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-column-page-mobile');
  });

  it('marks "today" as active in the desktop KickerShell (column is a sub-route of Today)', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    const link = body.match(/<a\b[^>]*data-nav-id="today"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('marks "today" as active in the mobile bottom-nav', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    const link = body.match(/<a\b[^>]*data-nav-id="today"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('renders ColumnHero + drop-cap intro + PullQuote + body grid + Cheers Geoff (when present) once per shell', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    expect((body.match(/data-column-hero/g) ?? []).length).toBe(2);
    expect((body.match(/data-column-intro/g) ?? []).length).toBe(2);
    expect((body.match(/data-pull-quote/g) ?? []).length).toBe(2);
    expect((body.match(/data-column-body/g) ?? []).length).toBe(2);
    // state-of-arsenal ships a cheers block.
    expect((body.match(/data-column-cheers/g) ?? []).length).toBe(2);
  });

  it('drop-cap span is decorative (aria-hidden) and reveals first letter once to assistive tech via sr-only', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    expect(body).toContain('data-column-dropcap');
    const drop = body.match(/<span\b[^>]*data-column-dropcap[^>]*>/);
    expect(drop).not.toBeNull();
    expect(drop![0]).toContain('aria-hidden="true"');
    expect(body).toContain('sr-only');
  });

  it('renders the 404 fallback for an unknown slug', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: 'does-not-exist' } } });
    expect(body).toContain('data-column-missing');
    expect(body).toContain('Column not found');
    // Hero / pullquote / body markers absent.
    expect(body).not.toContain('data-column-hero');
    expect(body).not.toContain('data-pull-quote');
  });

  it('has no betting copy on a known column page', () => {
    const { body } = render(ColumnPage, { props: { data: { slug: KNOWN_SLUG } } });
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });

  it('onMount syncs personaStore to the column byline personaId (K2-fix.1)', () => {
    const src = readFileSync(
      fileURLToPath(new URL('./+page.svelte', import.meta.url)),
      'utf-8'
    );
    expect(src).toMatch(/import\s*\{\s*personaStore\s*\}\s*from\s*['"]\$lib\/stores\/persona['"]/);
    expect(src).toMatch(/import\s*\{\s*onMount\s*\}\s*from\s*['"]svelte['"]/);
    expect(src).toMatch(/onMount\(\(\)\s*=>\s*\{[\s\S]*personaStore\.set\(column\.byline\.personaId\)[\s\S]*\}\)/);
  });

  it('every fixture slug renders without throwing', () => {
    for (const slug of listColumnSlugs()) {
      const { body } = render(ColumnPage, { props: { data: { slug } } });
      expect(body).toContain('data-column-article');
    }
  });
});
