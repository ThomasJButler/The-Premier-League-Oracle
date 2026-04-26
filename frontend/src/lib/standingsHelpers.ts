export type QualificationZone = 'ucl' | 'uel' | 'mid' | 'relegation';

/** Pos 1-4 → 'ucl', 5 → 'uel', 18-20 → 'relegation', else 'mid'. */
export function classifyZone(position: number): QualificationZone {
  if (position <= 4) return 'ucl';
  if (position === 5) return 'uel';
  if (position >= 18) return 'relegation';
  return 'mid';
}

/** Tailwind class for a qualification-zone row background. Returns '' for 'mid'. */
export function zoneRowClass(zone: QualificationZone): string {
  if (zone === 'ucl') return 'bg-accent/8';
  if (zone === 'uel') return 'bg-accent/4';
  if (zone === 'relegation') return 'bg-destructive/6';
  return '';
}

/**
 * Parse form string ("WWLDW") into a length-5 array of FormDot results, padded
 * with 'pending' markers if shorter than 5; returns 5 'pending' if input null.
 */
export function parseFormString(form: string | null): Array<'W' | 'D' | 'L' | 'pending'> {
  const chars = (form ?? '').toUpperCase().slice(0, 5).split('');
  const out: Array<'W' | 'D' | 'L' | 'pending'> = [];
  for (let i = 0; i < 5; i++) {
    const c = chars[i];
    if (c === 'W' || c === 'D' || c === 'L') out.push(c);
    else out.push('pending');
  }
  return out;
}

/** Points per game = points / playedGames, or 0 when no games played. */
export function pointsPerGame(points: number, playedGames: number): number {
  if (playedGames === 0) return 0;
  return points / playedGames;
}
