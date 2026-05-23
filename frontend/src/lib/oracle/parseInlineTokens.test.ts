import { describe, it, expect } from 'vitest';
import { parseInlineTokens } from './parseInlineTokens';

describe('parseInlineTokens', () => {
  it('returns [] for empty input', () => {
    expect(parseInlineTokens('')).toEqual([]);
  });

  it('returns a single text segment for plain prose', () => {
    expect(parseInlineTokens('Saturday is going to be a riot.')).toEqual([
      { kind: 'text', value: 'Saturday is going to be a riot.' }
    ]);
  });

  it('parses a single FIXTURE token', () => {
    expect(parseInlineTokens('[[FIXTURE:ARS-LIV]]')).toEqual([
      { kind: 'fixture', home: 'ARS', away: 'LIV' }
    ]);
  });

  it('parses a single CHEERS token (stat/label/text)', () => {
    expect(parseInlineTokens('[[CHEERS:87%|XG VS FORM|Glorious in its uselessness.]]')).toEqual([
      {
        kind: 'cheers',
        stat: '87%',
        label: 'XG VS FORM',
        text: 'Glorious in its uselessness.'
      }
    ]);
  });

  it('preserves order across text + FIXTURE + text + CHEERS + text', () => {
    const segs = parseInlineTokens(
      'Going to be tasty: [[FIXTURE:ARS-LIV]] — and don’t forget [[CHEERS:3|RED CARDS|Worth a pint.]] cheers.'
    );
    expect(segs).toEqual([
      { kind: 'text', value: 'Going to be tasty: ' },
      { kind: 'fixture', home: 'ARS', away: 'LIV' },
      { kind: 'text', value: ' — and don’t forget ' },
      { kind: 'cheers', stat: '3', label: 'RED CARDS', text: 'Worth a pint.' },
      { kind: 'text', value: ' cheers.' }
    ]);
  });

  it('keeps malformed FIXTURE (no dash) as verbatim text', () => {
    expect(parseInlineTokens('look at [[FIXTURE:ARS]] now')).toEqual([
      { kind: 'text', value: 'look at ' },
      { kind: 'text', value: '[[FIXTURE:ARS]]' },
      { kind: 'text', value: ' now' }
    ]);
  });

  it('keeps malformed CHEERS (<3 pipe parts) as verbatim text', () => {
    expect(parseInlineTokens('[[CHEERS:only|two]]')).toEqual([
      { kind: 'text', value: '[[CHEERS:only|two]]' }
    ]);
  });

  it('treats extra | inside CHEERS body as part of the text segment', () => {
    expect(parseInlineTokens('[[CHEERS:1|FACT|a | b | c]]')).toEqual([
      { kind: 'cheers', stat: '1', label: 'FACT', text: 'a | b | c' }
    ]);
  });
});
