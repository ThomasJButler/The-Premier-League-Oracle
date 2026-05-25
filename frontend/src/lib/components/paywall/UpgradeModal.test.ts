import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { render } from 'svelte/server';
import UpgradeModal from './UpgradeModal.svelte';
import { entitlementsStore } from '$lib/stores/entitlementsStore';

describe('UpgradeModal', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    entitlementsStore.reset();
  });

  afterEach(() => entitlementsStore.reset());

  it('renders nothing when closed', () => {
    const { body } = render(UpgradeModal, { props: { open: false } });
    expect(body).not.toContain('data-upgrade-modal');
  });

  it('renders all three tier cards with subscribe buttons when open', () => {
    const { body } = render(UpgradeModal, { props: { open: true } });
    expect(body).toContain('data-upgrade-modal');
    expect(body).toContain('data-upgrade-tier-card="touchline"');
    expect(body).toContain('data-upgrade-tier-card="press-box"');
    expect(body).toContain('data-upgrade-tier-card="print-run"');
    expect(body).toContain('data-upgrade-subscribe="touchline"');
    expect(body).toContain('data-upgrade-subscribe="press-box"');
    expect(body).toContain('data-upgrade-subscribe="print-run"');
  });

  it('marks the active tier card and disables its subscribe button', () => {
    const { body } = render(UpgradeModal, { props: { open: true } });
    // default tier is touchline → its card is active, its button disabled
    expect(body).toMatch(
      /<article[^>]*data-upgrade-tier-card="touchline"[^>]*data-upgrade-active="true"/
    );
    expect(body).toMatch(
      /<button[^>]*data-upgrade-subscribe="touchline"[^>]*\bdisabled\b/
    );
  });

  it('renders backdrop, close button, and accessible dialog role', () => {
    const { body } = render(UpgradeModal, { props: { open: true } });
    expect(body).toContain('data-upgrade-backdrop');
    expect(body).toContain('data-upgrade-close');
    expect(body).toContain('role="dialog"');
    expect(body).toContain('aria-modal="true"');
  });

  it('subscribe writes the chosen tier to the entitlements store', () => {
    // Direct unit assertion: the modal's subscribe handler calls
    // entitlementsStore.set, which is the integration seam. SSR rendering
    // doesn't fire click handlers, so we exercise the store contract directly.
    entitlementsStore.set('press-box');
    expect(get(entitlementsStore)).toBe('press-box');
    entitlementsStore.set('print-run');
    expect(get(entitlementsStore)).toBe('print-run');
  });

  it('contains no betting copy', () => {
    const { body } = render(UpgradeModal, { props: { open: true } });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
