import { CalendarEventNavigation } from '../services/payload.service';

export type SportsMomentTimingState = 'exact' | 'session' | 'tbc' | 'conditional';
export type SportsMomentState = 'upcoming' | 'live' | 'completed';
export type SportsMomentImportance = 'primary' | 'high' | 'standard';

export interface SportsMomentAction {
  label: string;
  navigation: CalendarEventNavigation;
}

export interface SportsMomentSport {
  name: string;
  slug: string;
  pictogramUrl: string | null;
}

export interface SportsMomentResult {
  summary: string | null;
  outcome?: 'win' | 'loss' | null;
  winnerCountryCode?: string | null;
  completion?: 'normal' | 'retirement' | 'walkover' | 'disqualification' | null;
  durationSeconds?: number | null;
  score?: {
    india: Array<number | string>;
    opponent: Array<number | string>;
  } | null;
  advanced?: boolean | null;
}

export interface SportsMoment {
  id: string;
  source: 'calendar-event' | 'games-schedule' | 'competition-match' | 'result' | 'release-context';
  sourceEventId: string;
  dateKey: string;
  startTime: string | null;
  sortMinutes: number | null;
  timingState: SportsMomentTimingState;
  timingLabel: string;
  state: SportsMomentState;
  sport: SportsMomentSport;
  headline: string;
  context: string | null;
  competition: string | null;
  importance: SportsMomentImportance;
  resultLabel: string | null;
  result?: SportsMomentResult | null;
  action: SportsMomentAction | null;
  isDisabled?: boolean;
}

export interface SportsMomentAnchor {
  id: string;
  title: string;
  context: string | null;
  location: string | null;
  state: SportsMomentState;
  sport: SportsMomentSport;
  action: SportsMomentAction | null;
}

export interface SportsProgrammeSummary {
  title: string;
  location: string | null;
  totalEvents: number;
  groupLabels: string[];
  action: SportsMomentAction | null;
}

export type SportsTimelineEntry =
  | { kind: 'moment'; id: string; sortMinutes: number; moment: SportsMoment }
  | { kind: 'now'; id: string; sortMinutes: number; label: string };

export interface SportsTimelineDay {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  anchors: SportsMomentAnchor[];
  untimedMoments: SportsMoment[];
  timedEntries: SportsTimelineEntry[];
  programme: SportsProgrammeSummary | null;
  dense: boolean;
  totalMomentCount: number;
}

export interface SportsTimelineViewModel {
  now: Date;
  liveCalendarCount: number;
  rightNow: SportsMoment[];
  nextIndia: SportsMoment | null;
  days: SportsTimelineDay[];
}

export type SportsHomeViewModel = SportsTimelineViewModel;
