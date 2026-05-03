import { describe, expect, it } from 'vitest';
import { KICKER_PERSONA_ORDER, PERSONAS, isPersonaId, type PersonaId } from './index';

const REAL_PUNDIT_DENY_LIST = [
  'gary lineker',
  'alan shearer',
  'jamie carragher',
  'gary neville',
  'jermaine jenas',
  'ian wright',
  'micah richards',
  'roy keane',
  'jose mourinho',
  'alex ferguson',
  'peter drury',
  'martin tyler',
  'thierry henry',
  'graeme souness',
  'roy hodgson'
];

describe('KICKER_PERSONA_ORDER', () => {
  it('lists all 10 personas in canonical order', () => {
    expect(KICKER_PERSONA_ORDER).toEqual([
      'voice',
      'scouser',
      'manc',
      'charmer',
      'hardman',
      'volcano',
      'wanderer',
      'philosopher',
      'chaos',
      'optimist'
    ]);
  });

  it('contains every key in PERSONAS exactly once', () => {
    const keys = Object.keys(PERSONAS) as PersonaId[];
    expect(keys).toHaveLength(KICKER_PERSONA_ORDER.length);
    for (const id of KICKER_PERSONA_ORDER) {
      expect(keys).toContain(id);
    }
  });
});

describe('PersonaConfig integrity', () => {
  for (const id of KICKER_PERSONA_ORDER) {
    describe(id, () => {
      const persona = PERSONAS[id];

      it('has matching id field', () => {
        expect(persona.id).toBe(id);
      });

      it('populates every required string field', () => {
        for (const field of [
          'name',
          'short',
          'region',
          'accent',
          'tic',
          'voice',
          'systemPrompt'
        ] as const) {
          expect(typeof persona[field]).toBe('string');
          expect(persona[field].trim().length).toBeGreaterThan(0);
        }
      });

      it('uses a 7-char hex accent', () => {
        expect(persona.accent).toMatch(/^#[0-9a-f]{6}$/i);
      });

      it('appends the invariant scaffold to systemPrompt', () => {
        expect(persona.systemPrompt).toContain(
          'Never name real Premier League pundits, broadcasters, or commentators.'
        );
        expect(persona.systemPrompt).toContain('[[CHEERS:stat|label|text]]');
        expect(persona.systemPrompt).toContain('[[FIXTURE:HOME-AWAY]]');
      });

      it('does not name any real pundit', () => {
        const haystack = `${persona.name} ${persona.systemPrompt} ${persona.voice} ${persona.tic}`.toLowerCase();
        for (const banned of REAL_PUNDIT_DENY_LIST) {
          expect(haystack).not.toContain(banned);
        }
      });
    });
  }
});

describe('accent uniqueness', () => {
  it('assigns a distinct accent to every persona', () => {
    const accents = KICKER_PERSONA_ORDER.map((id) => PERSONAS[id].accent.toLowerCase());
    expect(new Set(accents).size).toBe(accents.length);
  });
});

describe('isPersonaId', () => {
  it('accepts every canonical id', () => {
    for (const id of KICKER_PERSONA_ORDER) {
      expect(isPersonaId(id)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isPersonaId('macca')).toBe(false);
    expect(isPersonaId('')).toBe(false);
    expect(isPersonaId(null)).toBe(false);
    expect(isPersonaId(undefined)).toBe(false);
    expect(isPersonaId(42)).toBe(false);
  });
});
