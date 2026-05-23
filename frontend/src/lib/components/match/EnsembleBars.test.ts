import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import EnsembleBars from './EnsembleBars.svelte';
import type { ModelBreakdown } from '../../../types/redesign';

const models: ModelBreakdown[] = [
  { name: 'ELO', lean: 'H', confidence: 0.55 },
  { name: 'POISSON', lean: 'H', confidence: 0.50 },
  { name: 'FORM', lean: 'D', confidence: 0.32 },
  { name: 'H2H', lean: 'A', confidence: 0.40 },
];

describe('EnsembleBars', () => {
  it('renders the data-ensemble-bars marker', () => {
    const { body } = render(EnsembleBars, { props: { models, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    expect(body).toContain('data-ensemble-bars');
    expect(body).toContain('MODEL ENSEMBLE');
  });

  it('renders one row per model with the model name as a data attr', () => {
    const { body } = render(EnsembleBars, { props: { models, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    const rows = body.match(/data-ensemble-row(?![-\w])/g) ?? [];
    expect(rows.length).toBe(4);
    expect(body).toContain('data-ensemble-model="ELO"');
    expect(body).toContain('data-ensemble-model="POISSON"');
    expect(body).toContain('data-ensemble-model="FORM"');
    expect(body).toContain('data-ensemble-model="H2H"');
  });

  it('maps lean H/A/D to home abbr / away abbr / DRAW', () => {
    const { body } = render(EnsembleBars, { props: { models, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    expect(body).toContain('>ARS<');
    expect(body).toContain('>LIV<');
    expect(body).toContain('>DRAW<');
  });

  it('renders the confidence percent for each row', () => {
    const { body } = render(EnsembleBars, { props: { models, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    expect(body).toContain('55%');
    expect(body).toContain('50%');
    expect(body).toContain('32%');
    expect(body).toContain('40%');
  });

  it('drives the bar fill width from the persona-accent CSS variable, not inline hex', () => {
    const { body } = render(EnsembleBars, { props: { models, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    expect(body).toContain('var(--persona-accent');
    expect(body).not.toMatch(/background:\s*#[0-9a-fA-F]{3,6}/);
  });

  it('renders an XGBOOST row when supplied', () => {
    const withMl: ModelBreakdown[] = [...models, { name: 'XGBOOST', lean: 'H', confidence: 0.65 }];
    const { body } = render(EnsembleBars, { props: { models: withMl, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    expect(body).toContain('data-ensemble-model="XGBOOST"');
    expect(body).toContain('5 MODELS');
  });

  it('does not render any betting copy', () => {
    const { body } = render(EnsembleBars, { props: { models, homeAbbr: 'ARS', awayAbbr: 'LIV' } });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
