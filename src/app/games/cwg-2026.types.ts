import type { Athlete, Sport } from "../services/payload.service";

export const CWG_2026_GAMES_KEY = "cwg-glasgow-2026";

export type CwgCompetitionStream = "all" | "able-bodied" | "para";

export interface CwgScheduleData {
  gamesDates: string;
  timezone: string;
  scheduleEdition: string;
  rows: CwgScheduleRow[];
}

export interface CwgScheduleRow {
  id: string;
  sortKey: string;
  istStart?: string;
  istEnd?: string;
  dateLabel: string;
  dayLabel: string;
  timeLabel: string;
  sport: string;
  sportSlug: string;
  event: string;
  stage: string;
  athletes: string;
  certainty: string;
  venue: string;
  isMedalSession: boolean;
  isConditional: boolean;
  isEliminated?: boolean;
  badgeOverride?: string;
  goldMedalEvents?: string[];
}

export interface CwgWatchList {
  isTenToWatch?: boolean;
  rank?: number;
  groupKey?: string;
  groupTitle?: string;
  suppliedLabel?: string;
  shortUrl?: string;
  shortStatus?: "released" | "scheduled";
  posterUrl?: string;
}

export interface CwgGamesParticipation {
  id: string;
  displayTitle?: string;
  gamesKey: string;
  competitionName?: string;
  editionName?: string;
  athlete: Athlete | string;
  sport: Sport | string;
  sourceName?: string;
  rosterOrder?: number;
  eventName?: string;
  eventBucket?: string;
  competitionStream?: "able-bodied" | "para";
  displayGroup?: string;
  gender?: "male" | "female" | "mixed" | "open";
  teamType?: "individual" | "pair" | "team" | "relay" | "squad";
  isPara?: boolean;
  status?: string;
  medalOutlook?: string;
  editorialPriority?: "hero" | "high" | "watch" | "depth";
  watchList?: CwgWatchList;
  publicNote?: string;
  internalNotes?: string;
}

export interface PayloadListResponse<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
}

export const getParticipationAthlete = (participation: CwgGamesParticipation): Athlete | null =>
  typeof participation.athlete === "object" && participation.athlete ? participation.athlete : null;

export const getParticipationSport = (participation: CwgGamesParticipation): Sport | null =>
  typeof participation.sport === "object" && participation.sport ? participation.sport : null;

export const getParticipationAthleteName = (participation: CwgGamesParticipation): string =>
  getParticipationAthlete(participation)?.fullName || participation.sourceName || "India";

export const getParticipationSportName = (participation: CwgGamesParticipation): string =>
  getParticipationSport(participation)?.name || participation.displayGroup || "Sport";

export const getParticipationSportSlug = (participation: CwgGamesParticipation): string =>
  getParticipationSport(participation)?.slug ||
  (participation.displayGroup || "sport")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
