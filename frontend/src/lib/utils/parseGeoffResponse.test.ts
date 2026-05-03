import { describe, it, expect } from 'vitest';
import { parseGeoffResponse } from './parseGeoffResponse';

describe('parseGeoffResponse', () => {
  it('returns a single text part for plain prose', () => {
    expect(parseGeoffResponse('to be fair to him, Liverpool look sharp')).toEqual([
      { type: 'text', content: 'to be fair to him, Liverpool look sharp' }
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseGeoffResponse('')).toEqual([]);
  });

  it('parses a single FIXTURE token', () => {
    expect(parseGeoffResponse('[[FIXTURE:LIV-TOT]]')).toEqual([
      { type: 'fixture', home: 'LIV', away: 'TOT' }
    ]);
  });

  it('parses a single CHEERS token with stat | label | content', () => {
    const out = parseGeoffResponse('[[CHEERS:73%|model edge|maccas pick is firing]]');
    expect(out).toEqual([
      { type: 'cheers', stat: '73%', label: 'model edge', content: 'maccas pick is firing' }
    ]);
  });

  it('interleaves text + FIXTURE + CHEERS in order', () => {
    const text = 'before [[FIXTURE:ARS-CHE]] middle [[CHEERS:1.8x|edge|value]] after';
    expect(parseGeoffResponse(text)).toEqual([
      { type: 'text', content: 'before ' },
      { type: 'fixture', home: 'ARS', away: 'CHE' },
      { type: 'text', content: ' middle ' },
      { type: 'cheers', stat: '1.8x', label: 'edge', content: 'value' },
      { type: 'text', content: ' after' }
    ]);
  });

  it('treats malformed tokens as plain text and degrades gracefully', () => {
    // Wrong tag name → no match, kept as text.
    expect(parseGeoffResponse('[[BOGUS:LIV-TOT]] tail')).toEqual([
      { type: 'text', content: '[[BOGUS:LIV-TOT]] tail' }
    ]);
  });

  it('handles multi-line prose around tokens', () => {
    const text = 'line one\n[[FIXTURE:LIV-MCI]]\nline three';
    expect(parseGeoffResponse(text)).toEqual([
      { type: 'text', content: 'line one\n' },
      { type: 'fixture', home: 'LIV', away: 'MCI' },
      { type: 'text', content: '\nline three' }
    ]);
  });

  it('treats partial FIXTURE without dash as home-only with empty away', () => {
    expect(parseGeoffResponse('[[FIXTURE:LIV]]')).toEqual([
      { type: 'fixture', home: 'LIV', away: '' }
    ]);
  });

  it('treats CHEERS missing label/content as empty strings', () => {
    expect(parseGeoffResponse('[[CHEERS:42%]]')).toEqual([
      { type: 'cheers', stat: '42%', label: '', content: '' }
    ]);
  });

  it('parses two adjacent FIXTURE tokens without text in between', () => {
    expect(parseGeoffResponse('[[FIXTURE:LIV-TOT]][[FIXTURE:ARS-CHE]]')).toEqual([
      { type: 'fixture', home: 'LIV', away: 'TOT' },
      { type: 'fixture', home: 'ARS', away: 'CHE' }
    ]);
  });

  it('keeps unmatched single-bracket sequences as text', () => {
    expect(parseGeoffResponse('see [single] brackets')).toEqual([
      { type: 'text', content: 'see [single] brackets' }
    ]);
  });

  it('is safe to call repeatedly (no regex lastIndex carryover)', () => {
    const first = parseGeoffResponse('[[FIXTURE:LIV-TOT]] one');
    const second = parseGeoffResponse('[[FIXTURE:ARS-CHE]] two');
    expect(first).toEqual([
      { type: 'fixture', home: 'LIV', away: 'TOT' },
      { type: 'text', content: ' one' }
    ]);
    expect(second).toEqual([
      { type: 'fixture', home: 'ARS', away: 'CHE' },
      { type: 'text', content: ' two' }
    ]);
  });
});
