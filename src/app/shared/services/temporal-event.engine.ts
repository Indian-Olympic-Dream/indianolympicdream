import { Injectable, inject } from '@angular/core';
import {
  CalendarEvent,
  CalendarEventExperience,
  CalendarEventNavigation,
  GamesScheduleRow,
  PayloadService,
  Sport,
} from '../../services/payload.service';

export type EventTemporalState =
  | 'upcoming'
  | 'active'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'postponed';

export type CalendarTimeGroup =
  | 'live'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'later'
  | 'completed';

export interface TemporalEventPresentation {
  event: CalendarEvent;
  effectiveState: EventTemporalState;
  timeGroup: CalendarTimeGroup;
  relativeLabel: string;
  dateLabel: string;
  sport: Sport | null;
  sportName: string;
  sportSlug: string;
  pictogramUrl: string | null;
  importanceClass: string;
  importanceLabel: string;
  sortValue: number;
  locationLabel: string;
  categoryLabel: string;
  typeLabel: string;
  summaryLabel: string | null;
  navigation: CalendarEventNavigation;
}

export interface TemporalEventSituation {
  id: string;
  hubKey: string | null;
  events: CalendarEvent[];
  startDate: Date;
  endDate: Date;
}

export interface JourneyFixtureViewModel {
  row: GamesScheduleRow;
  state: EventTemporalState;
  dateLabel: string;
  dayLabel: string;
  divisionLabel: string | null;
  contextLabel: string | null;
  isEmphasized: boolean;
}

const INDIA_TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 86_400_000;
const COVERAGE_RANK: Record<CalendarEventExperience, number> = {
  external_only: 0,
  preview_page: 1,
  covered_page: 2,
  live_hub: 3,
};
const IMPORTANCE_RANK: Record<string, number> = {
  context: 0,
  watch: 1,
  high: 2,
  core: 3,
};

@Injectable({ providedIn: 'root' })
export class TemporalEventEngine {
  private payload = inject(PayloadService);

  buildCalendarFeed(events: CalendarEvent[], now = new Date()): TemporalEventPresentation[] {
    return events
      .map((event) => this.presentEvent(event, now))
      .filter((item): item is TemporalEventPresentation => item !== null)
      .sort((a, b) => {
        const groupOrder = this.groupSortOrder(a.timeGroup) - this.groupSortOrder(b.timeGroup);
        return groupOrder || a.sortValue - b.sortValue;
      });
  }

  presentEvent(event: CalendarEvent, now = new Date()): TemporalEventPresentation | null {
    const startDate = this.parseEventDate(event.startDate, false);
    const endDate = this.parseEventDate(event.endDate || event.startDate, true);
    if (!startDate || !endDate || this.isSeasonWrapperEvent(event, startDate, endDate)) {
      return null;
    }

    const sport = event.sport || null;
    const parentSport = sport?.parentSport || null;
    const resolvedSport = parentSport || sport;
    const effectiveState = this.deriveEventState(event, [], now);

    return {
      event,
      effectiveState,
      timeGroup: this.getCalendarTimeGroup(event, effectiveState, startDate, now),
      relativeLabel: this.getRelativeLabel(event, effectiveState, startDate, now),
      dateLabel: this.formatDateRange(startDate, endDate),
      sport,
      sportName: resolvedSport?.name || 'Sport',
      sportSlug: resolvedSport?.slug || sport?.slug || 'unknown',
      pictogramUrl: this.payload.getSportPictogramUrl({
        sport,
        parentSport,
        includePlaceholderFallback: false,
      }),
      importanceClass: this.getImportanceClass(event.importance),
      importanceLabel: this.getImportanceLabel(event.importance),
      sortValue: startDate.getTime(),
      locationLabel: this.formatLocation(event.location, event.country),
      categoryLabel: this.getCategoryLabel(event),
      typeLabel: this.getTypeLabel(event.type, event.category),
      summaryLabel: event.summary?.trim() || null,
      navigation: this.payload.getCalendarEventNavigation(event),
    };
  }

  groupEventSituations(events: CalendarEvent[]): TemporalEventSituation[] {
    const groups = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      if (!event?.id || !event.startDate) continue;
      const hubKey = event.hubKey?.trim() || null;
      const groupKey = hubKey ? `hub:${hubKey}` : `event:${event.id}`;
      groups.set(groupKey, [...(groups.get(groupKey) || []), event]);
    }

    return Array.from(groups.entries()).flatMap(([id, groupedEvents]) => {
      const valid = groupedEvents.filter((event) => this.parseEventDate(event.startDate, false));
      if (!valid.length) return [];
      const starts = valid.map((event) => this.parseEventDate(event.startDate, false)!);
      const ends = valid.map((event) =>
        this.parseEventDate(event.endDate || event.startDate, true)!,
      );
      return [{
        id,
        hubKey: valid[0].hubKey?.trim() || null,
        events: [...valid].sort(
          (a, b) =>
            this.parseEventDate(a.startDate, false)!.getTime() -
            this.parseEventDate(b.startDate, false)!.getTime(),
        ),
        startDate: new Date(Math.min(...starts.map((date) => date.getTime()))),
        endDate: new Date(Math.max(...ends.map((date) => date.getTime()))),
      }];
    });
  }

  deriveSituationState(
    situation: TemporalEventSituation,
    rows: GamesScheduleRow[],
    now = new Date(),
  ): EventTemporalState {
    const explicitState = situation.events
      .map((event) => (event.status || '').toLowerCase())
      .find((status) => status === 'cancelled' || status === 'postponed');
    if (explicitState === 'cancelled' || explicitState === 'postponed') return explicitState;
    if (rows.some((row) => this.deriveFixtureState(row, now) === 'live')) return 'live';
    if (now.getTime() < situation.startDate.getTime()) return 'upcoming';
    if (now.getTime() <= situation.endDate.getTime()) return 'active';
    return 'completed';
  }

  deriveEventState(
    event: CalendarEvent,
    rows: GamesScheduleRow[] = [],
    now = new Date(),
  ): EventTemporalState {
    const explicitStatus = (event.status || '').toLowerCase();
    if (explicitStatus === 'cancelled' || explicitStatus === 'postponed') return explicitStatus;
    if (rows.some((row) => this.deriveFixtureState(row, now) === 'live')) return 'live';

    const start = this.parseEventDate(event.startDate, false);
    const end = this.parseEventDate(event.endDate || event.startDate, true);
    if (!start || !end || now.getTime() < start.getTime()) return 'upcoming';
    if (now.getTime() > end.getTime()) return 'completed';
    if (explicitStatus === 'live') return 'live';
    return 'active';
  }

  deriveFixtureState(row: GamesScheduleRow, now = new Date()): EventTemporalState {
    if (row.liveCoverage?.enabled) {
      if (row.liveCoverage.status === 'live' || row.liveCoverage.status === 'suspended') return 'live';
      if (row.liveCoverage.status === 'provisional-complete') return 'completed';
    }
    const explicitStatus = (row.status || '').toLowerCase();
    if (explicitStatus === 'cancelled' || explicitStatus === 'postponed') return explicitStatus;
    if (explicitStatus === 'live') return 'live';
    if (explicitStatus === 'completed' || explicitStatus === 'eliminated') return 'completed';
    const start = new Date(row.startTime);
    if (Number.isNaN(start.getTime())) return 'upcoming';
    const end = row.endTime
      ? new Date(row.endTime)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    if (now.getTime() < start.getTime()) return 'upcoming';
    if (now.getTime() <= end.getTime()) return 'live';
    return 'completed';
  }

  presentFixture(
    row: GamesScheduleRow,
    now = new Date(),
    isEmphasized = false,
  ): JourneyFixtureViewModel {
    const start = new Date(row.startTime);
    const divisionMatch = row.calendarEvent?.title?.match(/\b(men(?:'s)?|women(?:'s)?|mixed)\b/i);
    return {
      row,
      state: this.deriveFixtureState(row, now),
      dateLabel: this.formatDate(start, { day: 'numeric', month: 'short' }),
      dayLabel: this.formatDate(start, { weekday: 'short' }),
      divisionLabel: divisionMatch ? this.toTitleCase(divisionMatch[1].replace("'s", '')) : null,
      contextLabel: [row.eventName, this.formatPhase(row.phase)].filter(Boolean).join(' · ') || null,
      isEmphasized,
    };
  }

  getNavigationLabel(
    event: CalendarEvent,
    navigation: CalendarEventNavigation,
    state: EventTemporalState,
  ): string | null {
    if (navigation.kind === 'external') {
      if (event.whereToWatch?.url) {
        return (event.whereToWatch.label || '').trim() ||
          (state === 'completed' ? 'Watch Replay' : 'Where to Watch');
      }
      return state === 'completed' ? 'Official Results' : 'Official Source';
    }
    if (navigation.kind === 'internal') {
      if (navigation.experience === 'live_hub') return 'Live Hub';
      if (navigation.experience === 'covered_page') return 'Event Hub';
      return 'Event Detail';
    }
    return null;
  }

  getCoverage(events: CalendarEvent[]): CalendarEventExperience {
    return events
      .map((event) => this.payload.getCalendarEventExperience(event))
      .sort((a, b) => COVERAGE_RANK[b] - COVERAGE_RANK[a])[0] || 'external_only';
  }

  getImportance(events: CalendarEvent[]): string {
    return events
      .map((event) => event.importance || 'context')
      .sort((a, b) => (IMPORTANCE_RANK[b] || 0) - (IMPORTANCE_RANK[a] || 0))[0];
  }

  getLeadEvent(events: CalendarEvent[]): CalendarEvent {
    return [...events].sort((a, b) => {
      const coverage = COVERAGE_RANK[this.payload.getCalendarEventExperience(b)] -
        COVERAGE_RANK[this.payload.getCalendarEventExperience(a)];
      return coverage ||
        (IMPORTANCE_RANK[b.importance || 'context'] || 0) -
        (IMPORTANCE_RANK[a.importance || 'context'] || 0);
    })[0];
  }

  getSituationTitle(situation: TemporalEventSituation): string {
    if (situation.events.length === 1) return situation.events[0].title;
    const categories = Array.from(
      new Set(situation.events.map((event) => event.category?.trim()).filter(Boolean)),
    );
    if (categories.length === 1) {
      const category = categories[0]!;
      const year = this.indiaDateParts(situation.startDate).year;
      return category.includes(String(year)) ? category : `${category} ${year}`;
    }
    return this.getLeadEvent(situation.events).title;
  }

  getStateLabel(state: EventTemporalState): string {
    if (state === 'live') return 'Live now';
    if (state === 'active') return 'In progress';
    if (state === 'completed') return 'Completed';
    if (state === 'cancelled') return 'Cancelled';
    if (state === 'postponed') return 'Postponed';
    return 'Upcoming';
  }

  formatDateRange(start: Date, end: Date): string {
    const startParts = this.indiaDateParts(start);
    const endParts = this.indiaDateParts(end);
    if (startParts.key === endParts.key) {
      return this.formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (startParts.year === endParts.year && startParts.month === endParts.month) {
      return `${startParts.day}–${this.formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${this.formatDate(start, { day: 'numeric', month: 'short' })} – ${this.formatDate(end, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  formatLocation(location?: string, country?: string): string {
    if (!location && !country) return '';
    if (!country || country === 'Multiple' || country === 'TBC') return location || country || '';
    if ((location || '').toLowerCase().includes(country.toLowerCase())) return location || '';
    return location ? `${location}, ${country}` : country;
  }

  isSeasonWrapperEvent(event: CalendarEvent, start?: Date | null, end?: Date | null): boolean {
    const resolvedStart = start || this.parseEventDate(event.startDate, false);
    const resolvedEnd = end || this.parseEventDate(event.endDate || event.startDate, true);
    if (!resolvedStart || !resolvedEnd) return false;
    const durationDays = Math.ceil((resolvedEnd.getTime() - resolvedStart.getTime()) / DAY_MS);
    if (durationDays < 45) return false;
    const location = (event.location || '').toLowerCase();
    const country = (event.country || '').toLowerCase();
    const isMultiVenue = location.includes('multiple') || location.includes('various') || country === 'multiple';
    return isMultiVenue && !event.externalUrl;
  }

  parseEventDate(value?: string, endOfDay = false): Date | null {
    if (!value) return null;
    const day = value.slice(0, 10);
    const parsed = new Date(`${day}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getCalendarTimeGroup(
    event: CalendarEvent,
    state: EventTemporalState,
    start: Date,
    now: Date,
  ): CalendarTimeGroup {
    if (state === 'completed') return 'completed';
    if (state === 'active' || state === 'live') return 'live';
    const nowParts = this.indiaDateParts(now);
    const startParts = this.indiaDateParts(start);
    if (startParts.key === nowParts.key) return 'today';
    const daysAway = Math.ceil((start.getTime() - this.startOfIndiaDay(now).getTime()) / DAY_MS);
    if (daysAway <= 7) return 'thisWeek';
    if (startParts.year === nowParts.year && startParts.month === nowParts.month) return 'thisMonth';
    void event;
    return 'later';
  }

  private getRelativeLabel(
    event: CalendarEvent,
    state: EventTemporalState,
    start: Date,
    now: Date,
  ): string {
    if (state === 'completed') return 'Completed';
    if (state === 'live') return 'LIVE';
    if (state === 'active') return 'In progress';
    if (state === 'cancelled') return 'Cancelled';
    if (state === 'postponed') return 'Postponed';
    const daysAway = Math.ceil((start.getTime() - this.startOfIndiaDay(now).getTime()) / DAY_MS);
    if (daysAway <= 0) return 'Today';
    if (daysAway === 1) return 'Tomorrow';
    if (daysAway <= 7) return `In ${daysAway} days`;
    if (daysAway <= 30) {
      const weeks = Math.floor(daysAway / 7);
      return weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`;
    }
    const months = Math.floor(daysAway / 30);
    void event;
    return months <= 1 ? 'Next month' : `In ${months} months`;
  }

  private getImportanceClass(importance?: string): string {
    if (importance === 'core') return 'importance-core';
    if (importance === 'high') return 'importance-high';
    if (importance === 'watch') return 'importance-watch';
    return 'importance-context';
  }

  private getImportanceLabel(importance?: string): string {
    if (importance === 'core') return 'Core';
    if (importance === 'high') return 'High';
    if (importance === 'watch') return 'Watch';
    return 'Build-up';
  }

  private getTypeLabel(type?: string, category?: string): string {
    const normalizedType = this.normalize(type);
    const labels: Record<string, string> = {
      'world championship': 'World',
      'world championships': 'World',
      continental: 'Continental',
      qualification: 'Qualification',
      qualifier: 'Qualification',
      qualifiers: 'Qualification',
      tour: 'Tour',
      major: 'Games',
      games: 'Games',
      super: 'Super Series',
      'super series': 'Super Series',
      international: 'International',
      domestic: 'Domestic',
    };
    if (labels[normalizedType]) return labels[normalizedType];
    const normalizedCategory = this.normalize(category);
    if (normalizedCategory.includes('world championship')) return 'World';
    if (normalizedCategory.includes('asian games') || normalizedCategory.includes('commonwealth games')) return 'Games';
    if (normalizedCategory.includes('qualifier')) return 'Qualification';
    return '';
  }

  private getCategoryLabel(event: CalendarEvent): string {
    const category = (event.category || '').trim();
    if (this.normalize(event.qualificationContext) !== 'la 2028 qualifier') return category;
    if (!category) return 'LA28 Qualifier';
    return this.normalize(category).includes('qualifier') ? category : `${category} · LA28 Qualifier`;
  }

  private formatPhase(value?: string): string | null {
    if (!value || value === 'session') return null;
    const labels: Record<string, string> = {
      group: 'Group stage',
      qualifying: 'Qualifying',
      quarterfinal: 'Quarterfinal',
      semifinal: 'Semifinal',
      final: 'Final',
    };
    return labels[value] || this.toTitleCase(value.replace(/_/g, ' '));
  }

  private formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TIME_ZONE, ...options }).format(date);
  }

  private startOfIndiaDay(date: Date): Date {
    const parts = this.indiaDateParts(date);
    return new Date(`${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T00:00:00.000+05:30`);
  }

  private indiaDateParts(date: Date): { year: number; month: number; day: number; key: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: INDIA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const year = read('year');
    const month = read('month');
    const day = read('day');
    return { year, month, day, key: `${year}-${month}-${day}` };
  }

  private normalize(value?: string | null): string {
    return (value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private toTitleCase(value: string): string {
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private groupSortOrder(group: CalendarTimeGroup): number {
    return ['live', 'today', 'thisWeek', 'thisMonth', 'later', 'completed'].indexOf(group);
  }
}
