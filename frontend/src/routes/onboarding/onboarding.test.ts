import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import OnboardingPage from './+page.svelte';
import OnboardWelcome from '$lib/components/onboarding/OnboardWelcome.svelte';
import OnboardPickPundit from '$lib/components/onboarding/OnboardPickPundit.svelte';
import OnboardPreview from '$lib/components/onboarding/OnboardPreview.svelte';
import { KICKER_PERSONA_ORDER } from '$lib/personas';

describe('Onboarding route', () => {
  it('SSR-renders the welcome step by default', () => {
    const { body } = render(OnboardingPage);
    expect(body).toContain('data-onboard-current-step="0"');
    expect(body).toContain('data-onboard-step="welcome"');
    expect(body).toContain('PICK YOUR PUNDIT');
  });

  it('SSR-renders the pick step when initialStep=1', () => {
    const { body } = render(OnboardingPage, { props: { initialStep: 1 } });
    expect(body).toContain('data-onboard-step="pick"');
    expect(body).toContain('SELECT A PUNDIT');
  });

  it('SSR-renders the preview step when initialStep=2 and a persona is chosen', () => {
    const { body } = render(OnboardingPage, {
      props: { initialStep: 2, initialChosen: 'voice' }
    });
    expect(body).toContain('data-onboard-step="preview"');
    expect(body).toContain('OPEN MY PAPER');
    expect(body).toContain('data-onboard-confirm');
  });
});

describe('OnboardWelcome', () => {
  it('exposes the next-step CTA the page wires up', () => {
    const { body } = render(OnboardWelcome);
    expect(body).toContain('data-onboard-next');
    expect(body).toContain('The');
    expect(body).toContain('Kicker.');
  });
});

describe('OnboardPickPundit', () => {
  it('renders all 10 pundit cards in KICKER_PERSONA_ORDER', () => {
    const { body } = render(OnboardPickPundit);
    const ids = body.match(/data-pundit-id="([a-z]+)"/g) ?? [];
    expect(ids).toHaveLength(10);
    const renderedIds = ids.map((m) => m.match(/"([a-z]+)"/)![1]);
    expect(renderedIds).toEqual([...KICKER_PERSONA_ORDER]);
  });

  it('shows the disabled CTA placeholder when no persona is chosen', () => {
    const { body } = render(OnboardPickPundit);
    expect(body).toContain('data-onboard-next-disabled');
    expect(body).not.toContain('data-onboard-next"');
  });

  it('swaps to the active CTA once a persona is chosen', () => {
    const { body } = render(OnboardPickPundit, { props: { chosen: 'scouser' } });
    expect(body).toContain('data-onboard-next');
    expect(body).not.toContain('data-onboard-next-disabled');
    expect(body).toMatch(/START WITH [A-Z]+/);
  });
});

describe('OnboardPreview', () => {
  it('SSR-renders the persona name, voice take and confirm CTA', () => {
    const { body } = render(OnboardPreview, { props: { chosen: 'philosopher' } });
    expect(body).toContain('data-pundit-name');
    expect(body).toContain('The Gaffer');
    expect(body).toContain('data-onboard-preview-open');
    expect(body).toContain('data-onboard-confirm');
    expect(body).toContain('OPEN MY PAPER');
    expect(body).toContain('PUNDIT FINGERPRINT');
  });
});
