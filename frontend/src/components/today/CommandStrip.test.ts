import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import CommandStrip from './CommandStrip.svelte';

vi.mock('svelte-routing', async () => {
  const LinkStub = (await import('../../tests/LinkStub.svelte')).default;
  return { Link: LinkStub, navigate: vi.fn() };
});

describe('CommandStrip', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-04-30T17:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('renders the gameweek number and accuracy chip', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: '2026-04-30T19:00:00Z', accuracyPct: 67, apiHealthy: true },
    });
    expect(container.textContent).toContain('GW 35');
    expect(container.textContent).toContain('67%');
  });

  it('formats the countdown as Hh Mm when more than an hour out', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: '2026-04-30T19:00:00Z', accuracyPct: 67, apiHealthy: true },
    });
    // 2h 0m remaining at frozen system time
    expect(container.textContent).toMatch(/2h 0m/);
  });

  it('formats the countdown as Dd Hh when more than a day out', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: '2026-05-02T17:00:00Z', accuracyPct: 50, apiHealthy: true },
    });
    expect(container.textContent).toMatch(/2d 0h/);
  });

  it('shows KICKING OFF once kickoff has passed', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: '2026-04-30T16:00:00Z', accuracyPct: 50, apiHealthy: true },
    });
    expect(container.querySelector('[data-countdown]')?.textContent).toContain('KICKING OFF');
  });

  it('falls back to "—" countdown when no kickoff is supplied', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: null, kickoffIso: null, accuracyPct: 0, apiHealthy: false },
    });
    expect(container.querySelector('[data-countdown]')?.textContent).toContain('—');
  });

  it('renders an api-dot with data-healthy reflecting the prop', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: null, accuracyPct: 50, apiHealthy: false },
    });
    expect(container.querySelector('[data-api-dot]')?.getAttribute('data-healthy')).toBe('false');
  });

  it('renders the [Predict GW{n}] CTA with the right label when gameweek is set', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: 35, kickoffIso: null, accuracyPct: 50, apiHealthy: true },
    });
    expect(container.querySelector('[data-predict-cta]')?.textContent).toMatch(/Predict GW\s*35/);
  });

  it('hides the predict CTA when gameweek is null', () => {
    const { container } = render(CommandStrip, {
      props: { gameweek: null, kickoffIso: null, accuracyPct: 0, apiHealthy: false },
    });
    expect(container.querySelector('[data-predict-cta]')).toBeNull();
  });
});
