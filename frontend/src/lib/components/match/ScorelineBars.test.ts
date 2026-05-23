import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ScorelineBars from './ScorelineBars.svelte';

const scorelines = [
  { home: 2, away: 1, prob: 0.12 },
  { home: 1, away: 1, prob: 0.11 },
  { home: 2, away: 0, prob: 0.09 },
  { home: 0, away: 0, prob: 0.07 },
];

describe('ScorelineBars', () => {
  it('renders the data-scoreline-bars marker', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines, homeAbbr: 'ARS', awayAbbr: 'LIV' },
    });
    expect(body).toContain('data-scoreline-bars');
    expect(body).toContain('SCORELINE GRID');
  });

  it('renders one row per scoreline, capped at limit', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines, homeAbbr: 'ARS', awayAbbr: 'LIV', limit: 3 },
    });
    const rows = body.match(/data-scoreline-row(?![-\w])/g) ?? [];
    expect(rows.length).toBe(3);
  });

  it('encodes the score in a data-scoreline-score attribute', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines, homeAbbr: 'ARS', awayAbbr: 'LIV' },
    });
    expect(body).toContain('data-scoreline-score="2-1"');
    expect(body).toContain('data-scoreline-score="0-0"');
  });

  it('renders absolute percent labels per scoreline', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines, homeAbbr: 'ARS', awayAbbr: 'LIV' },
    });
    expect(body).toContain('12%');
    expect(body).toContain('11%');
    expect(body).toContain('9%');
    expect(body).toContain('7%');
  });

  it('renders the empty state when the grid is empty', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines: [], homeAbbr: 'ARS', awayAbbr: 'LIV' },
    });
    expect(body).toContain('data-scoreline-empty');
  });

  it('renders no betting copy', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines, homeAbbr: 'ARS', awayAbbr: 'LIV' },
    });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });

  it('shows home/away abbrs in the header', () => {
    const { body } = render(ScorelineBars, {
      props: { scorelines, homeAbbr: 'ARS', awayAbbr: 'LIV' },
    });
    expect(body).toContain('ARS');
    expect(body).toContain('LIV');
  });
});
