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
  accuracyStats: { brier: 0.193, rps: 0.187, calibration: 1.02, sampleSize: 152, scoredSampleSize: 148 },
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
    expect(prompt).toContain('RPS 0.187');
    expect(prompt).toContain('scored n=148 of 152 settled');
  });

  it('refuses to cite accuracy numbers when nothing has been probability-scored', () => {
    const ctx = fixtureContext();
    ctx.accuracyStats = { brier: 0, rps: 0, calibration: 0, sampleSize: 12, scoredSampleSize: 0 };
    const prompt = buildSystemPrompt(getPersona('voice'), ctx);
    expect(prompt).not.toContain('Brier 0.000');
    expect(prompt).not.toContain('RPS 0.000');
    expect(prompt).toContain('do not cite Brier/RPS numbers');
  });

  it('labels fit-time walk-forward evidence as such — provenance is honesty', () => {
    const ctx = fixtureContext();
    ctx.accuracyStats = {
      brier: 0.6, rps: 0.2, calibration: 0.97,
      sampleSize: 2660, scoredSampleSize: 2660, source: 'backtest',
    };
    const prompt = buildSystemPrompt(getPersona('voice'), ctx);
    expect(prompt).toContain('walk-forward backtest evidence');
    expect(prompt).toContain('2660 historical matches');
  });

  it('teaches every persona how to emit [[FIXTURE:…]] and [[CHEERS:…]] tokens', () => {
    const personaIds = ['voice', 'scouser', 'manc', 'hardman', 'philosopher', 'optimist', 'volcano', 'chaos', 'charmer', 'wanderer'] as const;
    for (const id of personaIds) {
      const prompt = buildSystemPrompt(getPersona(id), fixtureContext());
      expect(prompt).toContain('[[FIXTURE:HOME-AWAY]]');
      expect(prompt).toContain('[[CHEERS:stat|label|text]]');
    }
  });

  it('places token instructions after the live model context so personas see fixtures first', () => {
    const prompt = buildSystemPrompt(getPersona('voice'), fixtureContext());
    const contextEnd = prompt.indexOf('--- END CONTEXT ---');
    const tokenBlock = prompt.indexOf('--- INLINE TOKEN FORMATS');
    expect(contextEnd).toBeGreaterThan(-1);
    expect(tokenBlock).toBeGreaterThan(contextEnd);
  });
});
