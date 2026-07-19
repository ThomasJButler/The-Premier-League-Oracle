import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { tickerDesktop, tickerMobile } from './tickerFeed';

// Vitest's default env is node (no `window`), so the start-notifier's
// browser gate short-circuits and both tapes stay on the honest neutral set —
// the same value SSR paints before client state resolves.
describe('tickerFeed', () => {
  it('desktop tape starts on the honest neutral set', () => {
    expect(get(tickerDesktop)).toEqual(['THE KICKER', 'AWAITING SCHEDULE']);
  });

  it('mobile tape starts on the honest neutral set', () => {
    expect(get(tickerMobile)).toEqual(['THE KICKER', 'AWAITING SCHEDULE']);
  });

  it('carries no fake-live literals in the neutral tape', () => {
    const joined = [...get(tickerDesktop), ...get(tickerMobile)].join(' ');
    expect(joined).not.toContain('GW33');
    expect(joined).not.toContain('0.198');
  });
});
