/**
 * Parser for football-data.co.uk EPL season CSVs (1993/94 → present).
 *
 * Pure and environment-free: takes CSV text in, returns typed matches out.
 * File-system access lives in archiveLoader.ts (Node-only) so this module
 * stays importable everywhere.
 *
 * Era quirks handled here, verified against the actual archive:
 * - 1993–2000 files have only Div,Date,Teams,FTHG,FTAG,FTR and pad rows with
 *   trailing commas.
 * - Dates are DD/MM/YY until ~2017 and DD/MM/YYYY after; 2-digit years pivot
 *   at 93 (≥93 → 1900s, else 2000s).
 * - A Time column exists from 2019/20; earlier rows default to 15:00.
 * - 2024+ files begin with a UTF-8 BOM.
 * - Odds columns vary by era: named averages (AvgH / BbAvH) and Pinnacle
 *   (PSH, closing PSCH) appear over time; the early 2000s carry only
 *   per-bookmaker triples (GB, IW, LB, ...), from which we synthesise an
 *   average so the market baseline covers the whole 2000+ era.
 * - No quoted commas exist anywhere in the EPL files, so a plain split(',')
 *   is safe.
 */

import type { Match } from '../../types';
import type { ArchiveMatch, OddsTriple } from './types';

/** Early-2000s bookmaker column prefixes used to synthesise a market average
 *  when the file predates the AvgH/BbAvH columns. */
const EARLY_BOOK_PREFIXES = ['GB', 'IW', 'LB', 'SB', 'WH', 'BW', 'VC', 'SJ', 'BS'];

interface HeaderIndex {
  [column: string]: number;
}

function parseDateToIso(date: string, time: string | undefined): string | undefined {
  const parts = date.split('/');
  if (parts.length !== 3) return undefined;
  const [dd, mm, y] = parts;
  const day = Number(dd);
  const month = Number(mm);
  let year = Number(y);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return undefined;
  }
  if (y.length === 2) {
    year = year >= 93 ? 1900 + year : 2000 + year;
  }
  const hhmm = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '15:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${hhmm}:00Z`;
}

function readOddsTriple(
  row: string[],
  header: HeaderIndex,
  h: string,
  d: string,
  a: string
): OddsTriple | undefined {
  const home = numAt(row, header[h]);
  const draw = numAt(row, header[d]);
  const away = numAt(row, header[a]);
  if (home === undefined || draw === undefined || away === undefined) return undefined;
  if (home <= 1 || draw <= 1 || away <= 1) return undefined;
  return { home, draw, away };
}

function numAt(row: string[], idx: number | undefined): number | undefined {
  if (idx === undefined) return undefined;
  const raw = row[idx]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function strAt(row: string[], idx: number | undefined): string | undefined {
  if (idx === undefined) return undefined;
  const raw = row[idx]?.trim();
  return raw || undefined;
}

/** Mean decimal odds per outcome across whichever early-era bookmaker triples
 *  the row carries completely. Mirrors how football-data's own Avg columns
 *  are constructed (average of odds, not of implied probabilities). */
function syntheticAverage(row: string[], header: HeaderIndex): OddsTriple | undefined {
  let n = 0;
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const prefix of EARLY_BOOK_PREFIXES) {
    const triple = readOddsTriple(row, header, `${prefix}H`, `${prefix}D`, `${prefix}A`);
    if (triple) {
      home += triple.home;
      draw += triple.draw;
      away += triple.away;
      n++;
    }
  }
  if (n === 0) return undefined;
  return { home: home / n, draw: draw / n, away: away / n };
}

/**
 * Parse one season CSV into chronological ArchiveMatch rows. Malformed or
 * incomplete rows (blank padding lines, abandoned fixtures) are skipped.
 */
export function parseFootballDataCsv(csvText: string, seasonId: string): ArchiveMatch[] {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return [];

  const header: HeaderIndex = {};
  lines[0].split(',').forEach((name, idx) => {
    const key = name.trim();
    if (key && !(key in header)) header[key] = idx;
  });

  const matches: ArchiveMatch[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = lines[i].split(',');

    const home = strAt(row, header['HomeTeam']);
    const away = strAt(row, header['AwayTeam']);
    const date = strAt(row, header['Date']);
    const fthg = numAt(row, header['FTHG']);
    const ftag = numAt(row, header['FTAG']);
    const ftr = strAt(row, header['FTR']);
    if (!home || !away || !date || fthg === undefined || ftag === undefined) continue;
    if (ftr !== 'H' && ftr !== 'D' && ftr !== 'A') continue;

    const kickoffISO = parseDateToIso(date, strAt(row, header['Time']));
    if (!kickoffISO) continue;

    const odds: ArchiveMatch['odds'] = {};
    const b365 = readOddsTriple(row, header, 'B365H', 'B365D', 'B365A');
    if (b365) odds.b365 = b365;
    const ps = readOddsTriple(row, header, 'PSH', 'PSD', 'PSA');
    if (ps) odds.ps = ps;
    const psc = readOddsTriple(row, header, 'PSCH', 'PSCD', 'PSCA');
    if (psc) odds.psc = psc;
    const avg =
      readOddsTriple(row, header, 'AvgH', 'AvgD', 'AvgA') ??
      readOddsTriple(row, header, 'BbAvH', 'BbAvD', 'BbAvA') ??
      syntheticAverage(row, header);
    if (avg) odds.avg = avg;

    matches.push({
      id: `${seasonId}#${matches.length}`,
      seasonId,
      kickoffISO,
      home,
      away,
      fthg,
      ftag,
      ftr,
      referee: strAt(row, header['Referee']),
      odds,
    });
  }
  return matches;
}

/**
 * Convert an archive row to the app's Match shape so adapters can drive the
 * existing engine's backtest mode with it. Deterministic: created_at reuses
 * the kickoff timestamp instead of wall-clock time.
 */
export function toMatch(am: ArchiveMatch): Match {
  return {
    id: am.id,
    season_id: am.seasonId,
    date: am.kickoffISO,
    home_team: am.home,
    away_team: am.away,
    home_goals: am.fthg,
    away_goals: am.ftag,
    result: am.ftr,
    home_odds: am.odds.b365?.home ?? null,
    draw_odds: am.odds.b365?.draw ?? null,
    away_odds: am.odds.b365?.away ?? null,
    first_half_home_goals: null,
    first_half_away_goals: null,
    full_time_result: am.ftr,
    half_time_result: null,
    referee: am.referee ?? null,
    home_shots: null,
    away_shots: null,
    home_shots_target: null,
    away_shots_target: null,
    home_fouls: null,
    away_fouls: null,
    home_corners: null,
    away_corners: null,
    home_yellows: null,
    away_yellows: null,
    home_reds: null,
    away_reds: null,
    created_at: am.kickoffISO,
    status: 'FINISHED',
  };
}
