import { describe, it, expect } from 'vitest';
import { parseFootballDataCsv, toMatch } from './csvArchive';

describe('parseFootballDataCsv', () => {
  it('parses the minimal 1993-era header with trailing comma padding', () => {
    const csv = [
      'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,,,,,,,',
      'E0,14/08/93,Arsenal,Coventry,0,3,A,,,,,,,',
      'E0,14/08/93,Chelsea,Blackburn,1,2,A,,,,,,,',
      ',,,,,,,,,,,,,', // blank padding row — must be skipped
    ].join('\n');

    const matches = parseFootballDataCsv(csv, '1993-1994');
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      id: '1993-1994#0',
      seasonId: '1993-1994',
      kickoffISO: '1993-08-14T15:00:00Z', // no Time column → 15:00 default
      home: 'Arsenal',
      away: 'Coventry',
      fthg: 0,
      ftag: 3,
      ftr: 'A',
      odds: {},
    });
    expect(matches[0].referee).toBeUndefined();
  });

  it('pivots 2-digit years at 93: ≥93 → 1900s, <93 → 2000s', () => {
    const csv = [
      'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR',
      'E0,01/05/99,Leeds,Arsenal,1,0,H',
      'E0,19/08/00,Charlton,Man City,4,0,H',
      'E0,14/08/10,Aston Villa,West Ham,3,0,H',
    ].join('\n');

    const matches = parseFootballDataCsv(csv, 'x');
    expect(matches[0].kickoffISO).toBe('1999-05-01T15:00:00Z');
    expect(matches[1].kickoffISO).toBe('2000-08-19T15:00:00Z');
    expect(matches[2].kickoffISO).toBe('2010-08-14T15:00:00Z');
  });

  it('reads 4-digit dates, the Time column, referee, and modern odds groups', () => {
    const header =
      'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,Referee,' +
      'B365H,B365D,B365A,PSH,PSD,PSA,AvgH,AvgD,AvgA,PSCH,PSCD,PSCA';
    const row =
      'E0,09/08/2019,20:00,Liverpool,Norwich,4,1,H,M Oliver,' +
      '1.14,10,19,1.15,9.59,18.05,1.14,8.75,19.83,1.14,10.43,19.63';
    const [m] = parseFootballDataCsv(`${header}\n${row}`, '2019-2020');

    expect(m.kickoffISO).toBe('2019-08-09T20:00:00Z');
    expect(m.referee).toBe('M Oliver');
    expect(m.odds.b365).toEqual({ home: 1.14, draw: 10, away: 19 });
    expect(m.odds.ps).toEqual({ home: 1.15, draw: 9.59, away: 18.05 });
    expect(m.odds.avg).toEqual({ home: 1.14, draw: 8.75, away: 19.83 });
    expect(m.odds.psc).toEqual({ home: 1.14, draw: 10.43, away: 19.63 });
  });

  it('synthesises a market average from per-bookmaker triples in the early-2000s era', () => {
    // 2000-01-era header: GB + IW + WH triples, no B365/Avg/BbAv columns.
    const header = 'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,GBH,GBD,GBA,IWH,IWD,IWA,WHH,WHD,WHA';
    const row = 'E0,19/08/00,Charlton,Man City,4,0,H,2.0,3.0,4.0,2.2,3.2,4.2,2.1,3.1,4.1';
    const [m] = parseFootballDataCsv(`${header}\n${row}`, '2000-2001');

    expect(m.odds.b365).toBeUndefined();
    // Mean of (2.0, 2.2, 2.1) etc. per outcome.
    expect(m.odds.avg!.home).toBeCloseTo(2.1, 10);
    expect(m.odds.avg!.draw).toBeCloseTo(3.1, 10);
    expect(m.odds.avg!.away).toBeCloseTo(4.1, 10);
  });

  it('prefers the named average column over the synthetic one', () => {
    const header = 'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,BbAvH,BbAvD,BbAvA,GBH,GBD,GBA';
    const row = 'E0,14/08/10,Aston Villa,West Ham,3,0,H,1.96,3.3,4.03,9,9,9';
    const [m] = parseFootballDataCsv(`${header}\n${row}`, '2010-2011');
    expect(m.odds.avg).toEqual({ home: 1.96, draw: 3.3, away: 4.03 });
  });

  it('strips the UTF-8 BOM found in 2024+ files', () => {
    const csv = '\uFEFFDiv,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR\nE0,16/08/2024,Man United,Fulham,1,0,H';
    const matches = parseFootballDataCsv(csv, '2024-2025');
    expect(matches).toHaveLength(1);
    expect(matches[0].home).toBe('Man United');
  });

  it('skips rows with malformed results or incomplete data', () => {
    const csv = [
      'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR',
      'E0,14/08/93,Arsenal,Coventry,0,3,X', // invalid FTR
      'E0,14/08/93,Arsenal,,0,3,A', // missing away team
      'E0,notadate,Arsenal,Coventry,0,3,A', // unparseable date
      'E0,14/08/93,Arsenal,Coventry,,3,A', // missing goals
      'E0,15/08/93,Leeds,Everton,2,0,H', // valid
    ].join('\n');
    const matches = parseFootballDataCsv(csv, 'x');
    expect(matches).toHaveLength(1);
    expect(matches[0].home).toBe('Leeds');
  });

  it('rejects degenerate odds (≤ 1.0) rather than emitting impossible prices', () => {
    const header = 'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A';
    const row = 'E0,14/08/10,Chelsea,Wigan,6,0,H,1.0,8,15';
    const [m] = parseFootballDataCsv(`${header}\n${row}`, 'x');
    expect(m.odds.b365).toBeUndefined();
  });
});

describe('toMatch', () => {
  it('maps an archive row to the app Match shape deterministically', () => {
    const header = 'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,Referee,B365H,B365D,B365A';
    const row = 'E0,16/08/2024,20:00,Man United,Fulham,1,0,H,R Jones,1.6,4.2,5.25';
    const [am] = parseFootballDataCsv(`${header}\n${row}`, '2024-2025');
    const match = toMatch(am);

    expect(match).toMatchObject({
      id: '2024-2025#0',
      season_id: '2024-2025',
      date: '2024-08-16T20:00:00Z',
      home_team: 'Man United',
      away_team: 'Fulham',
      home_goals: 1,
      away_goals: 0,
      result: 'H',
      full_time_result: 'H',
      referee: 'R Jones',
      home_odds: 1.6,
      status: 'FINISHED',
    });
    // Deterministic: created_at reuses kickoff, never wall-clock time.
    expect(match.created_at).toBe(am.kickoffISO);
    // Fields the archive doesn't carry are explicit nulls.
    expect(match.home_shots).toBeNull();
    expect(match.half_time_result).toBeNull();
  });
});
