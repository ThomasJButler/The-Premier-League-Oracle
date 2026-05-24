import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SearchResultRow from './SearchResultRow.svelte';
import type { SearchItem } from '$lib/search/buildIndex';

const fixtureItem: SearchItem = {
  kind: 'fixture',
  id: 'm1',
  label: 'Arsenal v Liverpool',
  sub: '2026-05-24 · GW38',
  href: '/fixtures/m1',
  tokens: [],
};

const playerItem: SearchItem = {
  kind: 'player',
  id: 'player-1',
  label: 'Mohamed Salah',
  sub: 'Liverpool · 22 goals',
  tokens: [],
};

describe('SearchResultRow', () => {
  it('renders an anchor with href + markers when item.href is set', () => {
    const { body } = render(SearchResultRow, { props: { item: fixtureItem } });
    expect(body).toContain('data-search-result');
    expect(body).toContain('data-search-result-kind="fixture"');
    expect(body).toContain('data-search-result-id="m1"');
    expect(body).toContain('href="/fixtures/m1"');
    expect(body).toContain('FIXTURE');
    expect(body).toContain('Arsenal v Liverpool');
    expect(body).toContain('2026-05-24 · GW38');
  });

  it('renders a non-interactive div when href is absent (player variant)', () => {
    const { body } = render(SearchResultRow, { props: { item: playerItem } });
    expect(body).toContain('data-search-result-kind="player"');
    expect(body).toContain('Mohamed Salah');
    expect(body).toContain('PLAYER');
    expect(body).not.toMatch(/<a\b[^>]*data-search-result\b/);
  });

  it('drives the kind label colour off the persona accent CSS var (no inline hex)', () => {
    const { body } = render(SearchResultRow, { props: { item: fixtureItem } });
    expect(body).toContain('var(--persona-accent, var(--red))');
    expect(body).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,6}/);
  });

  it('omits sub line when item.sub is undefined', () => {
    const noSub: SearchItem = { ...fixtureItem, sub: undefined };
    const { body } = render(SearchResultRow, { props: { item: noSub } });
    expect(body).not.toContain('data-search-result-sub');
  });

  it('has no betting copy', () => {
    const { body } = render(SearchResultRow, { props: { item: fixtureItem } });
    expect(body).not.toMatch(/value bet|bankroll|kelly/i);
  });
});
