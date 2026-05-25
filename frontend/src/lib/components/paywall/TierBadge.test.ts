import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TierBadge from './TierBadge.svelte';

describe('TierBadge', () => {
  it('renders the touchline variant with label', () => {
    const { body } = render(TierBadge, { props: { tier: 'touchline' } });
    expect(body).toContain('data-tier-badge="touchline"');
    expect(body).toContain('Touchline');
  });

  it('renders the press-box variant', () => {
    const { body } = render(TierBadge, { props: { tier: 'press-box' } });
    expect(body).toContain('data-tier-badge="press-box"');
    expect(body).toContain('Press Box');
  });

  it('renders the print-run variant at md size', () => {
    const { body } = render(TierBadge, { props: { tier: 'print-run', size: 'md' } });
    expect(body).toContain('data-tier-badge="print-run"');
    expect(body).toContain('data-tier-size="md"');
    expect(body).toContain('Print Run');
  });
});
