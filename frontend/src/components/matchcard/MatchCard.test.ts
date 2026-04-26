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

describe('MatchCard — expanding sections', () => {
  it('renders all four section buttons', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    expect(container.querySelector('[data-section="analyse"]')).toBeTruthy();
    expect(container.querySelector('[data-section="probabilities"]')).toBeTruthy();
    expect(container.querySelector('[data-section="form"]')).toBeTruthy();
    expect(container.querySelector('[data-section="context"]')).toBeTruthy();
  });

  it('all sections are collapsed by default', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction() },
    });
    const buttons = container.querySelectorAll('[aria-expanded]');
    for (const btn of Array.from(buttons)) {
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('defaultOpen="analyse" expands only the analyse section', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: 'analyse' },
    });
    const analyseBtn = container.querySelector('[data-section="analyse"] button') as HTMLElement;
    const probsBtn = container.querySelector('[data-section="probabilities"] button') as HTMLElement;
    expect(analyseBtn.getAttribute('aria-expanded')).toBe('true');
    expect(probsBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('defaultOpen array expands multiple sections at mount', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: ['analyse', 'probabilities'] },
    });
    const analyseBtn = container.querySelector('[data-section="analyse"] button') as HTMLElement;
    const probsBtn = container.querySelector('[data-section="probabilities"] button') as HTMLElement;
    expect(analyseBtn.getAttribute('aria-expanded')).toBe('true');
    expect(probsBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking a section toggles it open without affecting other sections (multi-open)', async () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: 'analyse' },
    });
    const probsBtn = container.querySelector('[data-section="probabilities"] button') as HTMLButtonElement;
    probsBtn.click();
    await Promise.resolve();
    const analyseBtn = container.querySelector('[data-section="analyse"] button') as HTMLElement;
    expect(probsBtn.getAttribute('aria-expanded')).toBe('true');
    expect(analyseBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('hideSections prop omits listed sections entirely', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction(),
        hideSections: ['form', 'context'],
      },
    });
    expect(container.querySelector('[data-section="form"]')).toBeFalsy();
    expect(container.querySelector('[data-section="context"]')).toBeFalsy();
    expect(container.querySelector('[data-section="analyse"]')).toBeTruthy();
  });
});

describe('MatchCard — section content', () => {
  it('analyse section renders 3-col grid with kickers when prediction text is present', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({
          analyseText: 'Liverpool press high. Arsenal counter on the break.',
          keyFactors: ['Home form L5: 4W 1D'],
          risks: ['Salah a doubt'],
        }),
        defaultOpen: 'analyse',
      },
    });
    expect(container.textContent).toContain('Liverpool press high');
    expect(container.textContent).toContain('Home form L5: 4W 1D');
    expect(container.textContent).toContain('Salah a doubt');
  });

  it('probabilities section lists all 5 model rows', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), defaultOpen: 'probabilities' },
    });
    const section = container.querySelector('[data-section="probabilities"]') as HTMLElement;
    expect(section.textContent).toContain('ELO');
    expect(section.textContent).toContain('POISSON');
    expect(section.textContent).toContain('FORM');
    expect(section.textContent).toContain('H2H');
    expect(section.textContent).toContain('XGBOOST');
  });
});
