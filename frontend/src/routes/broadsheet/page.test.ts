import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import BroadsheetPage from './+page.svelte';

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
});
