import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MobileNav from './MobileNav.svelte';

const TAB_IDS = ['today', 'fixtures', 'predictions', 'oracle', 'more'] as const;

describe('MobileNav', () => {
  it('renders exactly 5 tabs in the canonical order (no betting)', () => {
    const { body } = render(MobileNav);
    const positions = TAB_IDS.map((id) => body.indexOf(`data-nav-id="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);

    const allNavMatches = body.match(/data-nav-id="[a-z]+"/g) ?? [];
    expect(allNavMatches.length).toBe(5);
  });

  it('never renders a betting tab', () => {
    const { body } = render(MobileNav);
    expect(body).not.toContain('data-nav-id="betting"');
    expect(body).not.toMatch(/>\s*Betting\s*</i);
  });

  it('marks the active tab with aria-current and an active dot', () => {
    const { body } = render(MobileNav, { props: { active: 'predictions' } });
    const tag = body.match(/<a\b[^>]*data-nav-id="predictions"[^>]*>/);
    expect(tag, 'expected an anchor with data-nav-id="predictions"').not.toBeNull();
    expect(tag![0]).toContain('aria-current="page"');
    expect(tag![0]).toContain('active-tab');
    const otherCurrents = body.match(/aria-current="page"/g) ?? [];
    expect(otherCurrents.length).toBe(1);
  });

  it('omits aria-current when no active tab is supplied', () => {
    const { body } = render(MobileNav);
    expect(body).not.toContain('aria-current="page"');
    expect(body).not.toContain('active-tab');
  });
});
