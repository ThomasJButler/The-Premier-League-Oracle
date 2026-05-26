import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MatchSheetCard from './MatchSheetCard.svelte';

const liverpoolTottenham = {
  home: 'Liverpool',
  homeAbbr: 'LIV',
  homeColor: '#c8102e',
  away: 'Tottenham',
  awayAbbr: 'TOT',
  awayColor: '#132257',
  kickoff: 'SUN 16:00 BST',
  venue: 'Anfield',
  probH: 0.61,
  probD: 0.21,
  probA: 0.18
};

describe('MatchSheetCard', () => {
  it('renders both team names with home/away markers', () => {
    const { body } = render(MatchSheetCard, { props: liverpoolTottenham });
    expect(body).toContain('data-match-sheet');
    expect(body).toContain('data-match-home="LIV"');
    expect(body).toContain('data-match-away="TOT"');
    expect(body).toContain('data-match-home-name');
    expect(body).toContain('Liverpool');
    expect(body).toContain('Tottenham');
  });

  it('renders venue and kickoff in the meta strip', () => {
    const { body } = render(MatchSheetCard, { props: liverpoolTottenham });
    expect(body).toContain('FIXTURE · Anfield');
    expect(body).toContain('SUN 16:00 BST');
  });

  it('renders probability readout rounded to whole percentages', () => {
    const { body } = render(MatchSheetCard, {
      props: { ...liverpoolTottenham, probH: 0.614, probD: 0.213, probA: 0.173 }
    });
    expect(body).toContain('data-match-prob-readout');
    expect(body).toContain('61');
    expect(body).toContain('21');
    expect(body).toContain('17');
  });

  it('paints the prob bar segments using team colors and ink-faint for draw', () => {
    const { body } = render(MatchSheetCard, { props: liverpoolTottenham });
    const homeSeg = body.match(/data-match-bar-home[^>]*>/);
    const awaySeg = body.match(/data-match-bar-away[^>]*>/);
    const drawSeg = body.match(/data-match-bar-draw[^>]*>/);
    expect(homeSeg![0]).toContain('#c8102e');
    expect(awaySeg![0]).toContain('#132257');
    expect(drawSeg![0]).toMatch(/bg-ink-faint/);
  });

  it('exposes a screen-reader probability label on the bar', () => {
    const { body } = render(MatchSheetCard, { props: liverpoolTottenham });
    expect(body).toMatch(/aria-label="Win probability: home 61%, draw 21%, away 18%"/);
  });

  it('omits the footer block entirely when no headline or pick is supplied', () => {
    const { body } = render(MatchSheetCard, { props: liverpoolTottenham });
    expect(body).not.toContain('data-match-footer');
    expect(body).not.toContain('data-match-pick');
    expect(body).not.toContain('data-match-headline');
  });

  it('renders headline + byline + pick + confidence when supplied', () => {
    const { body } = render(MatchSheetCard, {
      props: {
        ...liverpoolTottenham,
        headline: 'Liverpool host Tottenham at Anfield',
        byline: 'Macca, Birkenhead',
        pick: '2–0',
        conf: 69
      }
    });
    expect(body).toContain('data-match-footer');
    expect(body).toContain('data-match-headline');
    expect(body).toContain('Liverpool host Tottenham at Anfield');
    expect(body).toContain('BYLINE · Macca, Birkenhead');
    expect(body).toContain('data-match-pick');
    expect(body).toContain('2–0');
    expect(body).toContain('69% confidence');
  });

  it('omits confidence sub-line when conf is undefined but still shows pick', () => {
    const { body } = render(MatchSheetCard, {
      props: { ...liverpoolTottenham, pick: '1-1' }
    });
    expect(body).toContain('data-match-pick');
    expect(body).toContain('1-1');
    expect(body).not.toContain('data-match-conf');
  });

  it('renders an actual scoreline (not the prob readout) when score is supplied', () => {
    const { body } = render(MatchSheetCard, {
      props: { ...liverpoolTottenham, score: { home: 3, away: 1 } }
    });
    expect(body).toContain('data-match-score');
    expect(body).toContain('data-match-score-home="3"');
    expect(body).toContain('data-match-score-away="1"');
    // Prob readout must not double up alongside the score.
    expect(body).not.toContain('data-match-prob-readout');
    expect(body).not.toContain('VERSUS');
    // The default FINAL label is shown.
    expect(body).toContain('FINAL');
  });

  it('uses the supplied scoreLabel (e.g. LIVE · 67\') when present', () => {
    const { body } = render(MatchSheetCard, {
      props: {
        ...liverpoolTottenham,
        score: { home: 1, away: 2 },
        scoreLabel: "LIVE · 67'"
      }
    });
    expect(body).toContain("LIVE · 67'");
    expect(body).not.toContain('FINAL');
  });

  it('renders four corner ornaments in tl/tr/bl/br order', () => {
    const { body } = render(MatchSheetCard, { props: liverpoolTottenham });
    expect(body).toContain('data-corner="tl"');
    expect(body).toContain('data-corner="tr"');
    expect(body).toContain('data-corner="bl"');
    expect(body).toContain('data-corner="br"');
  });
});
