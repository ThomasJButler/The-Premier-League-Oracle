import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MatchEventRow from './MatchEventRow.svelte';
import type { LiveEvent } from '$lib/fixtures/liveFeed';

const baseEvent: LiveEvent = {
  id: 'e1',
  minute: 27,
  side: 'home',
  teamAbbr: 'ARS',
  player: 'Okafor',
  type: 'GOAL',
  detail: 'Six-yard tap-in.',
};

describe('MatchEventRow', () => {
  it('renders minute, team abbr, player + detail with the canonical markers', () => {
    const { body } = render(MatchEventRow, { props: { event: baseEvent } });
    expect(body).toContain('data-event-row');
    expect(body).toContain('data-event-type="GOAL"');
    expect(body).toContain('data-event-side="home"');
    expect(body).toContain("27'");
    expect(body).toContain('ARS');
    expect(body).toContain('Okafor');
    expect(body).toContain('Six-yard tap-in.');
  });

  it('omits the detail clause when none is provided', () => {
    const { body } = render(MatchEventRow, {
      props: { event: { ...baseEvent, detail: undefined } },
    });
    expect(body).toContain('Okafor');
    expect(body).not.toContain(' — ');
  });
});
