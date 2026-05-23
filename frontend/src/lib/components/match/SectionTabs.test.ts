import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SectionTabs from './SectionTabs.svelte';

const TABS = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'probabilities', label: 'Probabilities' },
  { id: 'form', label: 'Form' },
  { id: 'h2h', label: 'H2H' },
  { id: 'venue', label: 'Venue' },
] as const;

const noop = () => {};

describe('SectionTabs', () => {
  it('renders every tab with the canonical data attribute', () => {
    const { body } = render(SectionTabs, {
      props: { tabs: TABS, active: 'analysis', onSelect: noop },
    });
    for (const t of TABS) {
      expect(body).toContain(`data-section-tab="${t.id}"`);
      expect(body).toContain(t.label);
    }
  });

  it('marks only the active tab with aria-current and the is-active class', () => {
    const { body } = render(SectionTabs, {
      props: { tabs: TABS, active: 'form', onSelect: noop },
    });
    const active = body.match(/<button[^>]*data-section-tab="form"[^>]*>/)?.[0];
    expect(active).toBeTruthy();
    expect(active).toContain('aria-current="page"');
    expect(active).toMatch(/class="[^"]*\bis-active\b/);

    const inactive = body.match(/<button[^>]*data-section-tab="venue"[^>]*>/)?.[0];
    expect(inactive).toBeTruthy();
    expect(inactive).not.toContain('aria-current');
    expect(inactive).not.toMatch(/\bis-active\b/);
  });

  it('renders no betting copy', () => {
    const { body } = render(SectionTabs, {
      props: { tabs: TABS, active: 'analysis', onSelect: noop },
    });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
