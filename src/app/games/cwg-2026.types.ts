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
  athleteNames?: string[];
  certainty: string;
  venue: string;
  isMedalSession: boolean;
  isConditional: boolean;
  isEliminated?: boolean;
  badgeOverride?: string;
  goldMedalEvents?: string[];
  notes?: string;
  result?: CwgScheduleResult;
}

export interface CwgScheduleResult {
  boxingDraw?: CwgBoxingDrawResult;
}

export interface CwgBoxingDrawCompetitor {
  competitorCode?: string;
  countryCode?: string;
  displayName?: string;
  shortName?: string;
  printName?: string;
}

export interface CwgBoxingDrawResult {
  eventId?: string;
  eventSlug?: string;
  eventDescription?: string;
  boutId?: string;
  boutNumber?: string | number;
  roundId?: string;
  roundName?: string;
  indiaName?: string;
  indiaCountryCode?: string;
  indiaCorner?: string;
  opponentStatus?: string;
  confirmedOpponent?: CwgBoxingDrawCompetitor;
  possibleOpponents?: CwgBoxingDrawCompetitor[];
  roadToMedalEnabled?: boolean;
  drawRoute?: string;
  sourceAuthority?: string;
  sourcePayloadStatus?: string;
}

const toTitleCaseName = (value?: string | null): string =>
  (value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, letter: string) => `Mc${letter.toUpperCase()}`)
    .trim();

export const getBoxingDraw = (row: CwgScheduleRow): CwgBoxingDrawResult | null =>
  row.result?.boxingDraw || null;

export const getBoxingCompetitorName = (competitor?: CwgBoxingDrawCompetitor | null): string =>
  toTitleCaseName(competitor?.displayName || competitor?.printName || competitor?.shortName);

export const getBoxingCompetitorLabel = (competitor?: CwgBoxingDrawCompetitor | null): string => {
  const name = getBoxingCompetitorName(competitor);
  if (!name) return "";
  return competitor?.countryCode ? `${name} (${competitor.countryCode})` : name;
};

export const getBoxingOpponentLabel = (row: CwgScheduleRow): string => {
  const draw = getBoxingDraw(row);
  if (!draw) return "";

  if (draw.confirmedOpponent) return getBoxingCompetitorLabel(draw.confirmedOpponent);

  return "Opponent TBC";
};

export const getBoxingEventTitle = (row: CwgScheduleRow): string => {
  const draw = getBoxingDraw(row);
  if (!draw) return row.event;
  return [draw.eventDescription, draw.roundName].filter(Boolean).join(" - ") || row.event;
};

export const shouldShowRoadToMedal = (row: CwgScheduleRow): boolean => {
  const draw = getBoxingDraw(row);
  if (!draw) return false;
  if (typeof draw.roadToMedalEnabled === "boolean") return draw.roadToMedalEnabled;
  if (row.isConditional === false) return true;

  const badge = (row.badgeOverride || "").toLowerCase();
  if (badge === "confirmed" || badge === "draw-pending") return true;

  const certainty = (row.certainty || "").toLowerCase();
  return certainty === "confirmed draw" || certainty === "opponent pending from draw path";
};

export const getRoadToMedalImageUrl = (row: CwgScheduleRow): string => {
  const draw = getBoxingDraw(row);
  if (!draw || !shouldShowRoadToMedal(row)) return "";

  return draw.eventSlug ? `assets/images/cwg/boxing-draws/road-to-medal/${draw.eventSlug}.png` : "";
};

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
