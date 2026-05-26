import type { FixtureContext } from '$lib/context/types';

// Hand-crafted, voice-neutral demo picks used when no Football-Data API key is
// configured AND demo mode is not active (so the `/predictions` empty state
// never reads as a near-empty page on the public preview deploy). Probability
// triplets are deliberately varied so the row prob-bars look plausible rather
// than uniform 40/30/30. Mirrors the K2-fix.8 demo-broadsheet pattern (paired
// with a "● Sample picks · demo data" eyebrow chip in the UI). K2-fix.8.1.
export const DEMO_PICKS: FixtureContext[] = [
  {
    id: 'demo-pick-1',
    home: 'Manchester City FC',
    away: 'Liverpool FC',
    kickoff: '2026-05-30T15:00:00+01:00',
    ourProb: { home: 0.42, draw: 0.30, away: 0.28 }
  },
  {
    id: 'demo-pick-2',
    home: 'Arsenal FC',
    away: 'Newcastle United FC',
    kickoff: '2026-05-30T17:30:00+01:00',
    ourProb: { home: 0.51, draw: 0.27, away: 0.22 }
  },
  {
    id: 'demo-pick-3',
    home: 'Chelsea FC',
    away: 'Tottenham Hotspur FC',
    kickoff: '2026-05-31T14:00:00+01:00',
    ourProb: { home: 0.45, draw: 0.29, away: 0.26 }
  },
  {
    id: 'demo-pick-4',
    home: 'Brighton & Hove Albion FC',
    away: 'Aston Villa FC',
    kickoff: '2026-05-31T14:00:00+01:00',
    ourProb: { home: 0.38, draw: 0.32, away: 0.30 }
  },
  {
    id: 'demo-pick-5',
    home: 'West Ham United FC',
    away: 'Everton FC',
    kickoff: '2026-05-31T16:30:00+01:00',
    ourProb: { home: 0.55, draw: 0.27, away: 0.18 }
  },
  {
    id: 'demo-pick-6',
    home: 'Nottingham Forest FC',
    away: 'Manchester United FC',
    kickoff: '2026-06-01T20:00:00+01:00',
    ourProb: { home: 0.29, draw: 0.31, away: 0.40 }
  }
];
