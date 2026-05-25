import { describe, it, expect } from 'vitest';
import { buildFixtureAnalysisPrompt } from './broadsheetPrompt';
import { PERSONAS } from '$lib/personas';

describe('buildFixtureAnalysisPrompt', () => {
  const persona = PERSONAS.voice;
  const fixture = { home: 'Arsenal', away: 'Liverpool', venue: 'Emirates' };
  const prediction = {
    ensemble: { home: 0.45, draw: 0.25, away: 0.3 },
    pick: 'HOME' as const,
    pickConfidence: 0.45,
    keyFactors: ['Arsenal unbeaten at home in 8', 'Liverpool missing two CBs']
  };

  it('forbids betting / value / Kelly copy in the system prompt', () => {
    const { system } = buildFixtureAnalysisPrompt(persona, fixture, prediction);
    expect(system).toMatch(/Never mention betting/);
    expect(system).toMatch(/odds/);
    expect(system).toMatch(/Kelly/);
  });

  it('renders the persona-voice header and model facts', () => {
    const { system, userMessage } = buildFixtureAnalysisPrompt(persona, fixture, prediction);
    expect(system).toContain('Arsenal v Liverpool');
    expect(system).toContain('45%');
    expect(system).toContain('30%');
    expect(system).toContain('Arsenal unbeaten at home in 8');
    expect(userMessage).toContain('Arsenal v Liverpool');
  });
});
