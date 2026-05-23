import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import GeoffMessage from './GeoffMessage.svelte';
import { getPersona } from '$lib/personas';

const persona = getPersona('voice');

describe('GeoffMessage — inline-token rendering (K1a-β.3)', () => {
  it('renders plain text in a single text span (no callouts, no chips)', () => {
    const { body } = render(GeoffMessage, {
      props: { body: 'Saturday is going to be a riot.', persona }
    });
    expect(body).toContain('data-geoff-body');
    expect((body.match(/data-geoff-text/g) ?? []).length).toBe(1);
    expect(body).toContain('Saturday is going to be a riot.');
    expect(body).not.toContain('data-cheers-callout');
    expect(body).not.toContain('data-fixture-chip');
  });

  it('renders a CheersGeoffCallout for a [[CHEERS:…]] token with the parsed props', () => {
    const { body } = render(GeoffMessage, {
      props: {
        body: 'Right then. [[CHEERS:87%|XG VS FORM|A glorious irrelevance.]]',
        persona
      }
    });
    expect(body).toContain('data-cheers-callout');
    expect(body).toContain('87%');
    expect(body).toContain('XG VS FORM');
    expect(body).toContain('A glorious irrelevance.');
    // The preceding "Right then. " should land in its own text span.
    expect((body.match(/data-geoff-text/g) ?? []).length).toBe(1);
  });

  it('renders a FixtureChip for a [[FIXTURE:HOME-AWAY]] token carrying the pair attrs', () => {
    const { body } = render(GeoffMessage, {
      props: {
        body: 'Big one Saturday: [[FIXTURE:ARS-LIV]] — write it down.',
        persona
      }
    });
    expect(body).toContain('data-fixture-chip');
    expect(body).toMatch(/data-fixture-home="ARS"/);
    expect(body).toMatch(/data-fixture-away="LIV"/);
    // Text segments wrap the chip on both sides.
    expect((body.match(/data-geoff-text/g) ?? []).length).toBe(2);
  });
});
