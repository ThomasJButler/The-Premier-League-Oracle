import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import NotificationItem from './NotificationItem.svelte';
import type { NotificationItem as NItem } from '$lib/stores/notificationsFeed';

function make(overrides: Partial<NItem> = {}): NItem {
  return {
    id: 'n1',
    type: 'match-start',
    title: 'Arsenal v Liverpool kicks off',
    body: 'Anfield · 16:30',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    read: false,
    ...overrides
  };
}

describe('NotificationItem — K1f-α', () => {
  it('renders the canonical markers and content', () => {
    const { body } = render(NotificationItem, { props: { item: make() } });
    expect(body).toContain('data-notification-item="n1"');
    expect(body).toContain('data-notification-type="match-start"');
    expect(body).toContain('data-notification-read="false"');
    expect(body).toContain('KICK-OFF');
    expect(body).toContain('Arsenal v Liverpool kicks off');
    expect(body).toContain('Anfield · 16:30');
  });

  it('shows the unread dot only when item.read is false', () => {
    const unread = render(NotificationItem, { props: { item: make({ read: false }) } }).body;
    expect(unread).toContain('data-notification-unread-dot');
    const read = render(NotificationItem, { props: { item: make({ read: true }) } }).body;
    expect(read).not.toContain('data-notification-unread-dot');
    expect(read).toContain('data-notification-read="true"');
  });

  it('maps each notification type to its readable label', () => {
    const edge = render(NotificationItem, { props: { item: make({ type: 'model-edge' }) } }).body;
    expect(edge).toContain('MODEL EDGE');
    const broadsheet = render(NotificationItem, {
      props: { item: make({ type: 'broadsheet-ready' }) }
    }).body;
    expect(broadsheet).toContain('BROADSHEET');
  });

  it('uses a CSS variable for the type label colour (no inline hex)', () => {
    const { body } = render(NotificationItem, { props: { item: make() } });
    const label = body.match(/<span\b[^>]*data-notification-type-label[^>]*>/);
    expect(label).not.toBeNull();
    expect(label![0]).toContain('var(--persona-accent');
    expect(label![0]).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('renders mobile + desktop templates with both wrappers (K2a-β.5)', () => {
    const { body } = render(NotificationItem, { props: { item: make() } });
    expect(body).toContain('data-notification-mobile');
    expect(body).toContain('data-notification-desktop');
    const mobileWrap = body.match(/<div\b[^>]*data-notification-mobile[^>]*>/);
    expect(mobileWrap).not.toBeNull();
    expect(mobileWrap![0]).toContain('lg:hidden');
    const desktopWrap = body.match(/<div\b[^>]*data-notification-desktop[^>]*>/);
    expect(desktopWrap).not.toBeNull();
    expect(desktopWrap![0]).toContain('hidden');
    expect(desktopWrap![0]).toContain('lg:grid');
  });

  it('has no betting copy', () => {
    const { body } = render(NotificationItem, {
      props: { item: make({ title: 'Edge on the model', body: 'Plain analysis text.' }) }
    });
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
