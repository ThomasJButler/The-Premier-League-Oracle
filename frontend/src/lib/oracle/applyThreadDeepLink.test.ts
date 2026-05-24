import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { threadsStore } from '$lib/stores/threads';
import { applyThreadDeepLink } from './applyThreadDeepLink';

describe('applyThreadDeepLink', () => {
  afterEach(() => {
    threadsStore.clearAll();
  });

  it('returns false and does not mutate state for nullish ids', () => {
    threadsStore.createThread();
    const before = get(threadsStore).activeThreadId;
    expect(applyThreadDeepLink(null)).toBe(false);
    expect(applyThreadDeepLink(undefined)).toBe(false);
    expect(applyThreadDeepLink('')).toBe(false);
    expect(get(threadsStore).activeThreadId).toBe(before);
  });

  it('returns false and does not change active thread for unknown ids', () => {
    const a = threadsStore.createThread();
    const b = threadsStore.createThread();
    threadsStore.setActive(b.id);
    expect(applyThreadDeepLink('does-not-exist')).toBe(false);
    expect(get(threadsStore).activeThreadId).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });

  it('activates the matching thread when the id exists', () => {
    const a = threadsStore.createThread();
    const b = threadsStore.createThread();
    threadsStore.setActive(b.id);
    expect(applyThreadDeepLink(a.id)).toBe(true);
    expect(get(threadsStore).activeThreadId).toBe(a.id);
  });
});
