// Mock entitlements store for K2c-α.
//
// 3-tier model: touchline (free, default) < press-box (£4/mo) < print-run (£20/mo).
// Persisted to `kicker:tier` so refresh survives — mirrors how real Stripe-backed
// entitlements behave once K2c proper lands. SSR-guarded.

import { writable, type Writable } from 'svelte/store';

export type Tier = 'touchline' | 'press-box' | 'print-run';

export const STORAGE_KEY = 'kicker:tier';
export const DEFAULT_TIER: Tier = 'touchline';

const VALID_TIERS: ReadonlySet<Tier> = new Set(['touchline', 'press-box', 'print-run']);

const TIER_RANK: Record<Tier, number> = {
  touchline: 0,
  'press-box': 1,
  'print-run': 2
};

export interface TierSpec {
  id: Tier;
  label: string;
  priceLine: string;
  tagline: string;
  perks: readonly string[];
}

export const TIERS: readonly TierSpec[] = [
  {
    id: 'touchline',
    label: 'Touchline',
    priceLine: 'Free',
    tagline: 'The Voice writes your paper.',
    perks: [
      'The Voice persona only',
      'Daily Today + Fixtures',
      'Live predictions + match analysis',
      'Insights + 33-season archive'
    ]
  },
  {
    id: 'press-box',
    label: 'Press Box',
    priceLine: '£4 / month',
    tagline: 'All 10 pundits. Audio columns. Search.',
    perks: [
      'All 10 personas unlocked',
      'Persona-voiced audio columns',
      'Full search + notifications',
      'Sunday broadsheet generation'
    ]
  },
  {
    id: 'print-run',
    label: 'Print Run',
    priceLine: '£20 / month',
    tagline: 'A physical broadsheet posted weekly.',
    perks: [
      'Everything in Press Box',
      'Printed broadsheet by post',
      'Priority pundit voice releases',
      'Founder-list credit on masthead'
    ]
  }
] as const;

export function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && VALID_TIERS.has(v as Tier);
}

export function hasAccess(active: Tier, required: Tier): boolean {
  return TIER_RANK[active] >= TIER_RANK[required];
}

function readInitial(): Tier {
  if (typeof localStorage === 'undefined') return DEFAULT_TIER;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isTier(stored) ? stored : DEFAULT_TIER;
}

function persist(tier: Tier): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, tier);
}

const inner: Writable<Tier> = writable(readInitial());

export const entitlementsStore = {
  subscribe: inner.subscribe,
  set(tier: Tier): void {
    if (!isTier(tier)) return;
    persist(tier);
    inner.set(tier);
  },
  reset(): void {
    persist(DEFAULT_TIER);
    inner.set(DEFAULT_TIER);
  }
};
