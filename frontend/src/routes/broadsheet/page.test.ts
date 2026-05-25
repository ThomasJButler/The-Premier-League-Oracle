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

  it('SSRs the "no gameweek on file" empty state by default (no cache + no client gw resolution)', () => {
    const { body } = render(BroadsheetPage);
    // The route's SSR-default (no initialGameweek prop, no client onMount) is
    // gameweek === null → no-gw hint per shell.
    expect((body.match(/data-broadsheet-no-gw/g) ?? []).length).toBe(2);
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
