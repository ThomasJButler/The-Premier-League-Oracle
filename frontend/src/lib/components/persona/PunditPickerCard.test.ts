import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PunditPickerCard from './PunditPickerCard.svelte';
import { getPersona } from '$lib/personas';

describe('PunditPickerCard', () => {
  const voice = getPersona('voice');

  it('renders the persona id-tag, name, tagline (voice) and shield monogram', () => {
    const { body } = render(PunditPickerCard, { props: { persona: voice } });
    expect(body).toContain('data-picker-id="voice"');
    expect(body).toContain('data-picker-id-tag');
    expect(body).toContain('VOICE');
    expect(body).toContain('data-picker-name');
    expect(body).toContain(voice.name);
    expect(body).toContain('data-picker-tagline');
    expect(body).toContain(voice.voice);
    expect(body).toContain('data-picker-shield');
  });

  it('omits the checkmark and marks data-picker-selected="false" when not selected', () => {
    const { body } = render(PunditPickerCard, { props: { persona: voice, selected: false } });
    expect(body).toContain('data-picker-selected="false"');
    expect(body).not.toContain('data-picker-check');
    expect(body).toContain('aria-pressed="false"');
    expect(body).not.toContain('is-selected');
  });

  it('renders the checkmark and selected state when selected', () => {
    const { body } = render(PunditPickerCard, { props: { persona: voice, selected: true } });
    expect(body).toContain('data-picker-selected="true"');
    expect(body).toContain('data-picker-check');
    expect(body).toContain('aria-pressed="true"');
    expect(body).toContain('is-selected');
  });

  it('locked variant exposes lock marker + aria-disabled and suppresses the checkmark', () => {
    const { body } = render(PunditPickerCard, {
      props: { persona: voice, selected: true, locked: true }
    });
    expect(body).toContain('data-picker-locked="true"');
    expect(body).toContain('data-picker-lock');
    expect(body).toContain('aria-disabled="true"');
    expect(body).toContain('is-locked');
    // selected+locked → the locked treatment wins; checkmark hidden so the
    // visual remains unambiguous (you can't be "active and locked" simultaneously).
    expect(body).not.toContain('data-picker-check');
  });

  it('unlocked card has data-picker-locked="false" and no lock badge', () => {
    const { body } = render(PunditPickerCard, { props: { persona: voice } });
    expect(body).toContain('data-picker-locked="false"');
    expect(body).not.toMatch(/data-picker-lock\b(?!ed)/);
    expect(body).not.toContain('aria-disabled="true"');
  });

  it('derives the shield monogram from the persona short label', () => {
    const macca = getPersona('scouser');
    const { body } = render(PunditPickerCard, { props: { persona: macca } });
    const shieldTag = body.match(/<span\b[^>]*data-picker-shield[^>]*>([\s\S]*?)<\/span>/);
    expect(shieldTag, 'expected a span carrying data-picker-shield').not.toBeNull();
    expect(shieldTag![1].trim()).toMatch(/^[A-Z]{1,2}$/);
  });
});
