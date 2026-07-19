import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  MAX_ITEMS,
  addNotification,
  clearAll,
  markAllRead,
  markRead,
  readNotifications
} from './notificationsFeed';

describe('notificationsFeed store — K1f-α', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('returns [] when storage is empty', () => {
    expect(readNotifications()).toEqual([]);
  });

  it('addNotification prepends newest-first and persists', () => {
    addNotification({ type: 'match-start', title: 'First', body: 'one' });
    addNotification({ type: 'model-edge', title: 'Second', body: 'two' });
    const list = readNotifications();
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('Second');
    expect(list[1].title).toBe('First');
    expect(list[0].read).toBe(false);
    expect(list[0].id).toBeTruthy();
    expect(list[0].createdAt).toBeTruthy();
  });

  it('caps stored items at MAX_ITEMS', () => {
    for (let i = 0; i < MAX_ITEMS + 5; i++) {
      addNotification({ type: 'match-start', title: `t${i}`, body: 'b' });
    }
    expect(readNotifications()).toHaveLength(MAX_ITEMS);
  });

  it('markRead flips one item and leaves others alone', () => {
    addNotification({ id: 'a', type: 'match-start', title: 'A', body: '' });
    addNotification({ id: 'b', type: 'model-edge', title: 'B', body: '' });
    markRead('a');
    const list = readNotifications();
    expect(list.find((n) => n.id === 'a')?.read).toBe(true);
    expect(list.find((n) => n.id === 'b')?.read).toBe(false);
  });

  it('markAllRead flips every item', () => {
    addNotification({ type: 'match-start', title: 'A', body: '' });
    addNotification({ type: 'broadsheet-ready', title: 'B', body: '' });
    markAllRead();
    expect(readNotifications().every((n) => n.read)).toBe(true);
  });

  it('clearAll empties the store', () => {
    addNotification({ type: 'match-start', title: 'A', body: '' });
    clearAll();
    expect(readNotifications()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('recovers from corrupt JSON by returning []', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readNotifications()).toEqual([]);
  });

  it('filters out entries with invalid types (no value-bet)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'x', type: 'value-bet', title: 'shady', body: '', createdAt: '2026-01-01', read: false },
        { id: 'y', type: 'match-start', title: 'ok', body: '', createdAt: '2026-01-01', read: false }
      ])
    );
    const list = readNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('y');
  });

  it('round-trips a rumours-typed item (T6)', () => {
    addNotification({ type: 'rumours', title: "Macca's on it", body: 'First take.', href: '/rumours' });
    const list = readNotifications();
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('rumours');
    expect(list[0].href).toBe('/rumours');
  });

  it('filters out partial entries missing required fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'x', type: 'match-start' }, null, 'string'])
    );
    expect(readNotifications()).toEqual([]);
  });
});
