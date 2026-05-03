import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './buildSystemPrompt';
import { getPersona } from '$lib/personas';
import type { KickerContext } from '$lib/context/types';

const fixtureContext = (): KickerContext => ({
  fixtures: [
    {
      id: 'm-1',
      home: 'Arsenal',
      away: 'Liverpool',
      kickoff: '2026-05-10T14:00:00Z',
      ourProb: { home: 0.42, draw: 0.27, away: 0.31 },
      marketImplied: { home: 0.4, draw: 0.28, away: 0.32 },
      valueEdge: 0.04
    }
  ],
  standings: [
    { position: 1, team: 'Liverpool', played: 36, points: 84, goalDifference: 47 }
  ],
  accuracyStats: { brier: 0.193, calibration: 1.02, sampleSize: 152 },
  generatedAt: '2026-05-03T12:00:00Z'
});

describe('buildSystemPrompt', () => {
  it('includes the persona system prompt verbatim at the top', () => {
    const persona = getPersona('voice');
    const prompt = buildSystemPrompt(persona, fixtureContext());
    expect(prompt.startsWith(persona.systemPrompt)).toBe(true);
  });

  it('injects ourProb percentages into the prompt (moat contract)', () => {
    const prompt = buildSystemPrompt(getPersona('scouser'), fixtureContext());
    expect(prompt).toContain('Arsenal v Liverpool');
    expect(prompt).toContain('H 42%');
    expect(prompt).toContain('D 27%');
    expect(prompt).toContain('A 31%');
  });

  it('injects market and value edge when present', () => {
    const prompt = buildSystemPrompt(getPersona('scouser'), fixtureContext());
    expect(prompt).toContain('market H 40%');
    expect(prompt).toContain('edge +4.0pp');
  });

  it('omits market/edge gracefully when not provided', () => {
    const ctx = fixtureContext();
    delete ctx.fixtures[0].marketImplied;
    delete ctx.fixtures[0].valueEdge;
    const prompt = buildSystemPrompt(getPersona('voice'), ctx);
    expect(prompt).not.toContain('market');
    expect(prompt).not.toContain('edge');
  });

  it('renders accuracy stats and a placeholder when no fixtures', () => {
    const ctx = fixtureContext();
    ctx.fixtures = [];
    const prompt = buildSystemPrompt(getPersona('voice'), ctx);
    expect(prompt).toContain('no upcoming fixtures available');
    expect(prompt).toContain('Brier 0.193');
    expect(prompt).toContain('n=152');
  });
});
