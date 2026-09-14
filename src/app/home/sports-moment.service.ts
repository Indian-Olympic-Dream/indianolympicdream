import { Injectable } from '@angular/core';
import { Observable, catchError, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { CalendarEvent, GamesScheduleRow, LiveScoreCoverage, LiveScorePressure, PayloadService } from '../services/payload.service';
import { LiveScoreMap, LiveScoreService } from '../services/live-score.service';
import { TemporalEventEngine } from '../shared/services/temporal-event.engine';
import { getGamesHubRegistration } from '../games/games-hub.registry';
import { hasIndiaAppearance } from '../games/games-hub.presentation';
import {
  SportsMoment,
  SportsMomentAction,
  SportsMomentAnchor,
  HomeCampaignPreview,
  HomeEventPreview,
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
const REALTIME_GAMES_KEYS = new Set([BWF_WORLDS_GAMES_KEY]);
const RECENT_RESULTS_WINDOW_MS = 7 * DAY_MS;
const RECENT_RESULTS_LIMIT = 12;
const COMING_UP_WINDOW_MS = 18 * DAY_MS;
const HORIZON_WINDOW_MS = 60 * DAY_MS;
const COMING_UP_LIMIT = 3;

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
      events: this.payload.getCalendarEvents({
        activeAfter: new Date(now.getTime() - (21 * DAY_MS)).toISOString(),
        limit: 500,
      }),
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
    }).pipe(
      map(({ general, recent }) =>
        [...new Map([...general, ...recent].map((row) => [row.id, row])).values()],
      ),
      switchMap((rows) => {
        const liveKeys = Array.from(new Set(
          rows
            .map((row) => row.gamesKey)
            .filter((key): key is string => Boolean(key && REALTIME_GAMES_KEYS.has(key))),
        ));
        if (!liveKeys.length) return of(rows);
        return combineLatest(liveKeys.map((key) => this.liveScores.watch(key))).pipe(
          map((streams) => streams.reduce(
            (currentRows, stream) => this.applyLiveScores(currentRows, stream),
            rows,
          )),
        );
      }),
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
      if (!this.isIndiaScheduleRow(row)) continue;
      const event = eventMap.get(row.calendarEvent.id);
      if (!event) continue;
      const start = this.parseDate(row.startTime);
      if (!start) continue;
      const moment = this.fromSchedule(row, event, now);

      if (
        start >= recentCutoff &&
        start <= now &&
        moment.state === 'completed' &&
        this.hasDisplayableScore(moment)
      ) {
        recentResults.push(moment);
      }

      if (start < windowStart || start >= windowEnd) continue;
      moments.push(moment);
    }

    const upcoming = moments
      .filter((moment) => moment.state === 'upcoming')
      .sort((a, b) => this.momentChronologicalValue(a) - this.momentChronologicalValue(b));
    const nextIndia = upcoming.find((moment) => moment.source === 'games-schedule') || upcoming[0] || null;
    const days = this.buildDays(moments, anchors, programmes, now);
    const rightNow = moments
      .filter((moment) => moment.state === 'live' && moment.result?.live?.status === 'live')
      .sort((a, b) => this.momentSortValue(a) - this.momentSortValue(b));
    const ongoingEvents = this.buildOngoingEvents(events, now);
    const horizon = this.buildHorizon(events, now);
    const comingUp = this.buildComingUp(events, now, horizon?.id || null);

    recentResults.sort((a, b) =>
      this.momentChronologicalValue(b) - this.momentChronologicalValue(a),
    );

    return {
      now,
      ongoingEvents,
      rightNow,
      nextIndia,
      recentResults: recentResults.slice(0, RECENT_RESULTS_LIMIT),
      days,
      comingUp,
      horizon,
    };
  }

  private buildOngoingEvents(events: CalendarEvent[], now: Date): HomeEventPreview[] {
    // Date-window competitions are useful even without IOD scoring or a stream.
    // Keep the badge and visible cards backed by exactly the same collection.
    return this.temporalEvents.buildCalendarFeed(events, now)
      .filter((item) => ['active', 'live'].includes(item.effectiveState)
        && !['cancelled', 'postponed'].includes(item.event.status || ''))
      .map((item) => ({
        id: `calendar-ongoing:${item.event.id}`,
        title: item.event.title,
        sport: this.getSport(item.event),
        context: item.categoryLabel || item.summaryLabel,
        location: item.locationLabel || null,
        dateLabel: item.dateLabel,
        relativeLabel: 'Ongoing',
        importance: this.getCalendarImportance(item.event),
        action: this.buildAction(item.event, 'upcoming'),
      }));
  }

  private buildComingUp(
    events: CalendarEvent[],
    now: Date,
    horizonId: string | null,
  ): HomeEventPreview[] {
    const windowEnd = new Date(now.getTime() + COMING_UP_WINDOW_MS);
    const selected = this.temporalEvents
      .buildCalendarFeed(events, now)
      .filter((item) => {
        const start = this.temporalEvents.parseEventDate(item.event.startDate, false);
        if (!start || start < this.dateFromKey(this.dateKey(now)) || start > windowEnd) return false;
        if (item.effectiveState !== 'upcoming') return false;
        if (item.event.hubKey && `hub:${item.event.hubKey}` === horizonId) return false;
        return this.isCalendarPreviewRelevant(item.event);
      })
      .sort((a, b) => {
        const priority = this.calendarPreviewPriority(b.event) - this.calendarPreviewPriority(a.event);
        return priority || a.sortValue - b.sortValue;
      })
      .slice(0, COMING_UP_LIMIT)
      .sort((a, b) => a.sortValue - b.sortValue);

    return selected.map((item) => ({
      id: `calendar-preview:${item.event.id}`,
      title: item.event.title,
      sport: this.getSport(item.event),
      context: item.categoryLabel || item.summaryLabel,
      location: item.locationLabel || null,
      dateLabel: item.dateLabel,
      relativeLabel: item.relativeLabel,
      importance: this.getCalendarImportance(item.event),
      action: this.buildAction(item.event, 'upcoming'),
    }));
  }

  private buildHorizon(events: CalendarEvent[], now: Date): HomeCampaignPreview | null {
    const today = this.dateFromKey(this.dateKey(now));
    const windowEnd = new Date(today.getTime() + HORIZON_WINDOW_MS);
    // Registered Games retain their own ceremony dates; individual sport windows
    // can begin earlier. An unrelated Calendar record cannot move those dates.
    for (const event of events) {
      const hub = getGamesHubRegistration(event.hubKey);
      if (!hub || new Date(hub.start) > windowEnd || new Date(hub.end) < today) continue;
      const linked = events.filter((item) => item.hubKey === hub.hubKey
        && new Date(item.endDate || item.startDate) >= new Date(hub.competitionStart)
        && new Date(item.startDate) <= new Date(hub.end));
      if (!linked.length) continue;
      const days = Math.ceil((new Date(hub.start).getTime() - now.getTime()) / DAY_MS);
      return {
        id: `hub:${hub.hubKey}`, hubKey: hub.hubKey, eventIds: linked.map((item) => item.id),
        title: hub.title, context: hub.homeContext, location: hub.location, dateLabel: hub.dateLabel,
        relativeLabel: days > 0 ? `Opening day in ${days} ${days === 1 ? 'day' : 'days'}` : 'The Games are on',
        sportCount: new Set(linked.map((item) => item.sport?.slug).filter(Boolean)).size,
        action: { label: 'Open Asian Games Hub', navigation: {
          experience: 'covered_page', kind: 'internal', routerLink: hub.route, href: null, target: null, rel: null,
        } },
      };
    }
    const situation = this.temporalEvents
      .groupEventSituations(events)
      .filter((item) =>
        Boolean(item.hubKey) &&
        item.events.length > 1 &&
        item.startDate >= today &&
        item.startDate <= windowEnd &&
        this.temporalEvents.getImportance(item.events) === 'core'
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

    if (!situation) return null;
    const lead = this.temporalEvents.getLeadEvent(situation.events);
    const sportCount = new Set(
      situation.events.map((event) => event.sport?.parentSport?.slug || event.sport?.slug).filter(Boolean),
    ).size;
    const location = this.temporalEvents.formatLocation(lead.location, lead.country) || null;
    const daysAway = Math.max(0, Math.ceil((situation.startDate.getTime() - today.getTime()) / DAY_MS));
    const hub = getGamesHubRegistration(situation.hubKey);

    return {
      id: situation.id,
      hubKey: situation.hubKey!,
      eventIds: situation.events.map((event) => event.id),
      title: hub?.title || this.temporalEvents.getSituationTitle(situation),
      context: hub?.homeContext || "India's campaign, day by day",
      location,
      dateLabel: this.temporalEvents.formatDateRange(situation.startDate, situation.endDate),
      relativeLabel: daysAway === 0
        ? 'India starts today'
        : daysAway === 1
          ? 'India starts tomorrow'
          : `India starts in ${daysAway} days`,
      sportCount,
      action: {
        label: hub ? 'Open Games hub' : 'Open Games calendar',
        navigation: {
          experience: 'external_only',
          kind: 'internal',
          routerLink: hub?.route || ['/calendar'],
          href: null,
          target: null,
          rel: null,
        },
      },
    };
  }

  private isCalendarPreviewRelevant(event: CalendarEvent): boolean {
    const coverage = this.payload.getCalendarEventExperience(event);
    if (coverage !== 'external_only') return true;
    const scope = `${event.type || ''} ${event.eventScope || ''}`.toLowerCase();
    return scope.includes('domestic') || this.isIndiaHosted(event) || Boolean(event.indianParticipants?.length);
  }

  private calendarPreviewPriority(event: CalendarEvent): number {
    const coverageRank = {
      external_only: 0,
      preview_page: 3,
      covered_page: 4,
      live_hub: 5,
    }[this.payload.getCalendarEventExperience(event)];
    const importanceRank: Record<string, number> = { context: 0, watch: 1, high: 2, core: 3 };
    const indiaSignal = this.isIndiaHosted(event) || Boolean(event.indianParticipants?.length) ? 3 : 0;
    const domesticSignal = `${event.type || ''} ${event.eventScope || ''}`.toLowerCase().includes('domestic') ? 2 : 0;
    return (coverageRank * 100) + (indiaSignal * 10) + (domesticSignal * 10) +
      (importanceRank[event.importance || 'context'] || 0);
  }

  private getCalendarImportance(event: CalendarEvent): SportsMomentImportance {
    if (event.importance === 'core') return 'primary';
    if (event.importance === 'high' || event.importance === 'watch') return 'high';
    return 'standard';
  }

  private fromSchedule(row: GamesScheduleRow, event: CalendarEvent, now: Date): SportsMoment {
    const start = this.parseDate(row.startTime)!;
    const timingState = this.getScheduleTimingState(row);
    const division = this.getDivision(event.title);
    const phase = this.formatPhase(row.phase);
    const isBadminton = (event.sport?.slug || '').includes('badminton') || (event.slug || '').includes('bwf');
    const headline = row.name?.trim() || row.eventName?.trim() || event.title;
    const contextLine = isBadminton
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

  private isIndiaScheduleRow(row: GamesScheduleRow): boolean {
    if (row.gamesKey === 'asian-games-2026') return hasIndiaAppearance(row);
    return row.participationStatus === 'confirmed';
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
      label = event.whereToWatch?.url === navigation.href ? 'Where to watch' : 'Official event';
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
    // A scheduled start is not evidence of live play or a live score feed.
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
      name: event.sport?.name || 'Sport',
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
    if (event.importance === 'core') return 'primary';
    if (event.importance === 'high' || event.importance === 'watch') return 'high';
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

}
