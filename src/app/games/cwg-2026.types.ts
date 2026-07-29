import type { Athlete, Sport } from "../services/payload.service";

export const CWG_2026_GAMES_KEY = "cwg-glasgow-2026";

export type CwgCompetitionStream = "all" | "able-bodied" | "para";

export type CwgParticipationStatus =
  | "confirmed"
  | "start-list-pending"
  | "progression-dependent"
  | "pool-position-dependent"
  | "provisional"
  | "eliminated";

export type CwgTimingPrecision =
  | "exact"
  | "session-window"
  | "start-list-pending"
  | "draw-dependent"
  | "tbd";

export interface CwgScheduleData {
  gamesDates: string;
  timezone: string;
  scheduleEdition: string;
  rows: CwgScheduleRow[];
}

export interface CwgScheduleRow {
  id: string;
  name?: string;
  eventName?: string;
  sportName?: string;
  sortKey: string;
  istStart?: string;
  istEnd?: string;
  dateLabel: string;
  dayLabel: string;
  timeLabel: string;
  indiaTimeLabel?: string;
  localTimeLabel?: string;
  sport: string;
  sportSlug: string;
  competitionStream?: Exclude<CwgCompetitionStream, "all">;
  event: string;
  stage: string;
  phase?: string;
  athletes: string;
  athleteNames?: string[];
  certainty: string;
  participationStatus?: CwgParticipationStatus;
  timingPrecision?: CwgTimingPrecision;
  venue: string;
  isMedalSession: boolean;
  isConditional: boolean;
  isEliminated?: boolean;
  badgeOverride?: string;
  goldMedalEvents?: string[];
  notes?: string;
  status?: string;
  result?: CwgScheduleResult;
}

export interface CwgResultCompetitor {
  name: string;
  countryCode?: string;
  countryName?: string;
  flagEmoji?: string;
  scores?: (string | number)[];
  totalScore?: string | number;
  isWinner?: boolean;
}

export interface CwgResultSegment {
  label: string;
  competitor1Score: string | number;
  competitor2Score: string | number;
}

export interface CwgScheduleResultMatch {
  scoreText?: string;
  scoreLabel?: string;
  decisionText?: string;
  durationText?: string;
  winner?: string;
  notes?: string;
  editorNote?: string;
  officialSourceUrl?: string;
  storyUrl?: string;
  competitor1?: CwgResultCompetitor;
  competitor2?: CwgResultCompetitor;
  segments?: CwgResultSegment[];
}

export interface CwgLeaderboardEntry {
  rank: number;
  athleteName: string;
  countryCode?: string;
  countryName?: string;
  flagEmoji?: string;
  resultValue?: string;
  qualificationTag?: string;
}

export interface CwgOfficialResultEntry {
  organisationCode?: string;
  organisationName?: string;
  names?: string[];
  resultStatus?: string;
  resultCode?: string;
  resultCodeDescription?: string;
  result?: string;
  rank?: string | number;
  bucket?: "inline" | "versus" | "overall" | string;
  wlt?: string;
  irm?: string;
  qualificationMark?: string;
}

export interface CwgOfficialEventResult {
  sourceType?: string;
  detailUrl?: string;
  unitPrintDescription?: string;
  description?: string;
  unitStatus?: string;
  resultStatus?: string;
  india?: CwgOfficialResultEntry[];
  opponents?: CwgOfficialResultEntry[];
  field?: CwgOfficialResultEntry[];
  syncedAt?: string;
}

export interface CwgMedalAward {
  type: "gold" | "silver" | "bronze";
  athleteName?: string;
  result?: string;
  rank?: number;
}

export interface CwgScheduleResult {
  summaryLabel?: string;
  resultLabel?: string;
  summary?: string;
  outcome?: string;
  editorNote?: string;
  officialSourceUrl?: string;
  storyUrl?: string;
  match?: CwgScheduleResultMatch | null;
  leaderboard?: CwgLeaderboardEntry[] | null;
  officialEventResult?: CwgOfficialEventResult | null;
  medals?: CwgMedalAward[];
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
  let rawTitle = "";
  if (draw) {
    rawTitle = [draw.eventDescription, draw.roundName].filter(Boolean).join(" - ");
  }
  if (!rawTitle) {
    rawTitle = row.eventName || (typeof row.event === "string" ? row.event : "") || row.name || "";
  }
  if (row.sportName && rawTitle.startsWith(`${row.sportName}: `)) {
    rawTitle = rawTitle.substring(row.sportName.length + 2);
  }
  return rawTitle;
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
  isSuspended?: boolean;
  isDisqualified?: boolean;
  suspensionNote?: string;
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

export const getScheduleResultSummary = (row: CwgScheduleRow): string | null => {
  if (row.status === 'scheduled' && !row.result?.match?.winner && !row.result?.officialEventResult) {
    return null;
  }
  if (row.result?.summaryLabel?.trim()) return row.result.summaryLabel.trim();
  if (row.result?.resultLabel?.trim()) return row.result.resultLabel.trim();
  if (row.result?.summary?.trim()) return row.result.summary.trim();
  if (row.result?.match?.scoreText?.trim()) {
    const winner = row.result.match.winner ? `${row.result.match.winner} ` : '';
    return `${winner}${row.result.match.scoreText}`.trim();
  }
  return null;
};

export const getScheduleResultBadge = (row: CwgScheduleRow): { label: string; isWon: boolean } | null => {
  const summary = getScheduleResultSummary(row);
  if (!summary) return null;
  const isWon = summary.toUpperCase().includes('WON') || summary.toUpperCase().includes('GOLD') || summary.toUpperCase().includes('SILVER') || summary.toUpperCase().includes('BRONZE');
  return { label: summary, isWon };
};

export const parseCwgScheduleTimestamp = (value?: string | null): number => {
  if (!value) return Number.NaN;
  const raw = value.trim();
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasExplicitZone
    ? raw
    : `${raw.length === 16 ? `${raw}:00` : raw}+05:30`;
  return Date.parse(normalized);
};

export const isScheduleRowLiveNow = (row: CwgScheduleRow, now = new Date()): boolean => {
  if (
    row.status === 'completed' ||
    row.status === 'cancelled' ||
    Boolean(getScheduleResultSummary(row))
  ) {
    return false;
  }
  if (row.status === 'live') return true;
  if (!row.istStart) return false;
  const start = parseCwgScheduleTimestamp(row.istStart);
  const parsedEnd = parseCwgScheduleTimestamp(row.istEnd);
  const end =
    Number.isFinite(parsedEnd) && parsedEnd > start
      ? parsedEnd
      : start + 2 * 60 * 60 * 1000;
  const isBoxing = `${row.sportSlug} ${row.sport}`.toLowerCase().includes('boxing');
  // Bout times are estimates; keep boxing visible while the official result catches up.
  const resultGraceMs = isBoxing ? 5 * 60 * 1000 : 0;
  const current = now.getTime();
  return current >= start && current <= end + resultGraceMs;
};

export const getCountryFlagEmoji = (country: string | undefined | null): string => {
  if (!country) return '🏳️';
  const norm = country.trim().toUpperCase();

  const FLAG_MAP: Record<string, string> = {
    IND: '🇮🇳', INDIA: '🇮🇳',
    MLT: '🇲🇹', MALTA: '🇲🇹',
    CAN: '🇨🇦', CANADA: '🇨🇦',
    ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ENGLAND: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', SCOTLAND: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    WAL: '🏴󠁧󠁢󠁷󠁬 sentence', WALES: '🏴󠁧󠁢󠁷󠁬 sentence',
    NIR: '🇬🇧', 'NORTHERN IRELAND': '🇬🇧',
    AUS: '🇦🇺', AUSTRALIA: '🇦🇺',
    NZL: '🇳🇿', 'NEW ZEALAND': '🇳🇿',
    RSA: '🇿🇦', 'SOUTH AFRICA': '🇿🇦',
    NGR: '🇳🇬', NIGERIA: '🇳🇬',
    MAS: '🇲🇾', MALAYSIA: '🇲🇾',
    SGP: '🇸🇬', SIN: '🇸🇬', SINGAPORE: '🇸🇬',
    FIJ: '🇫🇯', FIJI: '🇫🇯',
    SAM: '🇼🇸', SAMOA: '🇼🇸',
    KEN: '🇰🇪', KENYA: '🇰🇪',
    JAM: '🇯🇲', JAMAICA: '🇯🇲',
    TTO: '🇹🇹', 'TRINIDAD AND TOBAGO': '🇹🇹',
    BAR: '🇧🇧', BARBADOS: '🇧🇧',
    GUY: '🇬🇾', GUYANA: '🇬🇾',
    GHA: '🇬🇭', GHANA: '🇬🇭',
    UGA: '🇺🇬', UGANDA: '🇺🇬',
    CYP: '🇨🇾', CYPRUS: '🇨🇾',
    MRI: '🇲🇺', MAURITIUS: '🇲🇺',
    NAM: '🇳🇦', NAMIBIA: '🇳🇦',
    BOT: '🇧🇼', BOTSWANA: '🇧🇼',
    SRI: '🇱🇰', 'SRI LANKA': '🇱🇰',
    PAK: '🇵🇰', PAKISTAN: '🇵🇰',
    BAN: '🇧🇩', BANGLADESH: '🇧🇩'
  };

  return FLAG_MAP[norm] || '🏳️';
};
