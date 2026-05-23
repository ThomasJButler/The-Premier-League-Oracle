import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LiveScoreboard from './LiveScoreboard.svelte';
import type { Fixture } from '../../../types/redesign';

const SOURCE = readFileSync(
  fileURLToPath(new URL('./LiveScoreboard.svelte', import.meta.url)),
  'utf8'
);

const fixture: Fixture = {
  id: 'pl-99-arsliv',
  competition: 'Premier League',
  gameweek: 12,
  utcDate: '2026-06-07T14:00:00Z',
  status: 'LIVE',
  minute: 67,
  home: { abbr: 'ARS', name: 'Arsenal' },
  away: { abbr: 'LIV', name: 'Liverpool' },
  score: { home: 2, away: 1 },
};

describe('LiveScoreboard', () => {
  it('renders the scoreboard marker, score and minute', () => {
    const { body } = render(LiveScoreboard, { props: { fixture } });
    expect(body).toContain('data-live-scoreboard');
    expect(body).toContain("LIVE · 67'");
    expect(body).toContain('data-live-score');
    expect(body).toContain('Arsenal');
    expect(body).toContain('Liverpool');
    expect(body).toContain('HOME · ARS');
    expect(body).toContain('AWAY · LIV');
  });

  it('renders the pulse dot inside the status pill', () => {
    const { body } = render(LiveScoreboard, { props: { fixture } });
    expect(body).toContain('data-live-dot');
  });

  it('source declares a prefers-reduced-motion rule that cancels the pulse', () => {
    expect(SOURCE).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = SOURCE.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/
    );
    expect(block, 'reduced-motion media block should exist').not.toBeNull();
    expect(block![0]).toMatch(/animation:\s*none/);
  });

  it('renders no betting copy', () => {
    const { body } = render(LiveScoreboard, { props: { fixture } });
    expect(body).not.toMatch(/value bet/i);
    expect(body).not.toMatch(/bankroll/i);
    expect(body).not.toMatch(/kelly/i);
  });
});
