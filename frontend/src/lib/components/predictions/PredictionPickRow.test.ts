import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PredictionPickRow from './PredictionPickRow.svelte';

const baseProps = {
  home: 'Liverpool',
  away: 'Tottenham',
  homeColor: '#c8102e',
  awayColor: '#132257',
  probH: 0.61,
  probD: 0.21,
  probA: 0.18,
  pick: '2-0',
  conf: 69
} as const;

describe('PredictionPickRow', () => {
  it('renders fixture, pick, conf, and rounded prob readout', () => {
    const { body } = render(PredictionPickRow, { props: { ...baseProps } });
    expect(body).toContain('data-prediction-row');
    expect(body).toContain('data-prediction-status="pending"');
    expect(body).toContain('Liverpool v Tottenham');
    const pickTag = body.match(/<div\b[^>]*data-prediction-pick="[^"]*"[^>]*>[^<]*/);
    expect(pickTag).not.toBeNull();
    expect(pickTag![0]).toContain('2-0');
    expect(body).toContain('69% CONF');
    const readout = body.match(
      /<div\b[^>]*data-prediction-prob-readout="[^"]*"[^>]*>[\s\S]*?<\/div>/
    );
    expect(readout).not.toBeNull();
    expect(readout![0]).toContain('61%');
    expect(readout![0]).toContain('21%');
    expect(readout![0]).toContain('18%');
  });

  it('omits the ghost-bar when no marketImplied probabilities are provided', () => {
    const { body } = render(PredictionPickRow, { props: { ...baseProps } });
    expect(body).not.toContain('data-prediction-ghost-bar');
  });

  it('renders a ghost-bar overlay when all three marketImplied values are present', () => {
    const { body } = render(PredictionPickRow, {
      props: {
        ...baseProps,
        marketImpliedH: 0.55,
        marketImpliedD: 0.23,
        marketImpliedA: 0.22
      }
    });
    expect(body).toContain('data-prediction-ghost-bar');
    expect(body).toContain('data-prediction-ghost-home');
    expect(body).toContain('data-prediction-ghost-draw');
    expect(body).toContain('data-prediction-ghost-away');
    const ghostTag = body.match(
      /<div\b[^>]*data-prediction-ghost-bar="[^"]*"[^>]*>/
    );
    expect(ghostTag![0]).toMatch(/opacity-40/);
  });

  it('paints the value-edge chip green when valueEdge is positive', () => {
    const { body } = render(PredictionPickRow, {
      props: { ...baseProps, valueEdge: 0.04 }
    });
    expect(body).toContain('data-prediction-edge-sign="positive"');
    expect(body).toContain('+4pp');
    const edgeTag = body.match(/<div\b[^>]*data-prediction-edge="[^"]*"[^>]*>/);
    expect(edgeTag![0]).toMatch(/text-green/);
    expect(edgeTag![0]).toMatch(/border-green/);
    expect(edgeTag![0]).not.toMatch(/text-red/);
  });

  it('paints the value-edge chip red when valueEdge is negative', () => {
    const { body } = render(PredictionPickRow, {
      props: { ...baseProps, valueEdge: -0.02 }
    });
    expect(body).toContain('data-prediction-edge-sign="negative"');
    expect(body).toContain('-2pp');
    const edgeTag = body.match(/<div\b[^>]*data-prediction-edge="[^"]*"[^>]*>/);
    expect(edgeTag![0]).toMatch(/text-red/);
    expect(edgeTag![0]).toMatch(/border-red/);
  });

  it('paints the value-edge chip ink-dim when valueEdge is zero', () => {
    const { body } = render(PredictionPickRow, {
      props: { ...baseProps, valueEdge: 0 }
    });
    expect(body).toContain('data-prediction-edge-sign="zero"');
    expect(body).toContain('0pp');
    const edgeTag = body.match(/<div\b[^>]*data-prediction-edge="[^"]*"[^>]*>/);
    expect(edgeTag![0]).toMatch(/text-ink-dim/);
    expect(edgeTag![0]).toMatch(/border-rule/);
    expect(edgeTag![0]).not.toMatch(/text-green/);
    expect(edgeTag![0]).not.toMatch(/text-red/);
  });

  it('falls back to the status chip when no valueEdge is supplied', () => {
    const { body } = render(PredictionPickRow, {
      props: { ...baseProps, status: 'settled' }
    });
    expect(body).not.toContain('data-prediction-edge');
    expect(body).toContain('data-prediction-status-chip');
    expect(body).toContain('SETTLED');
  });

  it('defaults the status chip text to PENDING', () => {
    const { body } = render(PredictionPickRow, { props: { ...baseProps } });
    expect(body).toContain('data-prediction-status-chip');
    expect(body).toContain('PENDING');
  });

  it('threads home and away colors into the bar segments', () => {
    const { body } = render(PredictionPickRow, { props: { ...baseProps } });
    expect(body).toContain('background-color: #c8102e');
    expect(body).toContain('background-color: #132257');
  });

  it('renders both mobile and desktop row templates with layout markers', () => {
    const { body } = render(PredictionPickRow, { props: { ...baseProps } });
    expect(body).toContain('data-prediction-layout="mobile"');
    expect(body).toContain('data-prediction-layout="desktop"');
    const mobile = body.match(/<div\b[^>]*data-prediction-layout="mobile"[^>]*>/);
    const desktop = body.match(/<div\b[^>]*data-prediction-layout="desktop"[^>]*>/);
    expect(mobile).not.toBeNull();
    expect(desktop).not.toBeNull();
    expect(mobile![0]).toContain('lg:hidden');
    expect(desktop![0]).toContain('hidden');
    expect(desktop![0]).toContain('lg:grid');
  });

  it('mobile template stacks fixture+pick on row 1, bars below, status chip last', () => {
    const { body } = render(PredictionPickRow, { props: { ...baseProps } });
    const mobileBlock = body
      .split('data-prediction-layout="mobile"')[1]
      ?.split('data-prediction-layout="desktop"')[0];
    expect(mobileBlock).toBeDefined();
    // Order of markers inside the mobile block: fixture → pick → conf → bars → status chip
    const order = [
      'data-prediction-fixture',
      'data-prediction-pick',
      'data-prediction-conf',
      'data-prediction-bars',
      'data-prediction-status-chip'
    ];
    let cursor = -1;
    for (const marker of order) {
      const next = mobileBlock!.indexOf(marker, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it('contains no betting/value-bets/bankroll copy', () => {
    const { body } = render(PredictionPickRow, {
      props: { ...baseProps, valueEdge: 0.04 }
    });
    expect(body).not.toMatch(/value bets/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
