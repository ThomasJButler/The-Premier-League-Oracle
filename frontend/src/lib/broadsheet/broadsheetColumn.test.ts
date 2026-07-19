import { describe, expect, it } from 'vitest';
import {
  buildColumnSlug,
  parseColumnSlug,
  cachedBroadsheetToColumn
} from './broadsheetColumn';
import type { CachedBroadsheet } from '$lib/stores/broadsheetStore';
import type { BroadsheetJson } from '$lib/server/broadsheetPrompt';
import { getPersona } from '$lib/personas';
import { listColumnSlugs } from '$lib/fixtures/columns';

function cached(overrides: Partial<BroadsheetJson> = {}, meta: Partial<CachedBroadsheet> = {}): CachedBroadsheet {
  const broadsheet: BroadsheetJson = {
    headline: 'City edge it in the rain',
    standfirst: 'A gameweek that promised chaos and delivered a masterclass in restraint.',
    byline: 'By The Voice',
    sections: [
      { heading: 'THE BIG ONE', body: 'City host United on Saturday. The model likes the champions. It always does.' },
      { heading: 'THE UNDERCARD', body: 'Everton travel to Brighton in a fixture the model rates a coin toss.' }
    ],
    pullQuote: 'The model has seen this film before and it ends with a parade.',
    closingLine: 'And that, as ever, is football.',
    ...overrides
  };
  return {
    gameweek: 34,
    personaId: 'voice',
    broadsheet,
    generatedAt: '2026-07-17T14:30:00.000Z',
    ...meta
  };
}

describe('broadsheetColumn — slug helpers', () => {
  it('buildColumnSlug composes the gw{N}-{personaId} scheme', () => {
    expect(buildColumnSlug(34, 'voice')).toBe('gw34-voice');
    expect(buildColumnSlug(1, 'scouser')).toBe('gw1-scouser');
  });

  it('parseColumnSlug round-trips a built slug', () => {
    expect(parseColumnSlug(buildColumnSlug(34, 'voice'))).toEqual({ gameweek: 34, personaId: 'voice' });
    expect(parseColumnSlug('gw7-volcano')).toEqual({ gameweek: 7, personaId: 'volcano' });
  });

  it('parseColumnSlug rejects an unknown persona segment', () => {
    expect(parseColumnSlug('gw34-nobody')).toBeNull();
    expect(parseColumnSlug('gw34-VOICE')).toBeNull(); // regex is lowercase-anchored
  });

  it('parseColumnSlug rejects malformed slugs', () => {
    expect(parseColumnSlug('gw-voice')).toBeNull();
    expect(parseColumnSlug('gw0-voice')).toBeNull(); // gameweek must be positive
    expect(parseColumnSlug('34-voice')).toBeNull();
    expect(parseColumnSlug('gwabc-voice')).toBeNull();
    expect(parseColumnSlug('')).toBeNull();
  });

  it('parseColumnSlug never collides with the three static column slugs', () => {
    for (const slug of listColumnSlugs()) {
      expect(parseColumnSlug(slug)).toBeNull();
    }
  });
});

describe('broadsheetColumn — cachedBroadsheetToColumn adapter', () => {
  it('maps the core fields into a ColumnRecord', () => {
    const record = cachedBroadsheetToColumn(cached());
    expect(record.slug).toBe('gw34-voice');
    expect(record.eyebrow).toBe('GAMEWEEK 34 · BROADSHEET');
    expect(record.headline).toEqual([{ text: 'City edge it in the rain' }]);
    expect(record.dropCapIntro).toBe(
      'A gameweek that promised chaos and delivered a masterclass in restraint.'
    );
    expect(record.byline.personaId).toBe('voice');
    expect(record.byline.sub).toBe('By The Voice');
    expect(record.byline.readTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('weaves each section heading into its body paragraph, in order', () => {
    const record = cachedBroadsheetToColumn(cached());
    expect(record.body[0]).toBe(
      'THE BIG ONE — City host United on Saturday. The model likes the champions. It always does.'
    );
    expect(record.body[1]).toBe(
      'THE UNDERCARD — Everton travel to Brighton in a fixture the model rates a coin toss.'
    );
  });

  it('attributes the pull quote to the persona display name', () => {
    const record = cachedBroadsheetToColumn(cached());
    expect(record.pullQuote.attribution).toBe(getPersona('voice').name);
    expect(record.pullQuote.body).toBe(
      'The model has seen this film before and it ends with a parade.'
    );
  });

  it('appends the closing line to the body when the pull quote is present (closing not consumed)', () => {
    const record = cachedBroadsheetToColumn(cached());
    expect(record.body).toContain('And that, as ever, is football.');
    // pull quote came from broadsheet.pullQuote, closing line lives in the body
    expect(record.pullQuote.body).not.toBe('And that, as ever, is football.');
  });

  it('formats the dateline from generatedAt (UTC, uppercase WEEKDAY, D MONTH)', () => {
    // 2026-07-17 is a Friday.
    const record = cachedBroadsheetToColumn(cached());
    expect(record.byline.dateline).toBe('FRIDAY, 17 JULY');
  });

  it('NO-PULLQUOTE case: falls back to the closing line and marks it consumed', () => {
    const record = cachedBroadsheetToColumn(cached({ pullQuote: undefined }));
    expect(record.pullQuote.body).toBe('And that, as ever, is football.');
    // consumed → NOT also duplicated into the body
    expect(record.body).not.toContain('And that, as ever, is football.');
  });

  it('NO-PULLQUOTE and NO-CLOSINGLINE case: falls back to the first sentence of section 1', () => {
    const record = cachedBroadsheetToColumn(
      cached({ pullQuote: undefined, closingLine: undefined })
    );
    expect(record.pullQuote.body).toBe('City host United on Saturday.');
    // pull quote is never undefined — the renderer reads .body unconditionally
    expect(typeof record.pullQuote.body).toBe('string');
    expect(record.pullQuote.body.length).toBeGreaterThan(0);
  });

  it('empty-everything case: falls back to the standfirst and never throws', () => {
    const record = cachedBroadsheetToColumn(
      cached({ pullQuote: undefined, closingLine: undefined, sections: [] })
    );
    expect(record.pullQuote.body).toBe(
      'A gameweek that promised chaos and delivered a masterclass in restraint.'
    );
    expect(record.body).toEqual([]);
    expect(record.byline.readTimeMinutes).toBe(1); // min 1
  });

  it('is pure — same input yields a deep-equal record on repeated calls', () => {
    const input = cached();
    expect(cachedBroadsheetToColumn(input)).toEqual(cachedBroadsheetToColumn(input));
  });
});
