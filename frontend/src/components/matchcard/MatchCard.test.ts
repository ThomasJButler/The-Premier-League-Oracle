import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MatchCard from './MatchCard.svelte';
import { makeFixture, makePrediction } from '../../tests/fixtures/matchcard';

describe('MatchCard — header strip', () => {
  it('renders the top meta row with date/time/venue/TV and pick', () => {
    const fixture = makeFixture();
    const prediction = makePrediction();
    const { container } = render(MatchCard, { props: { fixture, prediction } });

    const meta = container.querySelector('[data-meta]') as HTMLElement;
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain('Anfield');
    expect(meta.textContent).toContain('Sky Sports');
    const pick = container.querySelector('[data-pick]') as HTMLElement;
    expect(pick).toBeTruthy();
    expect(pick.textContent).toMatch(/PICK/);
    expect(pick.textContent).toContain('55%');
  });

  it('renders home, center, and away column blocks', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });

    expect(container.querySelector('[data-block="home"]')).toBeTruthy();
    expect(container.querySelector('[data-block="center"]')).toBeTruthy();
    expect(container.querySelector('[data-block="away"]')).toBeTruthy();
  });

  it('uses the team primary colors via inline CSS variables for the gradient', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--home-color')).toBeTruthy();
    expect(root.style.getPropertyValue('--away-color')).toBeTruthy();
  });

  it('renders the H/D/A numerics as percentages', () => {
    const { getByText } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    expect(getByText('55%')).toBeTruthy();
    expect(getByText('25%')).toBeTruthy();
    expect(getByText('20%')).toBeTruthy();
  });

  it('renders FormDots for both teams when formLast5 is supplied', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    const homeBlock = container.querySelector('[data-block="home"]') as HTMLElement;
    const awayBlock = container.querySelector('[data-block="away"]') as HTMLElement;
    expect(homeBlock.querySelectorAll('[aria-label]').length).toBeGreaterThanOrEqual(5);
    expect(awayBlock.querySelectorAll('[aria-label]').length).toBeGreaterThanOrEqual(5);
  });

  it('renders without prediction (header should still show without pick chip)', () => {
    const { container } = render(MatchCard, { props: { fixture: makeFixture() } });
    expect(container.querySelector('[data-meta]')).toBeTruthy();
    expect(container.querySelector('[data-pick]')).toBeFalsy();
  });

  it('compact density applies tighter padding', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), density: 'compact' },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/p-3/);
  });
});
