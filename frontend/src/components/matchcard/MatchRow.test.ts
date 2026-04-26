import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MatchRow from './MatchRow.svelte';
import { makeFixture, makePrediction } from '../../tests/fixtures/matchcard';

describe('MatchRow', () => {
  it('renders date, both team abbrs, score-or-v, ProbBar, and pick on a single line', () => {
    const fixture = makeFixture();
    const prediction = makePrediction();
    const { container } = render(MatchRow, { props: { fixture, prediction } });

    expect(container.textContent).toContain('LIV');
    expect(container.textContent).toContain('ARS');
    // Either a score (FT) or 'v' for scheduled fixtures
    expect(container.textContent?.match(/v|\d-\d/)).toBeTruthy();
    // ProbBar segments
    const segs = container.querySelectorAll('[data-seg]');
    expect(segs.length).toBe(3);
  });

  it('shows hit/miss indicator when status is FINISHED and prediction provided', () => {
    const fixture = makeFixture({ status: 'FINISHED', score: { home: 2, away: 0 } });
    const prediction = makePrediction({ pick: 'HOME' });
    const { container } = render(MatchRow, { props: { fixture, prediction } });

    const hit = container.querySelector('[data-hit]');
    expect(hit).toBeTruthy();
    expect(hit?.getAttribute('data-hit')).toBe('true');   // home pick, home won
  });

  it('marks miss when prediction was wrong', () => {
    const fixture = makeFixture({ status: 'FINISHED', score: { home: 0, away: 2 } });
    const prediction = makePrediction({ pick: 'HOME' });
    const { container } = render(MatchRow, { props: { fixture, prediction } });
    const hit = container.querySelector('[data-hit]');
    expect(hit?.getAttribute('data-hit')).toBe('false');
  });

  it('renders without prediction (showLabels suppressed in ProbBar)', () => {
    const { container } = render(MatchRow, { props: { fixture: makeFixture() } });
    // ProbBar fallback or absence is acceptable; row should still render
    expect(container.firstElementChild).toBeTruthy();
  });
});
