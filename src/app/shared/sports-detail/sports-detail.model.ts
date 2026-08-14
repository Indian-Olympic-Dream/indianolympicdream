export type SportsDetailState = 'tbc' | 'upcoming' | 'live' | 'completed';
export type SportsDetailSize = 'compact' | 'wide';

export interface SportsDetailAction {
  whereToWatchUrl?: string | null;
  whereToWatchLabel?: string | null;
  externalUrl?: string | null;
}

export interface MatchupTeam {
  name: string;
  code: string;
  isIndia: boolean;
  flag?: string;
  score?: number | string | null;
}

export interface HockeyGroupMatch {
  matchLabel?: string;
  dateLabel: string;
  timeLabel?: string;
  opponent: string;
  opponentCode: string;
  opponentFlag?: string;
  indiaFlag?: string;
  isCurrentMatch?: boolean;
  indiaScore?: number | null;
  opponentScore?: number | null;
  isCompleted: boolean;
}

export interface BadmintonEntryItem {
  discipline: string;
  disciplineCode: 'MS' | 'WS' | 'MD' | 'WD' | 'XD';
  names: string[];
  seed?: string | null;
  opponentNames?: string[];
  opponentSeed?: string | null;
  opponentCountry?: string;
  opponentCountryCode?: string;
  opponentFlag?: string;
  round: string;
  timeLabel?: string;
  court?: string;
  bye: boolean;
  note?: string;
  status?: 'upcoming' | 'live' | 'completed' | 'bye';
  score?: string | null;
}

export interface AthleticsCompetitor {
  name: string;
  country: string;
  countryCode: string;
  flag?: string;
  isIndia?: boolean;
  pb?: string;
  sb?: string;
  rank?: number | null;
  bestMark?: string | null;
}

export interface ProgrammeEventItem {
  gender: 'men' | 'women';
  name: string;
  timeLabel?: string | null;
}

export interface SportsDetailModel {
  sportName: string;
  sportSlug: string;
  sportPictogramUrl?: string | null;
  tournamentLogoUrl?: string | null;
  competitionTitle: string;
  state: SportsDetailState;
  stateLabel: string;
  headline: string;
  contextLine?: string | null;
  dateLabel: string;
  timeLabel: string;
  venue?: string | null;
  presentationSize: SportsDetailSize;
  actions?: SportsDetailAction | null;

  // Specific domain payload (only populated when relevant)
  matchup?: {
    teamA: MatchupTeam;
    teamB: MatchupTeam;
  } | null;

  hockeyGroupMatches?: HockeyGroupMatch[] | null;
  badmintonEntries?: BadmintonEntryItem[] | null;
  badmintonDisciplines?: string[] | null;
  athleticsField?: AthleticsCompetitor[] | null;
  athleticsProgramme?: { men: ProgrammeEventItem[]; women: ProgrammeEventItem[] } | null;
  resultSummary?: string | null;
}
