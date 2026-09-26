export type GamesTimelineTimingType = 'fixed' | 'not-before' | 'followed-by' | 'estimated' | 'tbd';
export type GamesTimelineIdentityKind = 'stored-unit' | 'official-unit' | 'schedule-row' | 'derived-unit';
export type GamesTimelineViewState =
  | 'scheduled'
  | 'live'
  | 'awaiting-result'
  | 'provisional-result'
  | 'official-result'
  | 'postponed'
  | 'cancelled'
  | 'eliminated';

export interface GamesTimelineSport {
  id: string | null;
  name: string;
  slug: string;
  olympicStatus: string | null;
  pictogramUrl: string | null;
  parent: {
    id: string | null;
    name: string;
    slug: string;
    pictogramUrl: string | null;
  } | null;
}

export interface GamesTimelineSource {
  scheduleSourceId: string;
  provider: string | null;
  identityKind: GamesTimelineIdentityKind;
  unitId: string | null;
  disciplineCode: string | null;
  officialKey: string | null;
  url: string | null;
}

export interface GamesTimelineProgrammeSession {
  id: string;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  sourceBasis: string | null;
}

export interface GamesTimelineEvent {
  name: string;
  phase: string | null;
  unit: string | null;
  kind: 'competition' | 'ceremony';
  medal: boolean;
  programmeEvent: {
    id: string | null;
    officialName: string | null;
  } | null;
}

export interface GamesTimelineSchedule {
  dateKey: string | null;
  startsAt: string | null;
  endsAt: string | null;
  displayTime: string | null;
  timingType: GamesTimelineTimingType;
  precision: string;
  status: string;
  venue: string | null;
  rescheduled: boolean;
  sequence: number;
}

export interface GamesTimelineCompetitorSide {
  code: string | null;
  label: string;
  participants: string[];
  score: string | number | null;
  isWinner: boolean | null;
}

export interface GamesTimelineIndiaParticipation {
  status: 'confirmed' | 'conditional' | 'unknown' | 'eliminated';
  participants: string[];
  organisations: string[];
  sides: GamesTimelineCompetitorSide[];
}

export interface GamesTimelineRankedEntry {
  name: string;
  organisation: string | null;
  rank: number | null;
  result: string | null;
  qualification: string | null;
  medal: string | null;
  status: string | null;
}

export interface GamesTimelineResult {
  status: 'official' | 'provisional';
  format: 'head-to-head' | 'ranked' | 'summary';
  summary: string | null;
  outcome: 'win' | 'loss' | 'draw' | 'mixed' | null;
  medal: string | null;
  entries: GamesTimelineRankedEntry[];
  sourceUrl: string | null;
  matchedBy: 'official-key' | 'single-unit' | 'schedule-row';
}

export interface GamesTimelineUnitV2 {
  id: string;
  source: GamesTimelineSource;
  sport: GamesTimelineSport;
  event: GamesTimelineEvent;
  schedule: GamesTimelineSchedule;
  india: GamesTimelineIndiaParticipation;
  result: GamesTimelineResult | null;
  programmeSession: GamesTimelineProgrammeSession;
  viewState: GamesTimelineViewState;
}

export interface GamesTimelineIntegrityV2 {
  sessions: number;
  units: number;
  competitionUnits: number;
  ceremonyUnits: number;
  identities: {
    stored: number;
    official: number;
    scheduleRow: number;
    derived: number;
  };
  duplicateUnitsDropped: number;
  unmatchedResultKeys: string[];
}

export interface GamesTimelineResponseV2 {
  contract: 'games-timeline';
  schemaVersion: 2;
  gamesKey: string;
  timezone: 'Asia/Kolkata';
  generatedAt: string;
  units: GamesTimelineUnitV2[];
  integrity: GamesTimelineIntegrityV2;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Fail at the API boundary instead of letting a silent contract drift corrupt the Timeline UI. */
export function assertGamesTimelineV2(value: unknown): asserts value is GamesTimelineResponseV2 {
  if (!isRecord(value) || value['contract'] !== 'games-timeline' || value['schemaVersion'] !== 2) {
    throw new Error('Unsupported games timeline contract. Expected games-timeline schemaVersion 2.');
  }
  if (typeof value['gamesKey'] !== 'string' || value['timezone'] !== 'Asia/Kolkata' || !Array.isArray(value['units'])) {
    throw new Error('Invalid games timeline V2 envelope.');
  }
  const invalidUnit = value['units'].find(unit => {
    if (!isRecord(unit) || typeof unit['id'] !== 'string') return true;
    const event = unit['event'];
    const schedule = unit['schedule'];
    const session = unit['programmeSession'];
    return !isRecord(event) || typeof event['name'] !== 'string'
      || !isRecord(schedule) || typeof schedule['sequence'] !== 'number'
      || !isRecord(session) || typeof session['id'] !== 'string';
  });
  if (invalidUnit) throw new Error('Invalid competition unit in games timeline V2 response.');
}
