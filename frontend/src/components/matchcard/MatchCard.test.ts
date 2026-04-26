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

describe('MatchCard — emphasised variant', () => {
  it('applies the shadow-emphasised utility', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), variant: 'emphasised' },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/shadow-emphasised/);
  });

  it('bumps the winning numeric to a larger metric class', () => {
    const { container } = render(MatchCard, {
      props: { fixture: makeFixture(), prediction: makePrediction(), variant: 'emphasised' },
    });
    // Winning side (HOME) numeric should use text-metric-xl in emphasised mode
    const center = container.querySelector('[data-block="center"]') as HTMLElement;
    expect(center.innerHTML).toMatch(/text-metric-xl/);
  });
});

describe('MatchCard — PROBABILITIES section graceful degradation', () => {
  it('hides the 5-col models grid when prediction.models is empty', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({ models: [] }),
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-models-grid]')).toBeNull();
  });

  it('renders the 5-col models grid when prediction.models has entries', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction(), // default has 5 models
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-models-grid]')).toBeTruthy();
  });

  it('hides the xG block when xg.home and xg.away are both zero', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({ xg: { home: 0, away: 0 } }),
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-xg-block]')).toBeNull();
  });

  it('renders the xG block when at least one xg value is non-zero', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({ xg: { home: 1.2, away: 0 } }),
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-xg-block]')).toBeTruthy();
  });

  it('hides the ELO block when elo.home and elo.away are both zero', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({ elo: { home: 0, away: 0 } }),
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-elo-block]')).toBeNull();
  });

  it('renders the ELO block when at least one elo value is non-zero', () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({ elo: { home: 1800, away: 0 } }),
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-elo-block]')).toBeTruthy();
  });

  it("always renders TOP-3 SCORELINES (the section's minimum useful payload)", () => {
    const { container } = render(MatchCard, {
      props: {
        fixture: makeFixture(),
        prediction: makePrediction({
          models: [],
          xg: { home: 0, away: 0 },
          elo: { home: 0, away: 0 },
        }),
        defaultOpen: 'probabilities',
      },
    });
    expect(container.querySelector('[data-scorelines]')).toBeTruthy();
  });
});
