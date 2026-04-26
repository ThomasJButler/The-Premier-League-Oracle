import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LiveBanner from './LiveBanner.svelte';

describe('LiveBanner', () => {
  it('renders with the [data-live-banner] root and [data-pulse] indicator', () => {
    const { container } = render(LiveBanner, { props: { minute: 23, score: '0-0' } });
    expect(container.querySelector('[data-live-banner]')).toBeTruthy();
    expect(container.querySelector('[data-pulse]')).toBeTruthy();
  });

  it("renders the minute formatted as \"MIN 67'\" inside [data-minute]", () => {
    const { container } = render(LiveBanner, { props: { minute: 67, score: '2-1' } });
    expect(container.querySelector('[data-minute]')?.textContent).toContain("67'");
  });

  it('renders the score in [data-score] using text-metric-lg sizing', () => {
    const { container } = render(LiveBanner, { props: { minute: 90, score: '3-2' } });
    const scoreEl = container.querySelector('[data-score]');
    expect(scoreEl?.textContent).toBe('3-2');
    expect(scoreEl?.className).toContain('text-metric-lg');
  });

  it('omits the [data-xg] row entirely when only one of xgHome/xgAway is provided', () => {
    const { container } = render(LiveBanner, {
      props: { minute: 30, score: '0-0', xgHome: 0.42 },
    });
    expect(container.querySelector('[data-xg]')).toBeNull();
  });

  it('renders the [data-xg] row when both xgHome AND xgAway are provided', () => {
    const { container } = render(LiveBanner, {
      props: { minute: 30, score: '0-0', xgHome: 0.42, xgAway: 0.18 },
    });
    const xg = container.querySelector('[data-xg]');
    expect(xg?.textContent).toContain('0.42');
    expect(xg?.textContent).toContain('0.18');
  });

  it('renders the [data-prob-shift] row when probShift is provided, omits when absent', () => {
    const withShift = render(LiveBanner, {
      props: { minute: 60, score: '1-1', probShift: { home: 0.05, draw: -0.10, away: 0.05 } },
    });
    expect(withShift.container.querySelector('[data-prob-shift]')).toBeTruthy();
    withShift.unmount();

    const noShift = render(LiveBanner, { props: { minute: 5, score: '0-0' } });
    expect(noShift.container.querySelector('[data-prob-shift]')).toBeNull();
  });

  it('clamps minute values above 120 down to 120 (extra-time cap)', () => {
    const { container } = render(LiveBanner, { props: { minute: 999, score: '4-4' } });
    expect(container.querySelector('[data-minute]')?.textContent).toContain("120'");
  });
});
