/**
 * Demo data for screenshot / preview mode.
 * Activated via `?demo=1`, `localStorage.kicker:demoMode === 'on'`, or `VITE_DEMO_MODE`.
 * Never shown when a Football-Data API key is configured for the real user.
 */

export interface FDScorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; crest: string };
  goals: number;
  assists: number | null;
  penalties: number | null;
  playedMatches: number | null;
}

export const DEMO_SCORERS: FDScorer[] = [
  {
    player: { id: 1, name: 'Erling Haaland', nationality: 'Norway' },
    team: { id: 3, name: 'Manchester City FC', crest: '' },
    goals: 24,
    assists: 5,
    penalties: 4,
    playedMatches: 31,
  },
  {
    player: { id: 2, name: 'Mohamed Salah', nationality: 'Egypt' },
    team: { id: 1, name: 'Liverpool FC', crest: '' },
    goals: 21,
    assists: 12,
    penalties: 3,
    playedMatches: 33,
  },
  {
    player: { id: 3, name: 'Cole Palmer', nationality: 'England' },
    team: { id: 6, name: 'Chelsea FC', crest: '' },
    goals: 18,
    assists: 10,
    penalties: 5,
    playedMatches: 32,
  },
  {
    player: { id: 4, name: 'Alexander Isak', nationality: 'Sweden' },
    team: { id: 4, name: 'Newcastle United FC', crest: '' },
    goals: 17,
    assists: 4,
    penalties: 2,
    playedMatches: 28,
  },
  {
    player: { id: 5, name: 'Bukayo Saka', nationality: 'England' },
    team: { id: 2, name: 'Arsenal FC', crest: '' },
    goals: 15,
    assists: 11,
    penalties: 1,
    playedMatches: 33,
  },
  {
    player: { id: 6, name: 'Kai Havertz', nationality: 'Germany' },
    team: { id: 2, name: 'Arsenal FC', crest: '' },
    goals: 14,
    assists: 6,
    penalties: 3,
    playedMatches: 30,
  },
  {
    player: { id: 7, name: 'Ollie Watkins', nationality: 'England' },
    team: { id: 7, name: 'Aston Villa FC', crest: '' },
    goals: 14,
    assists: 8,
    penalties: 0,
    playedMatches: 32,
  },
  {
    player: { id: 8, name: 'Bryan Mbeumo', nationality: 'Cameroon' },
    team: { id: 12, name: 'Brentford FC', crest: '' },
    goals: 13,
    assists: 5,
    penalties: 2,
    playedMatches: 34,
  },
  {
    player: { id: 9, name: 'Heung-min Son', nationality: 'South Korea' },
    team: { id: 5, name: 'Tottenham Hotspur FC', crest: '' },
    goals: 12,
    assists: 9,
    penalties: 1,
    playedMatches: 33,
  },
  {
    player: { id: 10, name: 'Phil Foden', nationality: 'England' },
    team: { id: 3, name: 'Manchester City FC', crest: '' },
    goals: 12,
    assists: 7,
    penalties: 0,
    playedMatches: 29,
  },
  {
    player: { id: 11, name: 'Jarrod Bowen', nationality: 'England' },
    team: { id: 11, name: 'West Ham United FC', crest: '' },
    goals: 11,
    assists: 6,
    penalties: 1,
    playedMatches: 34,
  },
  {
    player: { id: 12, name: 'Dominic Solanke', nationality: 'England' },
    team: { id: 5, name: 'Tottenham Hotspur FC', crest: '' },
    goals: 11,
    assists: 3,
    penalties: 2,
    playedMatches: 31,
  },
  {
    player: { id: 13, name: 'Gabriel Martinelli', nationality: 'Brazil' },
    team: { id: 2, name: 'Arsenal FC', crest: '' },
    goals: 10,
    assists: 7,
    penalties: 0,
    playedMatches: 32,
  },
  {
    player: { id: 14, name: 'Nicolas Jackson', nationality: 'Senegal' },
    team: { id: 6, name: 'Chelsea FC', crest: '' },
    goals: 10,
    assists: 4,
    penalties: 1,
    playedMatches: 30,
  },
  {
    player: { id: 15, name: 'Andreas Pereira', nationality: 'Brazil' },
    team: { id: 14, name: 'Fulham FC', crest: '' },
    goals: 9,
    assists: 8,
    penalties: 2,
    playedMatches: 33,
  },
  {
    player: { id: 16, name: 'Matheus Cunha', nationality: 'Brazil' },
    team: { id: 17, name: 'Wolverhampton Wanderers FC', crest: '' },
    goals: 9,
    assists: 5,
    penalties: 1,
    playedMatches: 34,
  },
  {
    player: { id: 17, name: 'Callum Hudson-Odoi', nationality: 'England' },
    team: { id: 10, name: 'Nottingham Forest FC', crest: '' },
    goals: 8,
    assists: 6,
    penalties: 0,
    playedMatches: 29,
  },
  {
    player: { id: 18, name: 'Evanilson', nationality: 'Brazil' },
    team: { id: 15, name: 'AFC Bournemouth', crest: '' },
    goals: 8,
    assists: 2,
    penalties: 1,
    playedMatches: 27,
  },
  {
    player: { id: 19, name: 'Jacob Ramsey', nationality: 'England' },
    team: { id: 7, name: 'Aston Villa FC', crest: '' },
    goals: 7,
    assists: 9,
    penalties: 0,
    playedMatches: 31,
  },
  {
    player: { id: 20, name: 'Jean-Philippe Mateta', nationality: 'France' },
    team: { id: 13, name: 'Crystal Palace FC', crest: '' },
    goals: 7,
    assists: 3,
    penalties: 2,
    playedMatches: 30,
  },
];
