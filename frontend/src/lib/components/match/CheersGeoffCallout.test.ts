import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CheersGeoffCallout from './CheersGeoffCallout.svelte';

const sample = {
  stat: '100%',
  label: 'R-MONTH STRIKE RATE',
  gloriouslyUseless:
    'Salah has scored in every Premier League month this season containing the letter R.'
};

describe('CheersGeoffCallout', () => {
  it('renders the stamp, stat, label, and useless text', () => {
    const { body } = render(CheersGeoffCallout, { props: sample });
    expect(body).toContain('data-cheers-callout');
    expect(body).toContain('data-cheers-stamp');
    expect(body).toContain('CHEERS, GEOFF');
    expect(body).toContain('data-cheers-stat');
    expect(body).toContain('100%');
    expect(body).toContain('R-MONTH STRIKE RATE');
    expect(body).toContain(sample.gloriouslyUseless);
    expect(body).toContain('GLORIOUSLY USELESS');
  });

  it('uses dashed amber border on the outer container', () => {
    const { body } = render(CheersGeoffCallout, { props: sample });
    const outer = body.match(/<aside\b[^>]*data-cheers-callout[^>]*>/);
    expect(outer![0]).toMatch(/border-dashed/);
    expect(outer![0]).toMatch(/border-amber/);
    expect(outer![0]).toMatch(/border-2/);
  });

  it('renders stat in mono extrabold amber', () => {
    const { body } = render(CheersGeoffCallout, { props: sample });
    const statTag = body.match(/<div\b[^>]*data-cheers-stat="[^>]*>/);
    expect(statTag![0]).toMatch(/font-mono/);
    expect(statTag![0]).toMatch(/font-extrabold/);
    expect(statTag![0]).toMatch(/text-amber/);
  });

  it('renders gloriously-useless body in italic serif ink', () => {
    const { body } = render(CheersGeoffCallout, { props: sample });
    const text = body.match(/<p\b[^>]*data-cheers-text[^>]*>/);
    expect(text![0]).toMatch(/font-serif/);
    expect(text![0]).toMatch(/italic/);
    expect(text![0]).toMatch(/text-ink/);
  });
});
