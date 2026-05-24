import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import VoiceColumn from './VoiceColumn.svelte';
import { getPersona } from '$lib/personas';
import { getVoiceTake } from '$lib/fixtures/voiceTakes';

describe('VoiceColumn', () => {
  const persona = getPersona('voice');
  const take = getVoiceTake('voice');

  it('renders the persona header, take open/aside body, and pick + confidence footer', () => {
    const { body } = render(VoiceColumn, { props: { persona, take } });
    expect(body).toContain('data-voice-column');
    expect(body).toContain('data-voice-id="voice"');
    expect(body).toContain('data-voice-name');
    expect(body).toContain(persona.name);
    expect(body).toContain('VOICE');
    expect(body).toContain('data-voice-open');
    expect(body).toContain(take.open);
    expect(body).toContain('data-voice-aside');
    expect(body).toContain(take.aside);
    expect(body).toContain('data-voice-pick');
    expect(body).toContain(take.pick);
    expect(body).toContain('data-voice-conf');
    expect(body).toContain(`${take.conf}%`);
  });

  it('marks data-voice-selected="false" and omits the accent state when not selected', () => {
    const { body } = render(VoiceColumn, { props: { persona, take, selected: false } });
    expect(body).toContain('data-voice-selected="false"');
    expect(body).not.toContain('is-selected');
    expect(body).toContain('aria-pressed="false"');
  });

  it('flips data-voice-selected="true" and aria-pressed when selected', () => {
    const { body } = render(VoiceColumn, { props: { persona, take, selected: true } });
    expect(body).toContain('data-voice-selected="true"');
    expect(body).toContain('is-selected');
    expect(body).toContain('aria-pressed="true"');
  });

  it('has no inline hex colours — accent state goes through CSS var', () => {
    const { body } = render(VoiceColumn, { props: { persona, take, selected: true } });
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('has no betting copy', () => {
    const { body } = render(VoiceColumn, { props: { persona, take } });
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
