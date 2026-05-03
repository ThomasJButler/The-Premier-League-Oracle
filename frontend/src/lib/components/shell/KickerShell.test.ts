import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KickerShell from './KickerShell.svelte';

const NAV_IDS = ['today', 'fixtures', 'predictions', 'oracle', 'insights', 'settings'] as const;

describe('KickerShell', () => {
  it('renders all 6 nav items in the canonical order', () => {
    const { body } = render(KickerShell);
    const positions = NAV_IDS.map((id) => body.indexOf(`data-nav-id="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it('marks the active nav item with aria-current="page"', () => {
    const { body } = render(KickerShell, { props: { active: 'predictions' } });
    const predictionsTag = body.match(/<a\b[^>]*data-nav-id="predictions"[^>]*>/);
    expect(predictionsTag, 'expected an anchor with data-nav-id="predictions"').not.toBeNull();
    expect(predictionsTag![0]).toContain('aria-current="page"');
    const otherMatches = body.match(/aria-current="page"/g) ?? [];
    expect(otherMatches.length).toBe(1);
  });

  it('omits aria-current when no active nav id is supplied', () => {
    const { body } = render(KickerShell);
    expect(body).not.toContain('aria-current="page"');
  });

  it('renders the PUNDIT ON DUTY card with the default persona name and tic', () => {
    const { body } = render(KickerShell);
    expect(body).toContain('data-pundit-on-duty');
    expect(body).toContain('data-pundit-name');
    expect(body).toContain('The Voice');
    expect(body).toContain('data-pundit-tic');
    expect(body).toContain('And that, ladies and gentlemen, is football.');
  });

  it('mounts the GeoffTicker tape', () => {
    const { body } = render(KickerShell);
    expect(body).toContain('aria-label="Live model ticker"');
  });

  it('renders the MODEL LIVE pill and TODAY\'S PAPER CTA in the topbar', () => {
    const { body } = render(KickerShell);
    expect(body).toContain('data-model-pill');
    expect(body).toMatch(/data-model-pill[\s\S]*Model Live/);
    expect(body).toContain('data-todays-paper-cta');
    expect(body).toMatch(/Today's Paper\s*→/);
  });

  it('renders the optional kicker eyebrow when supplied', () => {
    const { body } = render(KickerShell, {
      props: { kicker: 'GAMEWEEK 33', title: 'TODAY' }
    });
    expect(body).toContain('data-topbar-kicker');
    expect(body).toContain('GAMEWEEK 33');
    expect(body).toContain('data-topbar-title');
    expect(body).toContain('TODAY');
  });
});
