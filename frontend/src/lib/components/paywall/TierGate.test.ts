import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TierGate from './TierGate.svelte';
import TierGateHarness from './TierGate.test.harness.svelte';
import { entitlementsStore } from '$lib/stores/entitlementsStore';

describe('TierGate', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    entitlementsStore.reset();
  });
  afterEach(() => entitlementsStore.reset());

  it('renders allowed children when active tier meets the requirement', () => {
    entitlementsStore.set('press-box');
    const { body } = render(TierGateHarness, {
      props: { required: 'press-box', allowedText: 'PERMIT', lockedText: 'DENY' }
    });
    expect(body).toContain('data-tier-gate-state="allowed"');
    expect(body).toContain('PERMIT');
    expect(body).not.toContain('DENY');
  });

  it('renders the locked snippet when the active tier is below requirement', () => {
    entitlementsStore.reset(); // touchline
    const { body } = render(TierGateHarness, {
      props: { required: 'press-box', allowedText: 'PERMIT', lockedText: 'DENY' }
    });
    expect(body).toContain('data-tier-gate-state="locked"');
    expect(body).toContain('DENY');
    expect(body).not.toContain('PERMIT');
  });

  it('print-run requirement remains locked for press-box tier', () => {
    entitlementsStore.set('press-box');
    const { body } = render(TierGateHarness, {
      props: { required: 'print-run', allowedText: 'PERMIT', lockedText: 'DENY' }
    });
    expect(body).toContain('data-tier-gate-state="locked"');
  });

  it('print-run tier unlocks everything', () => {
    entitlementsStore.set('print-run');
    const { body } = render(TierGateHarness, {
      props: { required: 'print-run', allowedText: 'PERMIT', lockedText: 'DENY' }
    });
    expect(body).toContain('data-tier-gate-state="allowed"');
    expect(body).toContain('PERMIT');
  });

  it('imports cleanly (smoke check on the component module)', () => {
    expect(TierGate).toBeTruthy();
  });
});
