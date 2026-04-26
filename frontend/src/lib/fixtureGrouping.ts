import type { Match } from '../types';

export interface FixtureGroup {
  /** ISO date for sorting (YYYY-MM-DD). */
  isoDate: string;
  /** Display kicker, all-caps short form ("SAT 12 APR"). */
  dateLabel: string;
  /** Pluralised count phrase ("Five fixtures", "One fixture"). */
  countLabel: string;
  /** Matches scheduled on this date, sorted by kickoff time ascending. */
  matches: Match[];
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'] as const;

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

export function formatCountLabel(n: number): string {
  if (n === 1) return 'One fixture';
  if (n === 0) return 'No fixtures';
  if (n < 10) return `${COUNT_WORDS[n]} fixtures`;
  return `${n} fixtures`;
}

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function groupMatchesByDate(matches: Match[]): FixtureGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = isoDateOnly(m.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(m);
    else buckets.set(key, [m]);
  }

  const groups: FixtureGroup[] = [];
  for (const [isoDate, bucketMatches] of buckets) {
    bucketMatches.sort((a, b) => a.date.localeCompare(b.date));
    groups.push({
      isoDate,
      dateLabel: formatDateLabel(`${isoDate}T00:00:00Z`),
      countLabel: formatCountLabel(bucketMatches.length),
      matches: bucketMatches,
    });
  }
  groups.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return groups;
}
