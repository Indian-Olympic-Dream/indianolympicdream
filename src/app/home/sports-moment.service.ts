import { Injectable } from '@angular/core';
import { Observable, catchError, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { CalendarEvent, GamesScheduleRow, LiveScoreCoverage, LiveScorePressure, PayloadService } from '../services/payload.service';
import { LiveScoreMap, LiveScoreService } from '../services/live-score.service';
import { TemporalEventEngine } from '../shared/services/temporal-event.engine';
import {
  SportsMoment,
  SportsMomentAction,
  SportsMomentAnchor,
  SportsMomentImportance,
  SportsMomentResult,
  SportsMomentSport,
  SportsMomentState,
  SportsMomentTimingState,
  SportsProgrammeSummary,
  SportsTimelineDay,
  SportsTimelineEntry,
  SportsTimelineViewModel,
} from './sports-moment.model';

const INDIA_TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;
const DENSE_DAY_THRESHOLD = 3;
const BWF_WORLDS_GAMES_KEY = 'bwf-world-championships-2026';
const RECENT_RESULTS_WINDOW_MS = 48 * 60 * 60 * 1000;
const RECENT_RESULTS_LIMIT = 12;

interface AugustEventContext {
  indiaMoment?: { headline: string; context: string };
  dailyCampaign?: { openingHeadline: string; dailyHeadline: string };
}

const AUGUST_2026_HOME_CONTEXT: Record<string, AugustEventContext> = {
  'bwf-world-championships-2026': {
    dailyCampaign: {
      openingHeadline: 'Indian opening-round matches',
      dailyHeadline: 'Indian players in action',
    },
  },
  'diamond-league-lausanne': {
    indiaMoment: {
      headline: 'Neeraj Chopra in Men’s Javelin Throw',
      context: 'Stade Olympique de la Pontaise, Lausanne',
    },
  },
  'indian-open-wact-silver-level-meet': {
    indiaMoment: {
      headline: 'Indian Open World Athletics Continental Tour',
      context: '18-Event Meet Programme · Kalinga Stadium, Bhubaneswar',
    },
  },
};

const HOCKEY_COUNTRY_FLAGS: Record<string, string> = {
  india: '🇮🇳',
  ind: '🇮🇳',
  wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  wal: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  eng: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  china: '🇨🇳',
  chn: '🇨🇳',
  spain: '🇪🇸',
  esp: '🇪🇸',
  germany: '🇩🇪',
  ger: '🇩🇪',
  chile: '🇨🇱',
  chi: '🇨🇱',
  'south africa': '🇿🇦',
  rsa: '🇿🇦',
  belgium: '🇧🇪',
  bel: '🇧🇪',
  netherlands: '🇳🇱',
  ned: '🇳🇱',
  australia: '🇦🇺',
  aus: '🇦🇺',
  argentina: '🇦🇷',
  arg: '🇦🇷',
  'new zealand': '🇳🇿',
  nzl: '🇳🇿',
  france: '🇫🇷',
  fra: '🇫🇷',
  pakistan: '🇵🇰',
  pak: '🇵🇰',
  japan: '🇯🇵',
  jpn: '🇯🇵',
  korea: '🇰🇷',
  kor: '🇰🇷',
  malaysia: '🇲🇾',
  mas: '🇲🇾',
  ireland: '🇮🇪',
  irl: '🇮🇪',
  myanmar: '🇲🇲',
  mmr: '🇲🇲',
  mya: '🇲🇲',
};

function formatMatchupWithFlags(headline: string): string {
  const match = headline.match(/^([A-Za-z\s]+?)\s+(?:vs|v)\s+([A-Za-z\s]+?)$/i);
  if (!match) return headline;

  const team1 = match[1].trim();
  const team2 = match[2].trim();
  const flag1 = HOCKEY_COUNTRY_FLAGS[team1.toLowerCase()];
  const flag2 = HOCKEY_COUNTRY_FLAGS[team2.toLowerCase()];

  if (flag1 && flag2) {
    return `${flag1} ${team1} vs ${flag2} ${team2}`;
  }
  if (flag1) {
    return `${flag1} ${team1} vs ${team2}`;
  }
  if (flag2) {
    return `${team1} vs ${flag2} ${team2}`;
  }
  return headline;
}

@Injectable({
  providedIn: 'root',
})
export class SportsMomentService {
  constructor(
    private payload: PayloadService,
    private temporalEvents: TemporalEventEngine,
    private liveScores: LiveScoreService,
  ) { }

  loadHome(eventsOrNow?: CalendarEvent[] | Date, maybeNow?: Date): Observable<SportsTimelineViewModel> {
    if (Array.isArray(eventsOrNow)) {
      const events = eventsOrNow;
      const now = maybeNow || new Date();
      return this.loadHomeScheduleRows(now).pipe(
        map((scheduleRows) => this.buildViewModel(events, scheduleRows, now)),
      );
    }
    const now = eventsOrNow instanceof Date ? eventsOrNow : new Date();
    return forkJoin({
      events: this.payload.getCalendarEvents({ limit: 120 }),
      scheduleRows: this.loadHomeScheduleRows(now),
    }).pipe(
      map(({ events, scheduleRows }) => this.buildViewModel(events, scheduleRows, now)),
    );
  }

  private loadHomeScheduleRows(now: Date): Observable<GamesScheduleRow[]> {
    const windowStart = this.dateFromKey(this.dateKey(now));
    const recentStart = new Date(now.getTime() - RECENT_RESULTS_WINDOW_MS);
    return forkJoin({
      general: this.payload
        .getUpcomingGamesSchedule(windowStart.toISOString(), 250)
        .pipe(catchError(() => of([]))),
      recent: this.payload
        .getUpcomingGamesSchedule(recentStart.toISOString(), 250)
        .pipe(catchError(() => of([]))),
      bwf: this.payload
        .getEventHubSchedule(BWF_WORLDS_GAMES_KEY)
        .pipe(catchError(() => of([]))),
    }).pipe(
      map(({ general, recent, bwf }) => {
        // The dedicated hub request owns BWF availability. If it fails or is empty,
        // exclude incidental BWF rows from the broad query so the curated fallback survives.
        const nonBwfRows = [...general, ...recent]
          .filter((row) => row.gamesKey !== BWF_WORLDS_GAMES_KEY);
        return [...new Map([...nonBwfRows, ...bwf].map((row) => [row.id, row])).values()];
      }),
      switchMap((rows) => combineLatest([of(rows), this.liveScores.watch(BWF_WORLDS_GAMES_KEY)])),
      map(([rows, live]) => this.applyLiveScores(rows, live)),
    );
  }

  private applyLiveScores(rows: GamesScheduleRow[], live: LiveScoreMap): GamesScheduleRow[] {
    if (!live.size) return rows;
    return rows.map((row) => {
      const publication = live.get(row.id);
      if (!publication || publication.revision < (row.liveCoverage?.revision || 0)) return row;
      return {
        ...row,
        liveCoverage: publication.liveCoverage,
        liveUpdates: publication.updates || [],
        ...(publication.status ? { status: publication.status } : {}),
        ...(publication.result !== undefined ? { result: publication.result } : {}),
      };
    });
  }

  private buildViewModel(
    events: CalendarEvent[],
    scheduleRows: GamesScheduleRow[],
    now: Date,
  ): SportsTimelineViewModel {
    const windowStart = this.dateFromKey(this.dateKey(now));
    const windowEnd = new Date(windowStart.getTime() + (7 * DAY_MS));
    const eventMap = new Map(events.map((event) => [event.id, event]));
    const moments: SportsMoment[] = [];
    const recentResults: SportsMoment[] = [];
    const anchors: SportsMomentAnchor[] = [];
    const programmes = new Map<string, SportsProgrammeSummary>();
    const scheduleDaysByEvent = new Set<string>();
    const recentCutoff = new Date(now.getTime() - RECENT_RESULTS_WINDOW_MS);

    for (const row of scheduleRows) {
      if (!row.calendarEvent?.id) continue;
      const name = (row.name || '').toLowerCase();
      const eventName = (row.eventName || '').toLowerCase();
      const phase = (row.phase || '').toLowerCase();
      if (name.includes('format') || eventName.includes('format') || phase.includes('format')) {
        continue;
      }
      if (['cancelled', 'postponed', 'eliminated'].includes((row.status || '').toLowerCase())) continue;
      const event = eventMap.get(row.calendarEvent.id);
      if (!event || !this.isHomeRelevant(event, true, now)) continue;
      const start = this.parseDate(row.startTime);
      if (!start) continue;
      const moment = this.fromSchedule(row, event, now);

      if (
        start >= recentCutoff &&
        start <= now &&
        row.status === 'completed' &&
        this.hasDisplayableScore(moment)
      ) {
        recentResults.push(moment);
      }

      if (start < windowStart || start >= windowEnd) continue;
      moments.push(moment);
      scheduleDaysByEvent.add(`${event.id}:${moment.dateKey}`);
    }

    for (const event of events) {
      if (!this.isHomeRelevant(event, false, now)) continue;
      const start = this.temporalEvents.parseEventDate(event.startDate, false);
      const end = this.temporalEvents.parseEventDate(event.endDate || event.startDate, true);
      if (!start || !end || end < windowStart || start >= windowEnd) continue;
      const context = event.slug ? AUGUST_2026_HOME_CONTEXT[event.slug] : undefined;

      if (context?.dailyCampaign) {
        for (const date of this.eachIndiaDay(start, end, windowStart, windowEnd)) {
          const dateKey = this.dateKey(date);
          const isOpeningDay = dateKey === this.dateKey(start);
          if (!scheduleDaysByEvent.has(`${event.id}:${dateKey}`)) {
            const roundDetail = this.getBwfDailyRound(dateKey);
            moments.push(this.fromTbcEvent(
              event,
              dateKey,
              isOpeningDay ? context.dailyCampaign.openingHeadline : context.dailyCampaign.dailyHeadline,
              roundDetail,
              now,
            ));
          }
        }
      }

      if (context?.indiaMoment) {
        const dateKey = this.dateKey(start);
        if (!scheduleDaysByEvent.has(`${event.id}:${dateKey}`)) {
          moments.push(this.fromTbcEvent(
            event,
            dateKey,
            context.indiaMoment.headline,
            context.indiaMoment.context,
            now,
          ));
        }
      }
    }

    const upcoming = moments
      .filter((moment) => moment.state === 'upcoming')
      .sort((a, b) => this.momentChronologicalValue(a) - this.momentChronologicalValue(b));
    const nextIndia = upcoming.find((moment) => moment.source === 'games-schedule') || upcoming[0] || null;
    const days = this.buildDays(moments, anchors, programmes, now);
    const rightNow = moments
      .filter((moment) => moment.state === 'live' && moment.importance !== 'standard')
      .sort((a, b) => this.momentSortValue(a) - this.momentSortValue(b));
    const liveCalendarCount = this.temporalEvents
      .buildCalendarFeed(events, now)
      .filter((item) => item.timeGroup === 'live').length;

    recentResults.sort((a, b) =>
      this.momentChronologicalValue(b) - this.momentChronologicalValue(a),
    );

    return {
      now,
      liveCalendarCount,
      rightNow,
      nextIndia,
      recentResults: recentResults.slice(0, RECENT_RESULTS_LIMIT),
      days,
    };
  }

  private fromSchedule(row: GamesScheduleRow, event: CalendarEvent, now: Date): SportsMoment {
    const start = this.parseDate(row.startTime)!;
    const timingState = this.getScheduleTimingState(row);
    const division = this.getDivision(event.title);
    const phase = this.formatPhase(row.phase);
    const context = event.slug ? AUGUST_2026_HOME_CONTEXT[event.slug] : undefined;
    const isBadminton = (event.sport?.slug || '').includes('badminton') || (event.slug || '').includes('bwf');
    const rawHeadline = context?.indiaMoment ? context.indiaMoment.headline : (row.name?.trim() || row.eventName?.trim() || event.title);
    const isHockey = (event.sport?.slug || '').includes('hockey') ||
      (event.sport?.name || '').toLowerCase().includes('hockey') ||
      (event.title || '').toLowerCase().includes('hockey') ||
      (event.category || '').toLowerCase().includes('hockey') ||
      (row.eventName || '').toLowerCase().includes('hockey');
    const headline = isHockey ? formatMatchupWithFlags(rawHeadline) : rawHeadline;
    const contextLine = context?.indiaMoment
      ? context.indiaMoment.context
      : isBadminton
        ? ([row.eventName, phase, this.getBadmintonCourtOrder(row)].filter(Boolean).join(' · ') || null)
        : ([division, row.eventName, phase].filter(Boolean).join(' · ') || null);

    const isConditional = Boolean(row.isConditional || row.participationStatus === 'progression-dependent');
    const sortMinutes = this.getScheduleSortMinutes(row, start, timingState);
    const result = this.getStructuredResult(row.result, row.liveCoverage, row.liveUpdates);
    const state = this.getScheduleState(row, now);
    const resultPending = state === 'completed'
      && !this.hasValidResult(row.result)
      && row.liveCoverage?.status !== 'provisional-complete';
    const action = isConditional ? null : this.buildAction(event, state);

    return {
      id: `schedule:${row.id}`,
      source: 'games-schedule',
      sourceEventId: event.id,
      gamesKey: row.gamesKey || null,
      dateKey: this.dateKey(start),
      startTime: row.startTime,
      sortMinutes,
      timingState: isConditional ? 'conditional' : timingState,
      timingLabel: isConditional ? 'If Qualified' : state === 'live' ? 'Live' : this.getTimingLabel(row, start, timingState),
      state,
      sport: this.getSport(event),
      headline,
      context: contextLine,
      competition: event.category?.trim() || event.title,
      importance: this.getImportance(event),
      resultLabel: result?.summary || this.getResultLabel(row.result) || (resultPending ? 'Official result pending' : null),
      resultPending,
      result,
      action: resultPending && action ? { ...action, label: 'Check result' } : action,
      isDisabled: isConditional,
    };
  }

  private fromTbcEvent(
    event: CalendarEvent,
    dateKey: string,
    headline: string,
    context: string,
    now: Date,
  ): SportsMoment {
    const isBadminton = (event.sport?.slug || '').includes('badminton') || (event.slug || '').includes('bwf');
    const isConditional = isBadminton && dateKey >= '2026-08-19';
    const state = this.momentStateForDate(dateKey, now);
    return {
      id: `event:${event.id}:${dateKey}`,
      source: 'release-context',
      sourceEventId: event.id,
      dateKey,
      startTime: null,
      sortMinutes: null,
      timingState: isConditional ? 'conditional' : 'tbc',
      timingLabel: isConditional ? 'If Qualified' : 'Time TBC',
      state,
      sport: this.getSport(event),
      headline,
      context,
      competition: event.category?.trim() || event.title,
      importance: this.getImportance(event),
      resultLabel: null,
      action: isConditional ? null : this.buildAction(event, state),
      isDisabled: isConditional,
    };
  }

  private buildDays(
    moments: SportsMoment[],
    anchors: SportsMomentAnchor[],
    programmes: Map<string, SportsProgrammeSummary>,
    now: Date,
  ): SportsTimelineDay[] {
    const dateKeys = new Set([
      ...moments.map((moment) => moment.dateKey),
      ...anchors.map((anchor) => anchor.id.split(':').at(-1)!),
      ...programmes.keys(),
    ]);

    return Array.from(dateKeys)
      .sort()
      .map((dateKey) => {
        const dayMoments = moments
          .filter((moment) => moment.dateKey === dateKey)
          .sort((a, b) =>
            this.momentSortValue(a) - this.momentSortValue(b) ||
            this.momentTieBreakValue(a) - this.momentTieBreakValue(b),
          );
        const untimedMoments = dayMoments.filter((moment) => moment.sortMinutes === null);
        const timedMoments = dayMoments.filter(
          (moment): moment is SportsMoment & { sortMinutes: number } => moment.sortMinutes !== null,
        );
        const isToday = dateKey === this.dateKey(now);
        const timedEntries: SportsTimelineEntry[] = timedMoments.map((moment) => ({
          kind: 'moment',
          id: moment.id,
          sortMinutes: moment.sortMinutes,
          moment,
        }));
        if (isToday) {
          timedEntries.push({
            kind: 'now',
            id: `now:${dateKey}`,
            sortMinutes: this.indiaMinutes(now),
            label: this.formatTime(now),
          });
        }
        timedEntries.sort((a, b) => a.sortMinutes - b.sortMinutes || a.id.localeCompare(b.id));
        const date = this.dateFromKey(dateKey);
        const programme = programmes.get(dateKey) || null;
        const totalMomentCount = Math.max(dayMoments.length, programme?.totalEvents || 0);
        return {
          dateKey,
          dayLabel: this.formatDate(date, { weekday: 'short' }).toUpperCase(),
          dateLabel: this.formatDate(date, { day: 'numeric', month: 'short' }).toUpperCase(),
          isToday,
          anchors: anchors.filter((anchor) => anchor.id.endsWith(`:${dateKey}`)),
          untimedMoments,
          timedEntries,
          programme,
          dense: totalMomentCount >= DENSE_DAY_THRESHOLD,
          totalMomentCount,
        };
      });
  }

  private isHomeRelevant(event: CalendarEvent, hasIndiaSchedule: boolean, now: Date): boolean {
    const coverage = this.payload.getCalendarEventExperience(event);
    const start = this.temporalEvents.parseEventDate(event.startDate, false);
    const end = this.temporalEvents.parseEventDate(event.endDate || event.startDate, true);
    if (!start || !end) return false;
    const daysAway = this.dayDifference(this.dateKey(now), this.dateKey(start));
    const context = event.slug ? AUGUST_2026_HOME_CONTEXT[event.slug] : undefined;

    if (coverage === 'live_hub') {
      if (context?.dailyCampaign || context?.indiaMoment) return true;
      return hasIndiaSchedule || this.isIndiaHosted(event);
    }
    if (coverage === 'covered_page') {
      return hasIndiaSchedule || !!context || this.isIndiaHosted(event);
    }
    if (coverage === 'preview_page') return !!context && daysAway >= -1 && daysAway <= 7;
    return false;
  }

  private buildAction(
    event: CalendarEvent,
    state: SportsMomentState,
    campaign = false,
  ): SportsMomentAction | null {
    const navigation = this.payload.getCalendarEventNavigation(event);
    if (navigation.kind === 'none') return null;
    if (event.slug === 'indian-open-wact-silver-level-meet') {
      return { label: 'View 18-Event Programme', navigation };
    }
    const coverage = this.payload.getCalendarEventExperience(event);
    let label = 'View event';
    if (navigation.kind === 'external') {
      label = state === 'completed' ? 'Official results' : 'Official event';
    } else if (coverage === 'live_hub') {
      label = state === 'completed'
        ? 'View result'
        : state === 'live'
          ? 'Follow live'
          : campaign ? "Follow India's campaign" : 'Track India';
    } else if (coverage === 'preview_page') {
      label = 'Preview';
    } else {
      label = 'Track India';
    }
    return { label, navigation };
  }

  private getScheduleTimingState(row: GamesScheduleRow): SportsMomentTimingState {
    if (row.isConditional) return 'conditional';
    if (row.timingPrecision === 'tbd' || row.timingPrecision === 'start-list-pending' || row.timingPrecision === 'draw-dependent') return 'tbc';
    if (row.timingPrecision === 'session-window') return 'session';
    const label = (row.indiaTimeLabel || row.localTimeLabel || '').trim();
    if (/morning|afternoon|evening|session/i.test(label) && !/\d{1,2}:\d{2}/.test(label)) {
      return 'session';
    }
    return this.parseDate(row.startTime) ? 'exact' : 'tbc';
  }

  private getBadmintonCourtOrder(row: GamesScheduleRow): string | null {
    const sourceLabel = row.localTimeLabel || '';
    const order = sourceLabel.match(/\bMatch\s+(\d+)\b/i)?.[1];
    const court = (row.certainty || row.venue || sourceLabel).match(/\bCourt\s+\d+\b/i)?.[0];
    if (court && order) return `${court} · Match ${order} in order`;
    return row.certainty?.trim() || court || null;
  }

  private getScheduleSortMinutes(
    row: GamesScheduleRow,
    start: Date,
    timingState: SportsMomentTimingState,
  ): number | null {
    if (timingState === 'exact') return this.indiaMinutes(start);
    if (timingState === 'session') {
      const label = row.indiaTimeLabel || row.localTimeLabel || '';
      return /\d{1,2}:\d{2}/.test(label) ? this.indiaMinutes(start) : this.sessionMinutes(label);
    }
    return null;
  }

  private getTimingLabel(
    row: GamesScheduleRow,
    start: Date,
    timingState: SportsMomentTimingState,
  ): string {
    if (timingState === 'conditional') return 'If qualified';
    if (timingState === 'session') {
      const explicit = (row.indiaTimeLabel || row.localTimeLabel || '').trim();
      return explicit || 'Session';
    }
    if (timingState === 'tbc') return 'Time TBC';
    return `${this.formatTime(start)} IST`;
  }

  private hasValidResult(result: unknown): boolean {
    if (!result) return false;
    if (typeof result === 'string') {
      const clean = result.trim();
      return clean.length > 0 && !/^(upcoming|pending|tbd|none|null|unstarted|not started)$/i.test(clean);
    }
    if (typeof result === 'object' && result !== null) {
      const r = result as Record<string, unknown>;
      if (typeof r['indiaScore'] === 'number' && typeof r['opponentScore'] === 'number') return true;
      if (typeof r['summary'] === 'string' && r['summary'].trim().length > 0) return true;
      if (typeof r['rank'] === 'number' || typeof r['position'] === 'number' || (typeof r['medal'] === 'string' && r['medal'].trim().length > 0)) return true;
      return false;
    }
    return false;
  }

  private hasDisplayableScore(moment: SportsMoment): boolean {
    const result = moment.result;
    if (!result?.summary?.trim()) return false;
    if (result.matchScore) return true;
    return Boolean(
      result.score?.india.length &&
      result.score.india.length === result.score.opponent.length,
    );
  }

  private getScheduleState(row: GamesScheduleRow, now: Date): SportsMomentState {
    if (row.liveCoverage?.enabled) {
      if (row.liveCoverage.status === 'live' || row.liveCoverage.status === 'suspended') return 'live';
      if (row.liveCoverage.status === 'provisional-complete') return 'completed';
    }
    if (row.status === 'live') return 'live';
    if (row.status === 'completed') return 'completed';
    if (this.hasValidResult(row.result)) return 'completed';
    const start = this.parseDate(row.startTime);
    if (!start) return 'upcoming';
    const end = row.endTime ? this.parseDate(row.endTime) : new Date(start.getTime() + 90 * 60 * 1000);
    if (now >= start && (!end || now <= end)) return 'live';
    if (end && now > end) return 'completed';
    return 'upcoming';
  }

  private momentStateForDate(dateKey: string, now: Date): SportsMomentState {
    const todayKey = this.dateKey(now);
    if (dateKey < todayKey) return 'completed';
    if (dateKey === todayKey) return 'upcoming';
    return 'upcoming';
  }

  private getSport(event: CalendarEvent): SportsMomentSport {
    return {
      name: event.sport?.name || 'Olympic Sport',
      slug: event.sport?.slug || 'sport',
      pictogramUrl: this.payload.getSportPictogramUrl({ sport: event.sport }),
    };
  }

  private getDivision(title: string): string | null {
    if (/\bmen\b/i.test(title)) return 'Men';
    if (/\bwomen\b/i.test(title)) return 'Women';
    if (/\bmixed\b/i.test(title)) return 'Mixed';
    return null;
  }

  private formatPhase(phase?: string | null): string | null {
    if (!phase) return null;
    return phase.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private getImportance(event: CalendarEvent): SportsMomentImportance {
    const title = event.title.toLowerCase();
    if (title.includes('olympic') || title.includes('world championship') || title.includes('world cup')) {
      return 'primary';
    }
    if (title.includes('diamond league') || title.includes('continental')) return 'high';
    return 'standard';
  }

  private getResultLabel(result: unknown): string | null {
    if (!this.hasValidResult(result)) return null;
    if (typeof result === 'string') return result;
    if (typeof result === 'object' && result !== null) {
      const r = result as Record<string, unknown>;
      if (typeof r['indiaScore'] === 'number' && typeof r['opponentScore'] === 'number') {
        return `IND ${r['indiaScore']} - ${r['opponentScore']} ${r['opponentCode'] || 'OPP'}`;
      }
      if (typeof r['summary'] === 'string' && r['summary'].trim().length > 0) return r['summary'];
      if (typeof r['rank'] === 'number') return `Rank ${r['rank']}`;
      if (typeof r['position'] === 'number') return `Pos ${r['position']}`;
      if (typeof r['medal'] === 'string' && r['medal'].trim().length > 0) return `${r['medal']} Medal`;
    }
    return null;
  }

  private getStructuredResult(
    result: unknown,
    liveCoverage?: LiveScoreCoverage | null,
    liveUpdates: GamesScheduleRow['liveUpdates'] = [],
  ): SportsMomentResult | null {
    const raw = result && typeof result === 'object' && !Array.isArray(result)
      ? result as Record<string, unknown>
      : {};
    const isLiveCoverage = Boolean(
      liveCoverage?.enabled && ['live', 'suspended', 'provisional-complete'].includes(liveCoverage.status),
    );
    const rawScore = raw['score'];
    let score: SportsMomentResult['score'] = null;
    if (rawScore && typeof rawScore === 'object' && !Array.isArray(rawScore)) {
      const scoreRecord = rawScore as Record<string, unknown>;
      const india = Array.isArray(scoreRecord['india']) ? scoreRecord['india'] : [];
      const opponent = Array.isArray(scoreRecord['opponent']) ? scoreRecord['opponent'] : [];
      if (india.length && india.length === opponent.length) {
        score = {
          india: india.filter((value): value is number | string => typeof value === 'number' || typeof value === 'string'),
          opponent: opponent.filter((value): value is number | string => typeof value === 'number' || typeof value === 'string'),
        };
      }
    }

    const liveGames = liveCoverage?.score?.games || [];
    if (isLiveCoverage && liveGames.length) {
      score = {
        india: liveGames.map((game) => game.india),
        opponent: liveGames.map((game) => game.opponent),
      };
    }

    let matchScore: SportsMomentResult['matchScore'] = null;
    if (rawScore && typeof rawScore === 'object' && !Array.isArray(rawScore)) {
      const scoreRecord = rawScore as Record<string, unknown>;
      if (['home', 'away', 'india', 'opponent'].every((key) => typeof scoreRecord[key] === 'number')) {
        matchScore = {
          home: scoreRecord['home'] as number,
          away: scoreRecord['away'] as number,
          india: scoreRecord['india'] as number,
          opponent: scoreRecord['opponent'] as number,
        };
      }
    }

    const outcome = ['win', 'loss', 'draw'].includes(String(raw['outcome']))
      ? raw['outcome'] as SportsMomentResult['outcome']
      : null;
    const completion = ['normal', 'retirement', 'walkover', 'disqualification'].includes(String(raw['completion']))
      ? raw['completion'] as SportsMomentResult['completion']
      : null;
    const rawMatchup = raw['matchup'];
    let matchup: SportsMomentResult['matchup'] = null;
    if (rawMatchup && typeof rawMatchup === 'object' && !Array.isArray(rawMatchup)) {
      const matchupRecord = rawMatchup as Record<string, unknown>;
      const india = matchupRecord['india'];
      const opponent = matchupRecord['opponent'];
      const indiaRecord = india && typeof india === 'object' && !Array.isArray(india)
        ? india as Record<string, unknown>
        : null;
      const opponentRecord = opponent && typeof opponent === 'object' && !Array.isArray(opponent)
        ? opponent as Record<string, unknown>
        : null;
      matchup = {
        indiaCountryCode: typeof indiaRecord?.['countryCode'] === 'string' ? indiaRecord['countryCode'] : null,
        opponentCountryCode: typeof opponentRecord?.['countryCode'] === 'string' ? opponentRecord['countryCode'] : null,
        indiaDisplayName: typeof indiaRecord?.['displayName'] === 'string' ? indiaRecord['displayName'] : null,
        opponentDisplayName: typeof opponentRecord?.['displayName'] === 'string' ? opponentRecord['displayName'] : null,
        indiaPlayers: Array.isArray(indiaRecord?.['players'])
          ? indiaRecord!['players'].filter((value): value is string => typeof value === 'string')
          : [],
        opponentPlayers: Array.isArray(opponentRecord?.['players'])
          ? opponentRecord!['players'].filter((value): value is string => typeof value === 'string')
          : [],
        indiaSeed: indiaRecord?.['seed'] == null ? null : String(indiaRecord['seed']),
        opponentSeed: opponentRecord?.['seed'] == null ? null : String(opponentRecord['seed']),
      };
    }

    const currentLiveGame = liveGames[(liveCoverage?.currentGame || 1) - 1];
    const liveSummary = liveCoverage?.status === 'provisional-complete'
      ? 'Awaiting official result'
      : currentLiveGame
        ? `Game ${liveCoverage?.currentGame || 1} · ${currentLiveGame.india}–${currentLiveGame.opponent}`
        : null;

    if (!Object.keys(raw).length && !isLiveCoverage) return null;

    return {
      summary: typeof raw['summary'] === 'string' ? raw['summary'] : (liveSummary || this.getResultLabel(result)),
      matchup,
      outcome,
      winnerCountryCode: typeof raw['winnerCountryCode'] === 'string' ? raw['winnerCountryCode'] : null,
      completion,
      durationSeconds: typeof raw['durationSeconds'] === 'number' ? raw['durationSeconds'] : null,
      score,
      matchScore,
      live: isLiveCoverage && liveCoverage ? {
        revision: liveCoverage.revision,
        currentGame: liveCoverage.currentGame,
        servingSide: liveCoverage.servingSide,
        status: liveCoverage.status as 'live' | 'suspended' | 'provisional-complete',
        phase: liveCoverage.phase || (liveCoverage.status === 'provisional-complete' ? 'complete' : 'in-play'),
        updatedAt: liveCoverage.lastPublishedAt || null,
        startedAt: liveCoverage.startedAt || null,
        provisionalCompletedAt: liveCoverage.provisionalCompletedAt || null,
        officialPublishedAt: liveCoverage.officialPublishedAt || null,
        elapsedSeconds: this.getLiveElapsedSeconds(liveCoverage),
        pressure: liveCoverage.pressure || this.deriveLivePressure(liveCoverage),
        challenge: liveCoverage.challenge || null,
        currentScore: currentLiveGame
          ? { india: currentLiveGame.india, opponent: currentLiveGame.opponent }
          : null,
        updates: liveUpdates || [],
      } : null,
      advanced: typeof raw['advanced'] === 'boolean' ? raw['advanced'] : null,
    };
  }

  private isIndiaHosted(event: CalendarEvent): boolean {
    const text = `${event.location || ''} ${event.country || ''}`.toLowerCase();
    return text.includes('india') || text.includes('bhubaneswar') || text.includes('new delhi');
  }

  private getLiveElapsedSeconds(coverage: LiveScoreCoverage): number | null {
    if (!coverage.startedAt) return null;
    const started = new Date(coverage.startedAt).getTime();
    const ended = coverage.provisionalCompletedAt
      ? new Date(coverage.provisionalCompletedAt).getTime()
      : coverage.lastPublishedAt
        ? new Date(coverage.lastPublishedAt).getTime()
        : Date.now();
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return null;
    return Math.round((ended - started) / 1000);
  }

  private deriveLivePressure(coverage: LiveScoreCoverage): LiveScorePressure | null {
    if (coverage.status !== 'live' || (coverage.phase && coverage.phase !== 'in-play')) return null;
    const games = coverage.score?.games || [];
    const game = games[(coverage.currentGame || 1) - 1];
    if (!game || game.complete) return null;
    const wins = (side: 'india' | 'opponent') => games.filter((entry) => entry.complete && entry.winner === side).length;
    const winsWithNextPoint = (side: 'india' | 'opponent'): boolean => {
      const india = game.india + (side === 'india' ? 1 : 0);
      const opponent = game.opponent + (side === 'opponent' ? 1 : 0);
      const high = Math.max(india, opponent);
      const low = Math.min(india, opponent);
      return high >= 21 && (high === 30 || high - low >= 2) &&
        (side === 'india' ? india > opponent : opponent > india);
    };
    const sides = (['india', 'opponent'] as const).filter(winsWithNextPoint);
    if (!sides.length) return null;
    return {
      kind: sides.some((side) => wins(side) >= 1) ? 'match-point' : 'game-point',
      side: sides.length === 2 ? 'both' : sides[0],
    };
  }

  private sessionMinutes(label?: string | null): number {
    const clean = (label || '').toLowerCase();
    if (clean.includes('morning')) return 9 * 60;
    if (clean.includes('afternoon')) return 14 * 60;
    if (clean.includes('evening') || clean.includes('night')) return 18 * 60;
    return 12 * 60;
  }

  private momentSortValue(moment: SportsMoment): number {
    if (moment.sortMinutes !== null) return moment.sortMinutes;
    if (moment.timingState === 'conditional') return 23 * 60 + 59;
    return 12 * 60;
  }

  private momentChronologicalValue(moment: SportsMoment): number {
    return this.dateFromKey(moment.dateKey).getTime() + (this.momentSortValue(moment) * 60_000);
  }

  private momentTieBreakValue(moment: SportsMoment): number {
    const context = moment.context || '';
    const court = Number(context.match(/\bCourt\s+(\d+)\b/i)?.[1] || 99);
    const order = Number(context.match(/\bMatch\s+(\d+)\s+in order\b/i)?.[1] || 99);
    return (court * 100) + order;
  }

  private eachIndiaDay(
    start: Date,
    end: Date,
    windowStart: Date,
    windowEnd: Date,
  ): Date[] {
    const days: Date[] = [];
    let current = new Date(Math.max(start.getTime(), windowStart.getTime()));
    const finalEnd = new Date(Math.min(end.getTime(), windowEnd.getTime() - 1));
    while (current <= finalEnd) {
      days.push(new Date(current));
      current = new Date(current.getTime() + DAY_MS);
    }
    return days;
  }

  private parseDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private dateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: INDIA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private dateFromKey(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00+05:30`);
  }

  private indiaMinutes(date: Date): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: INDIA_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    return read('hour') * 60 + read('minute');
  }

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: INDIA_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }

  private formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TIME_ZONE, ...options }).format(date);
  }

  private dayDifference(fromKey: string, toKey: string): number {
    return Math.round((this.dateFromKey(toKey).getTime() - this.dateFromKey(fromKey).getTime()) / DAY_MS);
  }

  private getBwfDailyRound(dateKey: string): string {
    switch (dateKey) {
      case '2026-08-17':
        return 'Round of 64 · Order of play to follow';
      case '2026-08-18':
        return 'Round of 32 (Seeded Byes) · Order of play to follow';
      case '2026-08-19':
        return 'Round of 32 · Order of play to follow';
      case '2026-08-20':
        return 'Round of 16 · Order of play to follow';
      case '2026-08-21':
        return 'Quarter-finals · Order of play to follow';
      case '2026-08-22':
        return 'Semi-finals · Order of play to follow';
      case '2026-08-23':
        return 'Finals (Medal Matches) · Order of play to follow';
      default:
        return 'Order of play to follow';
    }
  }
}
