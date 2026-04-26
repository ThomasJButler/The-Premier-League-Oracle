import { describe, it, expect } from 'vitest';
import { classifyZone, zoneRowClass, parseFormString, pointsPerGame } from './standingsHelpers';

describe('classifyZone', () => {
  it('classifies pos 1–4 as ucl', () => {
    expect(classifyZone(1)).toBe('ucl');
    expect(classifyZone(4)).toBe('ucl');
  });
  it('classifies pos 5 as uel', () => {
    expect(classifyZone(5)).toBe('uel');
  });
  it('classifies pos 6–17 as mid', () => {
    expect(classifyZone(6)).toBe('mid');
    expect(classifyZone(17)).toBe('mid');
  });
  it('classifies pos 18–20 as relegation', () => {
    expect(classifyZone(18)).toBe('relegation');
    expect(classifyZone(20)).toBe('relegation');
  });
});

describe('zoneRowClass', () => {
  it('returns the prescribed class strings per zone', () => {
    expect(zoneRowClass('ucl')).toBe('bg-accent/8');
    expect(zoneRowClass('uel')).toBe('bg-accent/4');
    expect(zoneRowClass('relegation')).toBe('bg-destructive/6');
    expect(zoneRowClass('mid')).toBe('');
  });
});

describe('parseFormString', () => {
  it('returns 5 results from a 5-char string', () => {
    expect(parseFormString('WWLDW')).toEqual(['W', 'W', 'L', 'D', 'W']);
  });
  it('pads short strings with "pending" markers up to length 5', () => {
    expect(parseFormString('WL')).toEqual(['W', 'L', 'pending', 'pending', 'pending']);
  });
  it('returns 5 "pending" markers for null input', () => {
    expect(parseFormString(null)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
  });
  it('truncates strings longer than 5', () => {
    expect(parseFormString('WWWWWLD')).toEqual(['W', 'W', 'W', 'W', 'W']);
  });
});

describe('pointsPerGame', () => {
  it('returns 0 when no games played (avoids NaN)', () => {
    expect(pointsPerGame(0, 0)).toBe(0);
  });
  it('returns 2.5 for 25 points in 10 games', () => {
    expect(pointsPerGame(25, 10)).toBe(2.5);
  });
});
