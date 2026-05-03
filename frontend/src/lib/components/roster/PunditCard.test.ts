import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PunditCard from './PunditCard.svelte';
import { getPersona } from '$lib/personas';

describe('PunditCard', () => {
  const voice = getPersona('voice');

  it('renders the persona name, id-tag, monogram, tic and region', () => {
    const { body } = render(PunditCard, { props: { persona: voice } });
    expect(body).toContain('data-pundit-name');
    expect(body).toContain(voice.name);
    expect(body).toContain('VOICE');
    expect(body).toContain('data-pundit-mono');
    expect(body).toContain('data-pundit-tic');
    expect(body).toContain(voice.tic);
    expect(body).toContain('data-pundit-region');
    expect(body).toContain(voice.region);
  });

  it('marks data-pundit-selected="false" and omits the SELECTED badge when not selected', () => {
    const { body } = render(PunditCard, { props: { persona: voice, selected: false } });
    expect(body).toContain('data-pundit-selected="false"');
    expect(body).not.toContain('data-pundit-selected-badge');
    expect(body).not.toContain('is-selected');
  });

  it('renders the selected badge and accent border state when selected', () => {
    const { body } = render(PunditCard, { props: { persona: voice, selected: true } });
    expect(body).toContain('data-pundit-selected="true"');
    expect(body).toContain('data-pundit-selected-badge');
    expect(body).toContain('is-selected');
    expect(body).toContain('aria-pressed="true"');
  });

  it('derives monogram from the persona short label', () => {
    const macca = getPersona('scouser');
    const { body } = render(PunditCard, { props: { persona: macca } });
    const monoTag = body.match(/<span\b[^>]*data-pundit-mono[^>]*>([\s\S]*?)<\/span>/);
    expect(monoTag, 'expected a span carrying data-pundit-mono').not.toBeNull();
    expect(monoTag![1].trim()).toMatch(/^[A-Z]{1,2}$/);
  });
});
