import { type Page } from '@playwright/test';

/**
 * Mock Football-Data.org API responses for E2E tests.
 *
 * Intercepts all /api/football-data/** requests and returns realistic
 * Premier League data so components render properly without a real API key.
 */

// --- Teams ---

const teams = [
  { id: 57, name: 'Arsenal', shortName: 'Arsenal', tla: 'ARS', crest: '' },
  { id: 65, name: 'Manchester City', shortName: 'Man City', tla: 'MCI', crest: '' },
  { id: 64, name: 'Liverpool', shortName: 'Liverpool', tla: 'LIV', crest: '' },
  { id: 66, name: 'Manchester United', shortName: 'Man United', tla: 'MUN', crest: '' },
  { id: 73, name: 'Tottenham', shortName: 'Spurs', tla: 'TOT', crest: '' },
  { id: 61, name: 'Chelsea', shortName: 'Chelsea', tla: 'CHE', crest: '' },
  { id: 67, name: 'Newcastle United', shortName: 'Newcastle', tla: 'NEW', crest: '' },
  { id: 58, name: 'Aston Villa', shortName: 'Aston Villa', tla: 'AVL', crest: '' },
  { id: 402, name: 'Brighton', shortName: 'Brighton', tla: 'BHA', crest: '' },
  { id: 563, name: 'West Ham United', shortName: 'West Ham', tla: 'WHU', crest: '' },
  { id: 354, name: 'Crystal Palace', shortName: 'Crystal Palace', tla: 'CRY', crest: '' },
  { id: 328, name: 'Bournemouth', shortName: 'Bournemouth', tla: 'BOU', crest: '' },
  { id: 63, name: 'Fulham', shortName: 'Fulham', tla: 'FUL', crest: '' },
  { id: 76, name: 'Wolverhampton', shortName: 'Wolves', tla: 'WOL', crest: '' },
  { id: 62, name: 'Everton', shortName: 'Everton', tla: 'EVE', crest: '' },
  { id: 351, name: 'Nottingham Forest', shortName: "Nott'm Forest", tla: 'NFO', crest: '' },
  { id: 55, name: 'Brentford', shortName: 'Brentford', tla: 'BRE', crest: '' },
  { id: 1044, name: 'Leicester City', shortName: 'Leicester', tla: 'LEI', crest: '' },
  { id: 340, name: 'Southampton', shortName: 'Southampton', tla: 'SOU', crest: '' },
  { id: 349, name: 'Ipswich Town', shortName: 'Ipswich', tla: 'IPS', crest: '' },
];

// --- Helpers ---

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// --- Mock responses ---

function buildMatchesResponse() {
  const finishedMatches = [
    { id: 1001, home: 0, away: 1, homeGoals: 2, awayGoals: 1, winner: 'HOME_TEAM' as const, daysBack: 1 },
    { id: 1002, home: 2, away: 3, homeGoals: 0, awayGoals: 0, winner: 'DRAW' as const, daysBack: 2 },
    { id: 1003, home: 4, away: 5, homeGoals: 3, awayGoals: 1, winner: 'HOME_TEAM' as const, daysBack: 3 },
    { id: 1004, home: 6, away: 7, homeGoals: 1, awayGoals: 2, winner: 'AWAY_TEAM' as const, daysBack: 5 },
    { id: 1005, home: 8, away: 9, homeGoals: 1, awayGoals: 1, winner: 'DRAW' as const, daysBack: 7 },
  ];

  const upcomingMatches = [
    { id: 2001, home: 1, away: 0, daysAhead: 1 },
    { id: 2002, home: 3, away: 2, daysAhead: 2 },
    { id: 2003, home: 5, away: 4, daysAhead: 3 },
    { id: 2004, home: 7, away: 6, daysAhead: 5 },
    { id: 2005, home: 9, away: 8, daysAhead: 7 },
  ];

  const matches = [
    ...finishedMatches.map((m) => ({
      id: m.id,
      utcDate: daysAgo(m.daysBack),
      status: 'FINISHED',
      matchday: 29,
      minute: null,
      stage: 'REGULAR_SEASON',
      group: null,
      lastUpdated: daysAgo(m.daysBack),
      homeTeam: teams[m.home],
      awayTeam: teams[m.away],
      score: {
        winner: m.winner,
        duration: 'REGULAR',
        fullTime: { home: m.homeGoals, away: m.awayGoals },
        halfTime: { home: Math.min(m.homeGoals, 1), away: 0 },
      },
      odds: { msg: 'Mock odds', homeWin: 2.1, draw: 3.4, awayWin: 3.2 },
      referees: [],
    })),
    ...upcomingMatches.map((m) => ({
      id: m.id,
      utcDate: daysFromNow(m.daysAhead),
      status: 'TIMED',
      matchday: 30,
      minute: null,
      stage: 'REGULAR_SEASON',
      group: null,
      lastUpdated: new Date().toISOString(),
      homeTeam: teams[m.home],
      awayTeam: teams[m.away],
      score: {
        winner: null,
        duration: 'REGULAR',
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null },
      },
      odds: { msg: 'Mock odds', homeWin: 1.9, draw: 3.5, awayWin: 4.0 },
      referees: [],
    })),
  ];

  return { matches };
}

function buildStandingsResponse() {
  const table = teams.map((team, i) => {
    const played = 29;
    const won = Math.max(20 - i * 1, 3);
    const drawn = Math.min(3 + (i % 4), 8);
    const lost = played - won - drawn;
    const gf = Math.max(55 - i * 2, 18);
    const ga = Math.min(20 + i * 2, 55);
    return {
      position: i + 1,
      team,
      playedGames: played,
      form: 'W,W,D,L,W',
      won,
      draw: drawn,
      lost,
      points: won * 3 + drawn,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDifference: gf - ga,
    };
  });

  return {
    standings: [
      {
        stage: 'REGULAR_SEASON',
        type: 'TOTAL',
        group: null,
        table,
      },
    ],
  };
}

function buildCompetitionResponse() {
  const now = new Date();
  const seasonStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    id: 2021,
    name: 'Premier League',
    code: 'PL',
    type: 'LEAGUE',
    emblem: '',
    currentSeason: {
      id: seasonStart,
      startDate: `${seasonStart}-08-10`,
      endDate: `${seasonStart + 1}-05-25`,
      currentMatchday: 30,
      winner: null,
    },
  };
}

// --- Route interceptor ---

/**
 * Register mock API routes on a Playwright page.
 * Must be called BEFORE any page.goto() so requests are intercepted immediately.
 */
export async function mockFootballApi(page: Page) {
  await page.route('**/api/football-data/**', (route) => {
    const url = route.request().url();

    let body: unknown;

    if (url.includes('/standings')) {
      body = buildStandingsResponse();
    } else if (url.includes('/matches')) {
      body = buildMatchesResponse();
    } else if (url.includes('/competitions/2021')) {
      body = buildCompetitionResponse();
    } else {
      route.fulfill({ status: 404, body: 'Not found' });
      return;
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}
