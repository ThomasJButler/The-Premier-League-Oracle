import { describe, expect, it } from 'vitest';
import { getColumn, listColumns, listColumnSlugs } from './columns';
import { PERSONAS, isPersonaId } from '$lib/personas';

describe('columns fixture', () => {
  it('ships at least three sample columns', () => {
    expect(listColumns().length).toBeGreaterThanOrEqual(3);
  });

  it('every column slug round-trips through getColumn', () => {
    for (const slug of listColumnSlugs()) {
      const col = getColumn(slug);
      expect(col).toBeDefined();
      expect(col!.slug).toBe(slug);
    }
  });

  it('returns undefined for an unknown slug', () => {
    expect(getColumn('not-a-real-slug')).toBeUndefined();
  });

  it('every column references a real persona id', () => {
    for (const col of listColumns()) {
      expect(isPersonaId(col.byline.personaId)).toBe(true);
      expect(PERSONAS[col.byline.personaId]).toBeDefined();
    }
  });

  it('every column has a non-empty headline and body, and a pull quote with attribution', () => {
    for (const col of listColumns()) {
      expect(col.headline.length).toBeGreaterThan(0);
      expect(col.headline.some((s) => s.text.trim().length > 0)).toBe(true);
      expect(col.dropCapIntro.length).toBeGreaterThan(0);
      expect(col.body.length).toBeGreaterThan(0);
      expect(col.pullQuote.body.length).toBeGreaterThan(0);
      expect(col.pullQuote.attribution.length).toBeGreaterThan(0);
    }
  });

  it('no column contains betting copy', () => {
    for (const col of listColumns()) {
      const blob = [
        col.eyebrow,
        ...col.headline.map((h) => h.text),
        col.dropCapIntro,
        col.pullQuote.body,
        col.pullQuote.attribution,
        ...col.body,
        col.cheers?.gloriouslyUseless ?? ''
      ].join(' ');
      expect(blob).not.toMatch(/value bet|bankroll|kelly/i);
    }
  });
});
