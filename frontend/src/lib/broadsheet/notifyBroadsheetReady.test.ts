import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { notifyBroadsheetReady } from './notifyBroadsheetReady';
import { STORAGE_KEY, readNotifications } from '$lib/stores/notificationsFeed';

describe('notifyBroadsheetReady — K1f-α.1 producer', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('writes a broadsheet-ready item with persona-voiced title + headline body + /broadsheet href', () => {
    notifyBroadsheetReady({
      personaId: 'voice',
      personaName: 'The Voice',
      gameweek: 34,
      headline: 'Arsenal are finally boring — and that is the point.'
    });
    const list = readNotifications();
    expect(list).toHaveLength(1);
    const [item] = list;
    expect(item.type).toBe('broadsheet-ready');
    expect(item.title).toBe('GW34 broadsheet filed by The Voice');
    expect(item.body).toBe('Arsenal are finally boring — and that is the point.');
    expect(item.href).toBe('/broadsheet');
    expect(item.read).toBe(false);
    expect(item.id).toMatch(/^broadsheet-ready-gw34-voice-\d+$/);
    // Confirms it landed via the schema-validated store, not a raw write.
    expect(localStorage.getItem(STORAGE_KEY)).toContain('broadsheet-ready');
  });

  it('prepends newest-first when fired twice (e.g. generate + regenerate)', () => {
    notifyBroadsheetReady({
      personaId: 'voice',
      personaName: 'The Voice',
      gameweek: 34,
      headline: 'First take.'
    });
    notifyBroadsheetReady({
      personaId: 'volcano',
      personaName: 'Mickey from Dagenham',
      gameweek: 34,
      headline: 'Second take.'
    });
    const list = readNotifications();
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('GW34 broadsheet filed by Mickey from Dagenham');
    expect(list[1].title).toBe('GW34 broadsheet filed by The Voice');
  });
});
