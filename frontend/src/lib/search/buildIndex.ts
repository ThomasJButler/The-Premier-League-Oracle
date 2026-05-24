// Pure full-text index for the morgue search surface.
//
// Builds a typed `SearchItem[]` from the four domain sources (fixtures, scorers,
// seasons, threads), then ranks against a query using a simple exact > prefix >
// substring score. No async, no dataService coupling — tests feed synthetic
// sources directly.

import type { Match } from '../../types';
import type { FDScorer } from '../../services/api/footballData';
import type { SeasonRecord } from '../fixtures/leagueHistory';
import type { OracleThread } from '../stores/threads';

export type SearchItemKind = 'fixture' | 'player' | 'season' | 'thread';

export interface SearchItem {
  kind: SearchItemKind;
  id: string;
  label: string;
  sub?: string;
  href?: string;
  tokens: string[];
}

export interface SearchSourceSnapshot {
  matches: Match[];
  scorers: FDScorer[];
  seasons: readonly SeasonRecord[];
  threads: OracleThread[];
}

function abbr(name: string): string {
  return name.replace(/\b(?:FC|AFC)\b/g, '').trim().slice(0, 3).toUpperCase();
}

function tokenise(...parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    for (const t of p.toLowerCase().split(/[^a-z0-9]+/)) {
      if (t.length > 0) out.push(t);
    }
  }
  return out;
}

function fixtureItem(m: Match): SearchItem {
  const date = (m.date || '').slice(0, 10);
  return {
    kind: 'fixture',
    id: m.id,
    label: `${m.home_team} v ${m.away_team}`,
    sub: m.matchday ? `${date} · GW${m.matchday}` : date,
    href: `/fixtures/${m.id}`,
    tokens: tokenise(m.home_team, m.away_team, abbr(m.home_team), abbr(m.away_team), date),
  };
}

function playerItem(s: FDScorer): SearchItem {
  const name = s.player?.name ?? '';
  const team = s.team?.name ?? '';
  return {
    kind: 'player',
    id: `player-${s.player?.id ?? name}`,
    label: name,
    sub: team ? `${team} · ${s.goals} goals` : `${s.goals} goals`,
    tokens: tokenise(name, team, s.team?.tla),
  };
}

function seasonItem(s: SeasonRecord): SearchItem {
  const championLine = s.champion ? `Won by ${s.champion.team}` : 'In progress';
  return {
    kind: 'season',
    id: `season-${s.season}`,
    label: s.season,
    sub: championLine,
    href: `/insights/archive?season=${encodeURIComponent(s.season)}`,
    tokens: tokenise(s.season, s.champion?.team, s.runnerUp?.team),
  };
}

function threadItem(t: OracleThread): SearchItem {
  const firstUser = t.messages.find((m) => m.role === 'user');
  return {
    kind: 'thread',
    id: `thread-${t.id}`,
    label: t.title,
    sub: `${t.messages.length} message${t.messages.length === 1 ? '' : 's'}`,
    href: `/oracle?thread=${encodeURIComponent(t.id)}`,
    tokens: tokenise(t.title, firstUser?.content),
  };
}

export function buildIndex(src: SearchSourceSnapshot): SearchItem[] {
  return [
    ...src.matches.map(fixtureItem),
    ...src.scorers.map(playerItem),
    ...src.seasons.map(seasonItem),
    ...src.threads.map(threadItem),
  ];
}

function scoreItem(item: SearchItem, queryTokens: string[]): number {
  let score = 0;
  const label = item.label.toLowerCase();
  for (const q of queryTokens) {
    if (label === q) score += 100;
    if (label.startsWith(q)) score += 50;
    let hit = false;
    for (const t of item.tokens) {
      if (t === q) {
        score += 30;
        hit = true;
      } else if (t.startsWith(q)) {
        score += 20;
        hit = true;
      } else if (t.includes(q)) {
        score += 10;
        hit = true;
      }
    }
    // Hard requirement: every query token must hit *something*.
    if (!hit && !label.includes(q)) return 0;
  }
  return score;
}

export interface SearchResult {
  item: SearchItem;
  score: number;
}

export function searchIndex(
  items: SearchItem[],
  query: string,
  limit = 25,
): SearchResult[] {
  const queryTokens = tokenise(query);
  if (queryTokens.length === 0) return [];
  const results: SearchResult[] = [];
  for (const item of items) {
    const score = scoreItem(item, queryTokens);
    if (score > 0) results.push({ item, score });
  }
  results.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return results.slice(0, limit);
}
