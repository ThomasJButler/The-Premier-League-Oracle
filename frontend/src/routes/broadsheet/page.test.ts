import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';
import BroadsheetPage from './+page.svelte';

const pageSource = readFileSync(
  fileURLToPath(new URL('./+page.svelte', import.meta.url)),
  'utf8'
);

describe('Broadsheet route — K1e-β (/broadsheet)', () => {
  it('renders without error in its SSR-default empty state', () => {
    const { body } = render(BroadsheetPage);
    expect(body).toBeTruthy();
    expect(body).toContain('data-broadsheet');
  });

  it('mounts both desktop and mobile shells', () => {
    const { body } = render(BroadsheetPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-broadsheet-page-mobile');
  });

  it('marks "today" as active in both shells (broadsheet nests under Today)', () => {
    const { body } = render(BroadsheetPage);
    const links = body.match(/<a\b[^>]*data-nav-id="today"[^>]*>/g);
    expect(links).not.toBeNull();
    // Both the desktop KickerShell nav AND the mobile bottom-nav render a
    // "today" anchor; both must carry aria-current="page".
    const active = links!.filter((tag) => tag.includes('aria-current="page"'));
    expect(active.length).toBe(2);
  });

  it('SSRs the demo broadsheet in the no-gameweek state (K2-fix.8 — replaces the persona-voiced one-liner so the no-API-key preview never reads as empty)', () => {
    const { body } = render(BroadsheetPage);
    // The route's SSR-default (no initialGameweek prop, no client onMount) is
    // gameweek === null → demo broadsheet per shell. Keep the data-broadsheet-no-gw
    // wrapper marker so any future "is this the no-API-key state?" probe still works.
    expect((body.match(/data-broadsheet-no-gw/g) ?? []).length).toBe(2);
    expect((body.match(/data-broadsheet-demo(?=[\s>=])/g) ?? []).length).toBe(2);
    // Live-broadsheet markers stay distinct from demo markers so downstream tests
    // can disambiguate "real loaded broadsheet" from "demo placeholder".
    expect(body).not.toContain('data-broadsheet-headline');
    expect(body).not.toContain('data-broadsheet-empty');
  });

  it('SSRs the per-gameweek empty-state with Generate CTA when initialGameweek is provided', () => {
    const { body } = render(BroadsheetPage, { props: { data: { initialGameweek: 34 } } });
    expect((body.match(/data-broadsheet-empty/g) ?? []).length).toBe(2);
    expect((body.match(/data-broadsheet-generate/g) ?? []).length).toBe(2);
    expect(body).toContain('Generate the GW34 broadsheet');
    expect(body).not.toContain('data-broadsheet-headline');
  });

  it('shows the GAMEWEEK kicker in the Rule header when a gameweek is known', () => {
    const { body } = render(BroadsheetPage, { props: { data: { initialGameweek: 34 } } });
    expect(body).toContain('GAMEWEEK 34 · BROADSHEET');
  });

  it('has no betting copy in any state', () => {
    const empty = render(BroadsheetPage);
    expect(empty.body).not.toMatch(/value bet|bankroll|kelly/i);
    const gw = render(BroadsheetPage, { props: { data: { initialGameweek: 34 } } });
    expect(gw.body).not.toMatch(/value bet|bankroll|kelly/i);
  });

  describe('K2-fix.8 — demo broadsheet for no-API-key state', () => {
    it('renders the "Sample broadsheet · demo data" eyebrow chip in both shells', () => {
      const { body } = render(BroadsheetPage);
      expect((body.match(/data-broadsheet-demo-chip/g) ?? []).length).toBe(2);
      expect(body).toContain('Sample broadsheet');
      expect(body).toContain('demo data');
    });

    it('renders the demo headline, standfirst, byline and all three demo sections in both shells', () => {
      const { body } = render(BroadsheetPage);
      expect((body.match(/data-broadsheet-demo-headline/g) ?? []).length).toBe(2);
      expect((body.match(/data-broadsheet-demo-standfirst/g) ?? []).length).toBe(2);
      expect((body.match(/data-broadsheet-demo-byline/g) ?? []).length).toBe(2);
      // Three sections × two shells = six section blocks rendered server-side.
      expect((body.match(/data-broadsheet-demo-section(?=[\s>=])/g) ?? []).length).toBe(6);
      expect(body).toContain('THE KICKER STAFF · SAMPLE EDITION');
    });

    it('demo broadsheet carries no betting copy (parody-safe, K2c-α legal posture)', () => {
      const { body } = render(BroadsheetPage);
      expect(body).not.toMatch(/value bet|bankroll|kelly|stake|accumulator/i);
    });
  });

  describe('T7 — "Read as column" deep link into the column reader', () => {
    it('does NOT render the column link in any SSR-reachable state (demo / empty)', () => {
      // The link lives inside the loaded-broadsheet branch, which is unreachable
      // in SSR (the cache is read in onMount), so it must be absent server-side.
      const demo = render(BroadsheetPage);
      expect(demo.body).not.toContain('data-broadsheet-column-link');
      const empty = render(BroadsheetPage, { props: { data: { initialGameweek: 34 } } });
      expect(empty.body).not.toContain('data-broadsheet-column-link');
    });

    it('source: the link appears only inside the loaded-broadsheet branch, href built via buildColumnSlug, in both shells', () => {
      expect(pageSource).toMatch(
        /import\s*\{\s*buildColumnSlug\s*\}\s*from\s*['"]\$lib\/broadsheet\/broadsheetColumn['"]/
      );
      expect(pageSource).toMatch(/columnHref\s*=\s*\$derived\([\s\S]*buildColumnSlug\(gameweek,\s*personaId\)/);
      // One link per shell (desktop body + mobile mobileBody).
      expect((pageSource.match(/data-broadsheet-column-link/g) ?? []).length).toBe(2);
      // Each link is guarded by {#if columnHref} and reads the derived href.
      expect((pageSource.match(/href=\{columnHref\}/g) ?? []).length).toBe(2);
    });
  });

  describe('K2a-γ — mobile vertical-stack grammar', () => {
    it('only the mobile shell carries the data-broadsheet-mobile wrapper', () => {
      const { body } = render(BroadsheetPage, { props: { data: { initialGameweek: 34 } } });
      // data-broadsheet remains 2x (one per shell, dual-render convention)
      expect((body.match(/data-broadsheet="?/g) ?? []).length).toBe(2);
      // data-broadsheet-mobile only in the mobile snippet
      expect((body.match(/data-broadsheet-mobile/g) ?? []).length).toBe(1);
    });

    it('mobile generate CTA is full-width (w-full) on mobile but not in desktop snippet', () => {
      const { body } = render(BroadsheetPage, { props: { data: { initialGameweek: 34 } } });
      const mobileGenerate = body.match(
        /<button\b[^>]*data-broadsheet-generate[^>]*>/g
      );
      expect(mobileGenerate).not.toBeNull();
      // Exactly one of the two Generate buttons is the full-width mobile variant
      const fullWidthCount = mobileGenerate!.filter((tag) => tag.includes('w-full')).length;
      expect(fullWidthCount).toBe(1);
    });

    it('mobile snippet teaches the vertical-stack grammar: dropcap + HOT TAKE callout + section breaks + dual body wrapper', () => {
      // Loaded-broadsheet state is unreachable in SSR (cache reads run in onMount).
      // Pin the mobile grammar against the source so a refactor cannot silently
      // collapse the mobileBody snippet back to the shared body() pattern.
      expect(pageSource).toContain('data-broadsheet-dropcap');
      expect(pageSource).toContain('kicker-broadsheet__dropcap-mobile');
      expect(pageSource).toContain('data-broadsheet-hot-take');
      expect(pageSource).toContain('data-broadsheet-hot-take-label');
      expect(pageSource).toContain('HOT TAKE');
      expect(pageSource).toContain('data-broadsheet-section-break');
      expect(pageSource).toContain('data-broadsheet-body-mobile');
      expect(pageSource).toContain('data-broadsheet-card-mobile');
      expect(pageSource).toContain('kicker-broadsheet__headline-mobile');
      expect(pageSource).toContain('kicker-broadsheet__hot-take-mobile');
    });

    it('mobile snippet routes through the mobileBody, not body(), in the mobile shell', () => {
      expect(pageSource).toMatch(/data-mobile-body[^>]*>\s*\{@render mobileBody\(\)\}/);
      expect(pageSource).toMatch(/px-8 py-6">\s*\{@render body\(\)\}/);
    });

    it('mobile dropcap, hot-take border, and headline-mobile sizes are persona-accent-aware where appropriate', () => {
      // dropcap should inherit persona accent so each voice colours the lead letter
      expect(pageSource).toMatch(/kicker-broadsheet__dropcap-mobile\s*\{[^}]*color:\s*var\(--persona-accent/);
      // hot-take border should fall back to ink but accept persona override
      expect(pageSource).toMatch(/kicker-broadsheet__hot-take-mobile\s*\{[^}]*border-color:\s*var\(--persona-accent/);
    });
  });
});
