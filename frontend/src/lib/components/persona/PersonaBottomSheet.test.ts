import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'svelte/server';
import PersonaBottomSheet from './PersonaBottomSheet.svelte';
import { personaStore } from '$lib/stores/persona';
import { KICKER_PERSONA_ORDER, getPersona } from '$lib/personas';

describe('PersonaBottomSheet', () => {
  beforeEach(() => {
    // Reset to default so renders are deterministic.
    personaStore.set('voice');
  });

  it('renders the trigger chip with the active persona short label and closed aria-expanded by default', () => {
    const { body } = render(PersonaBottomSheet);
    expect(body).toContain('data-persona-trigger');
    expect(body).toContain('aria-expanded="false"');
    expect(body).toContain('data-persona-trigger-name');
    expect(body).toContain(getPersona('voice').short);
  });

  it('omits the sheet, backdrop, and close button when closed', () => {
    const { body } = render(PersonaBottomSheet, { props: { open: false } });
    expect(body).not.toContain('data-persona-sheet');
    expect(body).not.toContain('data-persona-backdrop');
    expect(body).not.toContain('data-persona-close');
  });

  it('renders the sheet, backdrop, close button, and one card per persona when open', () => {
    const { body } = render(PersonaBottomSheet, { props: { open: true } });
    expect(body).toContain('data-persona-sheet');
    expect(body).toContain('data-persona-backdrop');
    expect(body).toContain('data-persona-close');
    expect(body).toContain('aria-expanded="true"');
    expect(body).toContain('role="dialog"');
    expect(body).toContain('aria-modal="true"');

    for (const id of KICKER_PERSONA_ORDER) {
      expect(body).toContain(`data-picker-id="${id}"`);
    }
  });

  it('marks the active persona card as selected inside the open sheet', () => {
    personaStore.set('scouser');
    const { body } = render(PersonaBottomSheet, { props: { open: true } });
    expect(body).toMatch(
      /<button\b[^>]*data-picker-id="scouser"[^>]*data-picker-selected="true"/
    );
    // The trigger should reflect the new active persona too.
    expect(body).toContain(getPersona('scouser').short);
  });
});
