/**
 * Type definitions for the v3 broadcast redesign.
 * Atom and MatchCard contracts pull from this single source.
 */

export type Theme = 'light' | 'dark' | 'auto';
export type Density = 'comfortable' | 'compact';

export type FixtureStatus =
  | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

export interface TeamSummary {
  abbr: string;
  name: string;
  crestUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formLast5?: ('W' | 'D' | 'L')[];
}

export interface Fixture {
  id: string;
  competition: string;
  gameweek: number;
  utcDate: string;
  status: FixtureStatus;
  minute?: number;
  venue?: string;
  tv?: string[];
  home: TeamSummary;
  away: TeamSummary;
  score?: { home: number; away: number };
}

export interface ModelBreakdown {
  name: 'ELO' | 'POISSON' | 'FORM' | 'H2H' | 'XGBOOST';
  lean: 'H' | 'D' | 'A';
  confidence: number;
}

export interface MatchPrediction {
  ensemble: { home: number; draw: number; away: number };
  models: ModelBreakdown[];
  topScorelines: { home: number; away: number; prob: number }[];
  xg: { home: number; away: number };
  elo: { home: number; away: number };
  pick: 'HOME' | 'DRAW' | 'AWAY';
  pickConfidence: number;
  divergenceFlag?: boolean;
  analyseText?: string;
  keyFactors?: string[];
  risks?: string[];
}

export type SectionId = 'analyse' | 'probabilities' | 'form' | 'context';

export interface MatchCardProps {
  fixture: Fixture;
  prediction?: MatchPrediction;
  variant?: 'standard' | 'emphasised';
  density?: Density;
  defaultOpen?: SectionId | SectionId[];
  hideSections?: SectionId[];
  onSectionToggle?: (id: SectionId, open: boolean) => void;
}
