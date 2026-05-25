import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  DEFAULT_TIER,
  STORAGE_KEY,
  TIERS,
  entitlementsStore,
  hasAccess,
  isTier
} from './entitlementsStore';

describe('entitlementsStore', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    entitlementsStore.reset();
  });

  it('defaults to touchline tier', () => {
    expect(get(entitlementsStore)).toBe(DEFAULT_TIER);
    expect(DEFAULT_TIER).toBe('touchline');
  });

  it('set persists the tier to the documented localStorage key', () => {
    entitlementsStore.set('press-box');
    expect(get(entitlementsStore)).toBe('press-box');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('press-box');
  });

  it('rejects unknown tier strings (no-op)', () => {
    entitlementsStore.set('press-box');
    // @ts-expect-error — exercising invalid input
    entitlementsStore.set('vip-lounge');
    expect(get(entitlementsStore)).toBe('press-box');
  });

  it('reset returns to touchline', () => {
    entitlementsStore.set('print-run');
    entitlementsStore.reset();
    expect(get(entitlementsStore)).toBe('touchline');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('touchline');
  });

  it('isTier validates the three known tiers and rejects anything else', () => {
    expect(isTier('touchline')).toBe(true);
    expect(isTier('press-box')).toBe(true);
    expect(isTier('print-run')).toBe(true);
    expect(isTier('founder')).toBe(false);
    expect(isTier(null)).toBe(false);
    expect(isTier(undefined)).toBe(false);
  });

  it('TIERS exposes 3 specs in ascending order with non-empty perks + price lines', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['touchline', 'press-box', 'print-run']);
    for (const tier of TIERS) {
      expect(tier.label.length).toBeGreaterThan(0);
      expect(tier.priceLine.length).toBeGreaterThan(0);
      expect(tier.perks.length).toBeGreaterThan(0);
    }
  });
});

describe('hasAccess gate logic', () => {
  it('touchline only sees touchline', () => {
    expect(hasAccess('touchline', 'touchline')).toBe(true);
    expect(hasAccess('touchline', 'press-box')).toBe(false);
    expect(hasAccess('touchline', 'print-run')).toBe(false);
  });

  it('press-box sees touchline + press-box only', () => {
    expect(hasAccess('press-box', 'touchline')).toBe(true);
    expect(hasAccess('press-box', 'press-box')).toBe(true);
    expect(hasAccess('press-box', 'print-run')).toBe(false);
  });

  it('print-run sees everything', () => {
    expect(hasAccess('print-run', 'touchline')).toBe(true);
    expect(hasAccess('print-run', 'press-box')).toBe(true);
    expect(hasAccess('print-run', 'print-run')).toBe(true);
  });

  it('contains no betting copy in tier specs', () => {
    const allText = JSON.stringify(TIERS);
    expect(allText).not.toMatch(/value bet/i);
    expect(allText).not.toMatch(/bankroll/i);
    expect(allText).not.toMatch(/kelly/i);
  });
});
