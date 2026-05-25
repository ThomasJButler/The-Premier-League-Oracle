import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RumoursPage from './+page.svelte';

describe('Rumours route — K1i', () => {
  it('renders without error', () => {
    const { body } = render(RumoursPage);
    expect(body).toBeTruthy();
  });

  it('renders both desktop and mobile shells with stable markers', () => {
    const { body } = render(RumoursPage);
    expect(body).toContain('data-desktop-shell');
    expect(body).toContain('data-mobile-shell');
    expect(body).toContain('data-rumours-page');
    expect(body).toContain('data-rumours-page-mobile');
  });

  it('marks "more" as active in the mobile bottom-nav (rumours nests under More)', () => {
    const { body } = render(RumoursPage);
    const link = body.match(/<a\b[^>]*data-nav-id="more"[^>]*>/);
    expect(link).not.toBeNull();
    expect(link![0]).toContain('aria-current="page"');
  });

  it('leaves no desktop nav anchor as active (rumours has no slot in KickerShell NavId)', () => {
    const { body } = render(RumoursPage);
    const desktopBlock = body.match(/data-desktop-shell[\s\S]*?<\/aside>/);
    expect(desktopBlock, 'expected to find the desktop sidebar block').not.toBeNull();
    expect(desktopBlock![0]).not.toContain('aria-current="page"');
  });

  it('renders the COMING SOON hero copy on desktop and a stub on mobile', () => {
    const { body } = render(RumoursPage);
    expect((body.match(/COMING SOON · JUNE 2026/g) ?? []).length).toBe(2);
    expect(body).toContain('data-rumours-hero');
    expect(body).toContain('data-rumours-mobile-stub');
  });

  it('renders all 6 rumour rows with HeatBar + LockedColumn primitives (desktop teaser only)', () => {
    const { body } = render(RumoursPage);
    expect((body.match(/data-rumour-row(?![-\w])/g) ?? []).length).toBe(6);
    expect((body.match(/data-heat-bar(?![-\w])/g) ?? []).length).toBe(6);
    expect((body.match(/data-locked-column(?![-\w])/g) ?? []).length).toBe(6);
    expect(body).toContain('PROBABILITY SCORES UNLOCK JUNE 9');
  });

  it('renders the Cheers Geoff footer callout under the rumour list', () => {
    const { body } = render(RumoursPage);
    expect(body).toContain('data-rumours-footer');
    expect(body).toContain('£2.1bn');
    expect(body).toContain('SPENT LAST WINDOW');
  });

  it('has no betting copy', () => {
    const { body } = render(RumoursPage);
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
