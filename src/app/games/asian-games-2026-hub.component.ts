import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, catchError, interval, of } from 'rxjs';
import { OriginalsService, Video } from '../originals/originals.service';
import { selectHubVideo } from '../originals/broadcast-presentation';
import { HubBroadcastComponent } from './hub-broadcast.component';
import { CalendarEvent, GamesParticipationRow, GamesProgrammeEventRow, GamesScheduleRow, GamesSessionDetail, PayloadService, Sport } from '../services/payload.service';
import { buildIndiaTimeline, timeUntilStart } from './india-timeline';
import { ASIAN_GAMES_2026 } from './asian-games-2026.config';
import { asianSessionStage, asianSessionMedal, asianParticipation, uniqueSessionRows, asianSessionBadge, resolveTimelineDate, isCeremonyDetail, sessionDetailSubtitle, asianMedalEventKeys, asianMedalEventCount, isBronzeDetail, isMedalDetail } from './asian-games-session.presentation';
import { compareMatrixSportStarts, hasIndiaAppearance, indiaDateKey, scheduleTiming } from './games-hub.presentation';
import { IOD_COVERAGE_SPORTS, LA28_SPORT_GROUPS, continuousGamesDates, matchesGamesScope, isLa28QuotaSport, getLa28QuotaInfo, La28QuotaInfo, isLa28QuotaDetail, isLa28QuotaRow } from './asian-games-scope';
import { CountryFlagComponent } from '../shared/country-flag/country-flag.component';
import { hasPublishedIndiaParticipants, indianEntriesForSessionDetail } from './asian-games-entry.presentation';

export interface DrawerCompetitorSide {
  code: string;
  label: string;
  participants: string[];
  participantsAreRoster?: boolean;
  score?: string | number | null;
  isWinner?: boolean;
}

interface DrawerEventEntry {
  detail: GamesSessionDetail;
  row: GamesScheduleRow;
  order: number;
}

export interface TimelineGroup {
  id: string;
  startMs: number;
  endMs: number;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  rows: GamesScheduleRow[];
  isLive: boolean;
  hasMedal: boolean;
  hasQuota: boolean;
}

export interface TimelineDateGroup {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  medalEventCount: number;
  hasQuotaSport: boolean;
}

interface MatrixCell {
  medalEvents: number;
  india: number;
  results: number;
  outcome: 'win' | 'loss' | 'mixed' | null;
}

@Component({
  selector: 'app-asian-games-2026-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIcon, HubBroadcastComponent, CountryFlagComponent, A11yModule],
  templateUrl: './asian-games-2026-hub.component.html',
  styleUrl: './asian-games-2026-hub.component.scss',
})
export class AsianGames2026HubComponent implements OnInit {
  private readonly payload = inject(PayloadService);
  private readonly originals = inject(OriginalsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private participationsRequested = false;
  readonly games = ASIAN_GAMES_2026;
  readonly loading = signal(true);
  readonly failed = signal<string[]>([]);
  readonly events = signal<CalendarEvent[]>([]);
  readonly schedule = signal<GamesScheduleRow[]>([]);
  readonly participations = signal<GamesParticipationRow[]>([]);
  readonly programme = signal<GamesProgrammeEventRow[]>([]);
  readonly videos = signal<Video[]>([]);
  readonly now = signal(new Date());
  readonly selectedSport = signal('all');
  readonly athleteSearch = signal('');
  readonly timelineDay = signal('');
  readonly indiaTimeline = computed(() => buildIndiaTimeline(this.deduplicatedSchedule(), this.now(), this.timelineDay()));
  readonly timelineHeading = computed(() => this.timelineDay() ? this.formatDialogDate(this.timelineDay()) : this.indiaTimeline().nextDay ? 'Next for India' : 'India’s next 24 hours');
  readonly timelineSections = computed(() => [
    { title: 'Live now', key: 'live', rows: this.indiaTimeline().live },
    { title: 'Up next', key: 'upcoming', rows: this.indiaTimeline().upcoming },
    { title: 'Awaiting updates', key: 'pending', rows: this.indiaTimeline().pending },
    { title: 'Latest results', key: 'results', rows: this.indiaTimeline().results },
  ].filter(section => section.rows.length));
  readonly la28Only = signal(false);
  readonly iodCoverageOnly = signal(true);
  readonly selectedView = signal<'schedule' | 'matrix'>('schedule');
  readonly coverage = signal<'iod' | 'la28' | 'all'>('iod');
  readonly medalOnly = signal(false);
  private returnFocus: HTMLElement | null = null;
  readonly isSquadDialogOpen = signal(false);
  readonly selectedDay = signal('');
  readonly selectedDateKey = signal<string>('');
  readonly expandedTimelineProgrammes = signal<ReadonlySet<string>>(new Set<string>());
  readonly inlineEventLimit = 3;
  readonly selectedSessionRow = signal<GamesScheduleRow | null>(null);
  readonly expandedLineups = signal<ReadonlySet<string>>(new Set<string>());
  readonly matrixSelectedCell = signal<{
    sportSlug: string;
    sportName: string;
    sportIcon: string | null;
    dateKey: string;
    sessions: GamesScheduleRow[];
  } | null>(null);
  readonly featuredVideo = computed(() => selectHubVideo(this.videos(), this.now()));
  readonly openingLabel = computed(() => {
    const openingMs = Date.parse(this.games.openingCeremony);
    const nowMs = this.now().getTime();
    const diffMs = openingMs - nowMs;

    if (diffMs > 0) {
      const totalHours = Math.floor(diffMs / 3_600_000);
      const mins = Math.floor((diffMs % 3_600_000) / 60_000);
      if (totalHours > 0) {
        return `${totalHours}h ${mins}m to Opening Ceremony`;
      }
      return `${mins}m to Opening Ceremony`;
    }
    if (diffMs > -14_400_000) {
      return 'Opening Ceremony Live';
    }
    return this.now() > new Date(this.games.end) ? 'Games complete' : 'The Games are on';
  });

  /** Only identical database IDs are duplicates; parallel venues remain distinct. */
  readonly deduplicatedSchedule = computed(() => uniqueSessionRows(this.schedule()));
  readonly coverageOptions = computed(() => [
    { key: 'iod' as const, label: 'IOD In Depth', count: this.allSports().filter(s => IOD_COVERAGE_SPORTS.has(s.slug)).length, note: 'India’s medal sports + cricket, squash, archery & table tennis' },
    { key: 'la28' as const, label: 'LA28 Sports', count: this.allSports().filter(s => LA28_SPORT_GROUPS.has(s.slug)).length, note: 'India’s Asian Games sports on the Los Angeles programme' },
    { key: 'all' as const, label: 'All Sports', count: this.allSports().length, note: 'Explore all 36 sports in India’s Games programme' },
  ]);
  readonly coverageNote = computed(() => this.coverageOptions().find(o => o.key === this.coverage())?.note || '');
  readonly todayKey = computed(() => indiaDateKey(this.now().toISOString()));
  readonly effectiveDateKey = computed(() => resolveTimelineDate(
    this.scopedSchedule().map(row => indiaDateKey(row.startTime)),
    this.selectedDateKey(), this.todayKey(), this.games.end.slice(0, 10),
  ));
  readonly timelineScopeRows = computed(() => this.filteredSchedule().filter(row => !this.medalOnly() || this.isMedalRow(row)));
  readonly dayHeading = computed(() => this.effectiveDateKey() === 'all' ? 'All competition days' : this.formatDialogDate(this.effectiveDateKey()));
  readonly dayContext = computed(() => this.effectiveDateKey() === 'all' ? 'THE GAMES' : this.effectiveDateKey() === this.todayKey() ? 'TODAY' : this.effectiveDateKey() > this.todayKey() ? 'COMING UP' : 'PAST SESSIONS');
  readonly nextTimelineRow = computed(() => {
    const rows = this.filteredTimelineSessions();
    return rows.find(row => this.isSessionLive(row)) || rows.find(row =>
      !['cancelled', 'postponed', 'completed', 'eliminated'].includes(row.status || '') && !row.result?.summary &&
      ['exact', 'session-window'].includes(row.timingPrecision || '') && Date.parse(row.startTime) > this.now().getTime());
  });
  readonly selectedSessionEvents = computed(() => {
    const row = this.selectedSessionRow();
    if (!row) return [];
    return row.gamesProgrammeEvent ? [row.gamesProgrammeEvent] : [];
  });

  readonly allSports = computed(() => {
    const sports = new Map<string, Sport>();
    for (const item of [...this.events(), ...this.deduplicatedSchedule(), ...this.participations(), ...this.programme()]) {
      const sport = item.sport;
      if (sport?.slug) sports.set(sport.slug, sport);
    }
    return [...sports.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly sports = computed(() => this.allSports().filter(sport => matchesGamesScope(sport.slug, this.la28Only(), 'all', this.iodCoverageOnly())));
  readonly squadCount = computed(() => new Set(this.participations()
    .filter(row => row.athlete?.id && !['withdrawn', 'replaced'].includes(row.selectionStatus || '') && row.status !== 'withdrawn')
    .map(row => row.athlete!.id)).size);
  readonly athletes = computed(() => {
    const athletes = new Map<string, { id: string; name: string; sport: string; sportSlug: string; assignments: Set<string>; status: string }>();
    for (const row of this.participations()) {
      if (!row.athlete?.id || ['withdrawn', 'replaced'].includes(row.selectionStatus || '') || row.status === 'withdrawn') continue;
      if (this.selectedSport() !== 'all' && row.sport?.slug !== this.selectedSport()) continue;
      if (this.athleteSearch().trim() && !row.athlete.fullName.toLowerCase().includes(this.athleteSearch().trim().toLowerCase())) continue;
      const sport = row.sport;
      const key = `${row.athlete.id}:${sport?.id || ''}`;
      const person = athletes.get(key) || {
        id: key, name: row.athlete.fullName, sport: sport?.name || '', sportSlug: sport?.slug || '', assignments: new Set<string>(),
        status: row.status === 'reserve' ? 'Reserve' : row.selectionStatus === 'entry-confirmed' ? 'Entry confirmed' : row.selectionStatus === 'approved' ? 'Approved selection' : 'Provisional',
      };
      if (row.eventBucket || row.eventName) person.assignments.add(row.eventBucket || row.eventName!);
      athletes.set(key, person);
    }
    return [...athletes.values()].map((athlete) => ({ ...athlete, events: [...athlete.assignments].join(' · ') }));
  });
  readonly activeAthletesCount = computed(() => this.athletes().length);
  readonly programmeEvents = computed(() => this.programme().filter((row) => this.matchesSport(row.sport)));
  readonly filteredSchedule = computed(() => this.deduplicatedSchedule().filter((row) => {
    return Number.isFinite(Date.parse(row.startTime)) && this.matchesSport(this.rowSport(row));
  }).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)));
  readonly scopedSchedule = computed(() => this.deduplicatedSchedule().filter(row =>
    Number.isFinite(Date.parse(row.startTime)) && matchesGamesScope(this.rowSport(row)?.slug, this.la28Only(), 'all', this.iodCoverageOnly())));
  /** Keep the whole date rail, including rest days, for the current sport scope. */
  readonly matrixDates = computed(() => {
    const keys = this.scopedSchedule().map((row) => indiaDateKey(row.startTime));
    return continuousGamesDates(keys).map((key) => ({
      key,
      day: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(`${key}T12:00:00+05:30`)),
      date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(new Date(`${key}T12:00:00+05:30`)),
      month: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }).format(new Date(`${key}T12:00:00+05:30`)),
    }));
  });

  /** Sports × dates matrix. Earlier-starting sports lead; ties stay alphabetical. */
  readonly matrixSports = computed(() => {
    const dates = this.matrixDates();
    const sportMap = new Map<string, { slug: string; name: string; firstDay: string; icon: string | null; cells: Map<string, { medalEventKeys: Set<string>; india: number; results: number; wins: number; losses: number }> }>();
    for (const row of this.scopedSchedule()) {
      if (!Number.isFinite(Date.parse(row.startTime))) continue;
      const sport = this.rowSport(row);
      const slug = sport?.slug || 'other';
      const name = sport?.name || 'Other';
      const dateKey = indiaDateKey(row.startTime);
      if (!sportMap.has(slug)) sportMap.set(slug, { slug, name, firstDay: dateKey, icon: sport ? this.pictogram(sport) : null, cells: new Map() });
      const entry = sportMap.get(slug)!;
      if (dateKey < entry.firstDay) entry.firstDay = dateKey;
      const cell = entry.cells.get(dateKey) || { medalEventKeys: new Set<string>(), india: 0, results: 0, wins: 0, losses: 0 };
      for (const key of asianMedalEventKeys(row)) cell.medalEventKeys.add(key);
      if (hasIndiaAppearance(row)) cell.india++;
      const resultCount = this.rowResultCount(row);
      if (resultCount) {
        cell.results += resultCount;
        if (row.result?.outcome === 'win') cell.wins += resultCount;
        if (row.result?.outcome === 'loss') cell.losses += resultCount;
      }
      entry.cells.set(dateKey, cell);
    }
    return [...sportMap.values()]
      .sort(compareMatrixSportStarts)
      .map((sport) => ({
        ...sport,
        isQuotaSport: this.isQuotaSport(sport.slug),
        grid: dates.map((d) => {
          const cell = sport.cells.get(d.key);
          return cell ? {
            medalEvents: cell.medalEventKeys.size,
            india: cell.india,
            results: cell.results,
            outcome: cell.results && cell.wins === cell.results ? 'win' as const
              : cell.results && cell.losses === cell.results ? 'loss' as const
                : cell.results ? 'mixed' as const : null,
          } : null;
        }),
      }));
  });

  readonly roadToLaSports = computed(() => {
    const quotaSlugs = ['hockey', 'squash', 'tennis', 'surfing', 'archery'];
    const sportsBySlug = new Map(this.allSports().map(s => [s.slug.toLowerCase(), s]));

    return quotaSlugs
      .filter(slug => this.matchesSport(sportsBySlug.get(slug) || ({ slug, name: slug } as Sport)))
      .map(slug => {
        const sport = sportsBySlug.get(slug);
        const info = getLa28QuotaInfo(slug)!;
        const name = sport?.name || (slug.charAt(0).toUpperCase() + slug.slice(1));
        const icon = sport ? this.pictogram(sport) : null;
        return {
          slug,
          name,
          icon,
          info,
        };
      })
      .filter(item => !!item.info);
  });

  readonly timelineDateGroups = computed<TimelineDateGroup[]>(() => {
    const rows = this.timelineScopeRows();
    const groupsMap = new Map<string, TimelineDateGroup>();

    for (const row of rows) {
      const key = indiaDateKey(row.startTime);
      if (!groupsMap.has(key)) {
        const d = new Date(`${key}T12:00:00+05:30`);
        groupsMap.set(key, {
          dateKey: key,
          dayLabel: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(d),
          dateLabel: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(d),
          medalEventCount: 0,
          hasQuotaSport: false,
        });
      }
      const group = groupsMap.get(key)!;
      if (this.isQuotaSport(this.rowSport(row)?.slug)) group.hasQuotaSport = true;
    }

    for (const [dateKey, group] of groupsMap) {
      group.medalEventCount = asianMedalEventCount(rows.filter(row => indiaDateKey(row.startTime) === dateKey));
    }

    return [...groupsMap.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  });

  readonly upcomingMedalEventsCount = computed(() => asianMedalEventCount(this.filteredSchedule()));

  readonly filteredTimelineSessions = computed<GamesScheduleRow[]>(() => {
    const selectedKey = this.effectiveDateKey();
    const all = this.timelineScopeRows();
    if (selectedKey === 'all') {
      return all;
    }
    return all.filter(row => indiaDateKey(row.startTime) === selectedKey);
  });

  readonly timelineGroups = computed<TimelineGroup[]>(() => this.buildTimelineGroups(this.filteredTimelineSessions()));

  readonly days = computed(() => [...new Set(this.filteredSchedule().map((row) => indiaDateKey(row.startTime)))].map((key) => ({
    key,
    day: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(`${key}T12:00:00+05:30`)),
    date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00+05:30`)),
  })));

  readonly activeDay = computed(() => {
    const keys = this.days().map((day) => day.key);
    if (keys.includes(this.selectedDay())) return this.selectedDay();
    const today = indiaDateKey(this.now().toISOString());
    return keys.find((key) => key >= today) || keys.at(-1) || '';
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const view = params.get('view');
      const display = params.get('display');
      if (view === 'iod' || view === 'la28' || view === 'all') this.setCoverage(view);
      else if (view === 'squad') this.openSquadDialog();
      if (display === 'matrix') this.selectedView.set('matrix');
      else if (display === 'timeline') this.selectedView.set('schedule');
      else this.selectedView.set(this.defaultScheduleView());
    });
    this.load();
    interval(60_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(new Date()));
  }

  load(): void {
    this.loading.set(true);
    this.failed.set([]);
    this.read('schedule', this.payload.getEventHubSchedule(this.games.gamesKey))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe((schedule) => {
      this.schedule.set(schedule);
      this.loading.set(false);
      this.loadEditorial(schedule);
    });
  }

  private loadEditorial(schedule: GamesScheduleRow[]): void {
    const eventIds = [...new Set(schedule.map(row => row.calendarEvent?.id).filter((id): id is string => Boolean(id)))];
    if (eventIds.length) {
      this.read('videos', this.originals.getVideosForCalendarEvents(eventIds))
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(videos => this.videos.set(videos));
      return;
    }
    this.read('competitions', this.payload.getCalendarEvents({ hubKey: this.games.hubKey, limit: 100 }))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(events => {
        const linked = events.filter(event => new Date(event.endDate || event.startDate) >= new Date(this.games.competitionStart)
          && new Date(event.startDate) <= new Date(this.games.end));
        this.events.set(linked);
        this.read('videos', this.originals.getVideosForCalendarEvents(linked.map(event => event.id)))
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(videos => this.videos.set(videos));
      });
  }

  private ensureParticipations(): void {
    if (this.participationsRequested || this.participations().length) return;
    this.participationsRequested = true;
    this.read('squad', this.payload.getEventHubParticipations(this.games.gamesKey))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(rows => this.participations.set(rows));
  }

  selectSport(slug: string): void {
    this.selectedSport.set(slug);
    this.selectedDay.set('');
    this.selectedDateKey.set('');
  }

  setProgrammeScope(enabled: boolean): void {
    this.la28Only.set(enabled);
    this.resetUnavailableSport();
  }

  setCoverage(scope: 'iod' | 'la28' | 'all'): void {
    this.coverage.set(scope);
    this.la28Only.set(scope === 'la28');
    this.iodCoverageOnly.set(scope === 'iod');
    this.resetUnavailableSport();
  }

  setCoverageScope(enabled: boolean): void {
    this.iodCoverageOnly.set(enabled);
    this.resetUnavailableSport();
  }

  private resetUnavailableSport(): void {
    if (this.selectedSport() !== 'all' && !this.sports().some(sport => sport.slug === this.selectedSport())) this.selectedSport.set('all');
    this.selectedDay.set('');
  }

  setSelectedDateKey(key: string): void {
    this.selectedDateKey.set(key);
  }

  resetTimelineFilters(): void {
    this.medalOnly.set(false);
    this.selectedDateKey.set('');
    this.selectedSport.set('all');
  }

  readonly isCeremonyDetail = isCeremonyDetail;
  readonly sessionDetailSubtitle = sessionDetailSubtitle;
  timelineDetails(row: GamesScheduleRow): GamesSessionDetail[] {
    return (row.sessionDetails || []).filter(detail => !isCeremonyDetail(detail));
  }
  isTimelineProgrammeExpanded(row: GamesScheduleRow): boolean { return this.expandedTimelineProgrammes().has(row.id); }
  visibleTimelineDetails(row: GamesScheduleRow): GamesSessionDetail[] {
    const details = this.timelineDetails(row);
    return this.isTimelineProgrammeExpanded(row) ? details : details.slice(0, this.inlineEventLimit);
  }
  hiddenTimelineDetailCount(row: GamesScheduleRow): number {
    return Math.max(0, this.timelineDetails(row).length - this.inlineEventLimit);
  }
  toggleTimelineProgramme(row: GamesScheduleRow): void {
    this.expandedTimelineProgrammes.update(current => {
      const next = new Set(current);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }
  drawerSessionTitle(row: GamesScheduleRow): string {
    const title = row.eventName || row.name || 'Session';
    const prefix = (this.rowSport(row)?.name || '') + ' · ';
    const short = title.startsWith(prefix) ? title.slice(prefix.length) : title;
    const parts = short.split(' / ');
    return parts.length > 1 ? parts.filter(part => !/ceremony/i.test(part)).join(' / ') || short : short;
  }
  competitionDetails(row: GamesScheduleRow): GamesSessionDetail[] { return (row.sessionDetails || []).filter(detail => !isCeremonyDetail(detail)); }
  drawerCompetitionEntries(rows: GamesScheduleRow[]): DrawerEventEntry[] {
    return rows
      .flatMap((row, rowIndex) => this.competitionDetails(row).map((detail, detailIndex) => ({
        detail,
        row,
        order: this.drawerEventOrder(detail, row, rowIndex, detailIndex),
      })))
      .sort((a, b) => a.order - b.order);
  }
  trackDrawerEvent(_index: number, entry: DrawerEventEntry): string {
    return entry.detail.sourceUrl || `${entry.row.id}|${entry.detail.timeIST || ''}|${entry.detail.event}|${entry.detail.phase || ''}|${entry.detail.unit || ''}`;
  }
  lineupKey(detail: GamesSessionDetail, row: GamesScheduleRow, side: DrawerCompetitorSide, sideIndex: number = 0): string {
    const event = detail.sourceUrl || `${detail.timeIST || ''}|${detail.event}|${detail.phase || ''}|${detail.unit || ''}`;
    return `${row.id}|${event}|${sideIndex}:${side.code || ''}:${side.label || ''}`;
  }
  isLineupExpanded(detail: GamesSessionDetail, row: GamesScheduleRow, side: DrawerCompetitorSide, sideIndex: number = 0): boolean {
    return this.expandedLineups().has(this.lineupKey(detail, row, side, sideIndex));
  }
  toggleLineup(detail: GamesSessionDetail, row: GamesScheduleRow, side: DrawerCompetitorSide, sideIndex: number = 0): void {
    const key = this.lineupKey(detail, row, side, sideIndex);
    this.expandedLineups.update(current => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  participationLabel(row: GamesScheduleRow): string {
    const status = asianParticipation(row);
    return status === 'confirmed' ? 'Confirmed' : status === 'conditional' ? 'If qualified' : '';
  }
  awaitingUpdate(row: GamesScheduleRow): boolean {
    return !['live', 'completed', 'cancelled', 'postponed', 'eliminated'].includes(row.status || '') && !row.result?.summary &&
      ['exact', 'session-window'].includes(row.timingPrecision || '') && Date.parse(row.endTime || row.startTime) < this.now().getTime();
  }
  qualificationSource(slug?: string): string {
    const info = getLa28QuotaInfo(slug);
    return info ? info.sourceUrl : 'https://olympics.com';
  }

  openMatrixDay(sport: string, day: string): void {
    this.openMatrixDayDialog(sport, day);
  }

  openMatrixDayDialog(sportSlug: string, dateKey: string): void {
    this.ensureParticipations();
    const sessions = this.getSessionsForSportAndDate(sportSlug, dateKey);
    const sport = this.sports().find(s => s.slug === sportSlug) || this.allSports().find(s => s.slug === sportSlug);
    if (!sessions.length && !sport) return;

    this.returnFocus = this.document.activeElement as HTMLElement;
    this.matrixSelectedCell.set({
      sportSlug,
      sportName: sport?.name || sportSlug,
      sportIcon: sport ? this.pictogram(sport) : null,
      dateKey,
      sessions,
    });
  }

  closeMatrixDayDialog(): void {
    this.matrixSelectedCell.set(null);
    this.expandedLineups.set(new Set<string>());
    this.returnFocus?.focus();
  }

  getSessionsForSportAndDate(sportSlug: string, dateKey: string): GamesScheduleRow[] {
    return this.deduplicatedSchedule().filter(row => {
      if (!Number.isFinite(Date.parse(row.startTime))) return false;
      const rowSlug = this.rowSport(row)?.slug || row.sport?.slug;
      if (rowSlug !== sportSlug) return false;
      return indiaDateKey(row.startTime) === dateKey;
    }).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  }

  formatDialogDate(dateKey: string): string {
    if (!dateKey) return '';
    const d = new Date(`${dateKey}T12:00:00+05:30`);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  }

  openSessionDialog(row: GamesScheduleRow): void {
    this.ensureParticipations();
    if (!this.matrixSelectedCell() && !this.isSquadDialogOpen()) this.returnFocus = this.document.activeElement as HTMLElement;
    this.matrixSelectedCell.set(null);
    this.selectedSessionRow.set(row);
  }

  closeSessionDialog(): void {
    this.selectedSessionRow.set(null);
    this.expandedLineups.set(new Set<string>());
    this.returnFocus?.focus();
  }

  openSquadDialog(): void {
    this.ensureParticipations();
    this.returnFocus = this.document.activeElement as HTMLElement;
    this.isSquadDialogOpen.set(true);
  }

  closeSquadDialog(): void {
    this.isSquadDialogOpen.set(false);
    this.returnFocus?.focus();
  }

  openGuide(event: MouseEvent): void {
    event.preventDefault();
    this.document.getElementById('games-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  pictogram(sport: Sport): string | null {
    return this.payload.getSportPictogramUrl({ sport, includePlaceholderFallback: false });
  }

  @HostListener('document:keydown.escape')
  closeDialogs(): void {
    if (this.isSquadDialogOpen()) this.closeSquadDialog();
    else if (this.selectedSessionRow()) this.closeSessionDialog();
    else if (this.matrixSelectedCell()) this.closeMatrixDayDialog();
  }

  selectView(view: 'schedule' | 'matrix'): void {
    this.selectedView.set(view);
  }

  private defaultScheduleView(): 'schedule' | 'matrix' {
    const now = this.now().getTime();
    return now >= Date.parse(this.games.competitionStart) && now <= Date.parse(this.games.end)
      ? 'schedule'
      : 'matrix';
  }

  matrixCellLabel(cell: MatrixCell | null): string {
    if (!cell) return '';
    const parts: string[] = ['Scheduled programme'];
    if (cell.results) parts.push(`${cell.results} official result${cell.results !== 1 ? 's' : ''}`);
    if (cell.medalEvents) parts.push(`${cell.medalEvents} medal event${cell.medalEvents !== 1 ? 's' : ''}`);
    if (cell.india && !cell.results) parts.push(`${cell.india} confirmed India session${cell.india !== 1 ? 's' : ''}`);
    return parts.join(' · ');
  }

  matrixResultLabel(cell: MatrixCell): string {
    return cell.outcome === 'win' ? 'W' : cell.outcome === 'loss' ? 'L' : 'FT';
  }

  sessionTimingLabel(row: GamesScheduleRow): string {
    if (row.result?.summary) return Array.isArray(row.result?.matches) && row.result.matches.length > 1 ? 'Results' : 'Result';
    if (row.status === 'eliminated') return 'Campaign';
    if (row.status === 'completed') return 'Status';
    if (this.isSessionLive(row)) return 'Live now';
    return 'Starts';
  }

  sessionTimingValue(row: GamesScheduleRow): string {
    const matches = Array.isArray(row.result?.matches) ? row.result.matches.length : 0;
    if (row.result?.summary && row.result?.official === false) return matches > 1 ? `${matches} unofficial results` : 'Unofficial result';
    if (row.result?.summary) return matches > 1 ? `${matches} matches final` : 'Official result';
    if (row.status === 'eliminated') return 'Complete';
    if (row.status === 'completed') return 'Completed';
    return this.getScheduleTiming(row);
  }

  isResultTiming(row: GamesScheduleRow): boolean {
    return Boolean(row.result?.summary) || ['completed', 'eliminated'].includes(row.status || '');
  }

  private rowResultCount(row: GamesScheduleRow): number {
    if (!row.result?.summary) return 0;
    return Array.isArray(row.result.matches) && row.result.matches.length ? row.result.matches.length : 1;
  }

  countdown(row: GamesScheduleRow): string { return timeUntilStart(row.startTime, this.now()); }

  isMedalRow(row: GamesScheduleRow): boolean { return asianSessionMedal(row); }
  rowMedalEventCount(row: GamesScheduleRow): number { return asianMedalEventCount([row]); }
  getIndiaParticipationStatus(row: GamesScheduleRow) { return asianParticipation(row); }
  isConditionalRow(row: GamesScheduleRow): boolean { return asianParticipation(row) === 'conditional'; }
  isQuotaSport(slug?: string | null): boolean {
    return isLa28QuotaSport(slug);
  }

  quotaInfo(slug?: string | null): La28QuotaInfo | null {
    return getLa28QuotaInfo(slug);
  }

  isBronzeDetail(detail: GamesSessionDetail): boolean {
    return isBronzeDetail(detail);
  }

  isMedalDetail(detail: GamesSessionDetail): boolean {
    return isMedalDetail(detail);
  }

  isQuotaDetail(detail: GamesSessionDetail, sportSlug?: string | null): boolean {
    return isLa28QuotaDetail(detail, sportSlug);
  }

  isBronzeRow(row: GamesScheduleRow): boolean {
    const details = row.sessionDetails || [];
    if (details.length > 0) {
      return details.every(d => isBronzeDetail(d));
    }
    const text = `${row.name || ''} ${row.eventName || ''} ${row.phase || ''}`.toLowerCase();
    return /\b(bronze|3\/4)\b/i.test(text) || /\b(3rd|third)\s*(place|play[- ]?off|match)?\b/i.test(text) || /play[- ]?off/i.test(text);
  }

  isQuotaRow(row: GamesScheduleRow): boolean {
    return isLa28QuotaRow(row);
  }

  isQuotaSession(row: GamesScheduleRow): boolean {
    return this.isQuotaRow(row);
  }

  rowHasQuotaMatch(row: GamesScheduleRow): boolean {
    return this.isQuotaRow(row);
  }

  cellHasQuotaMatch(cell: { sportSlug: string; sessions?: GamesScheduleRow[] } | null): boolean {
    if (!cell || !this.isQuotaSport(cell.sportSlug)) return false;
    return !!cell.sessions?.some(s => this.isQuotaRow(s));
  }

  isQuotaCell(cell: { sportSlug: string; medalEvents?: number; sessions?: GamesScheduleRow[] } | null): boolean {
    return this.cellHasQuotaMatch(cell);
  }
  getStageLabel(row: GamesScheduleRow): string { return asianSessionStage(row); }
  getSessionBadge(row: GamesScheduleRow): { label: string; type: string } | null { return asianSessionBadge(row); }

  getSessionStartMs(row: GamesScheduleRow): number {
    return Date.parse(row.startTime) || 0;
  }

  getSessionEndMs(row: GamesScheduleRow): number {
    return Date.parse(row.endTime || '') || (this.getSessionStartMs(row) + 3 * 3600 * 1000);
  }

  isSessionLive(row: GamesScheduleRow): boolean {
    return row.status === 'live';
  }

  isSessionCompleted(row: GamesScheduleRow): boolean {
    return ['completed', 'eliminated'].includes(row.status || '') || Boolean(row.result?.summary);
  }

  isNextTimelineGroup(group: TimelineGroup): boolean {
    const next = this.nextTimelineRow();
    return !!next && group.rows.some(row => row.id === next.id);
  }

  getScheduleTiming(row: GamesScheduleRow): string {
    return scheduleTiming(row);
  }

  getTimelineTime(row: GamesScheduleRow): string {
    return this.getScheduleTiming(row).replace(/^(?:from|starts)\s+/i, '');
  }

  showTimelineSessionBadge(row: GamesScheduleRow): boolean {
    if (!this.timelineDetails(row).length) return true;
    return ['live', 'cancelled', 'postponed'].includes(row.status || '');
  }

  sessionSourceUrl(row: GamesScheduleRow): string {
    const prefix = 'asian-games-2026:bornan:';
    if (row.sourceId?.startsWith(prefix)) return 'https://results.asiangames2026.org/#/discipline/' + row.sourceId.slice(prefix.length);
    return 'https://results.asiangames2026.org/#/schedule/daily/' + indiaDateKey(row.startTime);
  }

  detailSides(detail: GamesSessionDetail, row: GamesScheduleRow): DrawerCompetitorSide[] {
    if (isCeremonyDetail(detail)) return [];
    if (detail.sides?.length) return detail.sides.map(side => {
      const code = (side.code || '').toUpperCase();
      const publishedParticipants = side.participants || [];
      const roster = code === 'IND' && !publishedParticipants.length ? this.detailIndiaEntries(detail, row) : [];
      return {
        code,
        label: side.label || side.code,
        participants: publishedParticipants.length ? publishedParticipants : roster,
        participantsAreRoster: !publishedParticipants.length && roster.length > 0,
        score: side.score,
        isWinner: side.isWinner,
      };
    });

    const codes = detail.organisations || [];
    const labels = detail.competitors || [];
    return codes.map((code, index) => ({
      code: code.toUpperCase(),
      label: labels[index] || code,
      participants: code.toUpperCase() === 'IND'
        ? (row.indianParticipants || []).map(athlete => athlete.fullName).filter(Boolean)
        : [],
      participantsAreRoster: code.toUpperCase() === 'IND',
    }));
  }

  detailIndiaEntries(detail: GamesSessionDetail, row: GamesScheduleRow): string[] {
    if (isCeremonyDetail(detail)) return [];
    return indianEntriesForSessionDetail(detail, row, this.participations());
  }

  showDerivedIndiaEntries(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
    return !isCeremonyDetail(detail) && !this.detailSides(detail, row).length && !hasPublishedIndiaParticipants(detail, row);
  }

  detailResultSummary(detail: GamesSessionDetail, row: GamesScheduleRow): string | null {
    const matches = Array.isArray(row.result?.matches) ? row.result.matches : [];
    const officialKey = String(detail.sourceUrl || '').match(/\/results\/([^/?#]+)/)?.[1];
    const exact = officialKey ? matches.find((match: any) => match?.officialKey === officialKey) : null;
    if (exact?.summary) return exact.summary;

    const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const detailText = normalize(`${detail.event} ${detail.phase || ''} ${detail.unit || ''}`);
    const semantic = matches.find((match: any) => {
      const event = normalize(match?.event);
      const phase = normalize(match?.phase);
      const unit = normalize(match?.unit);
      return (!event || detailText.includes(event)) && (!phase || detailText.includes(phase)) && (!unit || detailText.includes(unit));
    });
    if (semantic?.summary) return semantic.summary;
    return this.competitionDetails(row).length === 1 ? row.result?.summary || null : null;
  }

  detailResultOutcome(summary: string): 'win' | 'loss' | 'neutral' {
    if (/\bbeat\b/i.test(summary)) return 'win';
    if (/\blost to\b/i.test(summary)) return 'loss';
    return 'neutral';
  }

  derivedIndiaEntryNote(detail: GamesSessionDetail): string {
    const hasPublishedSides = Boolean(detail.sides?.length || detail.organisations?.length);
    return hasPublishedSides
      ? 'India roster · playing lineup pending publication'
      : 'Rostered for this event · exact start assignment pending publication';
  }

  isConditionalDetail(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
    return !isCeremonyDetail(detail) && Boolean(detail.conditional || this.isConditionalRow(row));
  }

  rowHasIndiaEntries(row: GamesScheduleRow): boolean {
    return this.competitionDetails(row).some(detail => this.detailIndiaEntries(detail, row).length > 0);
  }

  drawerDetailCount(row: GamesScheduleRow): number {
    return this.competitionDetails(row).length;
  }

  private drawerEventOrder(detail: GamesSessionDetail, row: GamesScheduleRow, rowIndex: number, detailIndex: number): number {
    const time = /^(\d{1,2}):(\d{2})/.exec(detail.timeIST || '');
    if (time) return (Number(time[1]) * 60 + Number(time[2])) * 100 + detailIndex;
    const start = Date.parse(row.startTime);
    return Number.isFinite(start) ? start + detailIndex : Number.MAX_SAFE_INTEGER - 10_000 + rowIndex * 100 + detailIndex;
  }

  sessionDate(row: GamesScheduleRow): string { return this.formatDialogDate(indiaDateKey(row.startTime)); }

  rowSportPictogram(row: GamesScheduleRow): string | null {
    const sport = this.rowSport(row);
    return sport ? this.pictogram(sport) : null;
  }

  cellEventCount(cell: { sessions?: GamesScheduleRow[] } | null): number {
    if (!cell?.sessions?.length) return 0;
    const eventKeys = new Set<string>();
    let fallbackCount = 0;
    for (const row of cell.sessions) {
      const details = this.competitionDetails(row);
      if (details.length > 0) {
        for (const d of details) {
          if (d.event?.trim()) {
            eventKeys.add(d.event.trim().toLocaleLowerCase('en'));
          } else {
            fallbackCount++;
          }
        }
      } else {
        const fallback = row.eventName || row.name || row.id;
        eventKeys.add(fallback.trim().toLocaleLowerCase('en'));
      }
    }
    const medals = this.cellMedalCount(cell);
    return Math.max(medals, eventKeys.size + fallbackCount || 1);
  }

  cellMedalCount(cell: { sessions?: GamesScheduleRow[] } | null): number {
    if (!cell?.sessions?.length) return 0;
    return asianMedalEventCount(cell.sessions);
  }

  rowEventCount(row: GamesScheduleRow): number {
    const details = this.competitionDetails(row);
    if (!details.length) return 1;
    const uniqueEvents = new Set(details.map(d => d.event?.trim().toLocaleLowerCase('en')).filter(Boolean));
    const medals = this.rowMedalCount(row);
    return Math.max(medals, uniqueEvents.size || details.length || 1);
  }

  rowMedalCount(row: GamesScheduleRow): number {
    return asianMedalEventCount([row]);
  }

  rowVenue(row: GamesScheduleRow): string | null {
    return row.venue || null;
  }

  cellVenue(cell: { sessions?: GamesScheduleRow[] } | null): string | null {
    if (!cell?.sessions?.length) return null;
    const venues = [...new Set(cell.sessions.map(s => s.venue).filter(Boolean))];
    return venues.length ? venues.join(' · ') : null;
  }

  cellSourceUrl(cell: { sessions?: GamesScheduleRow[] } | null): string {
    const row = cell?.sessions?.find(s => s.sourceId) || cell?.sessions?.[0];
    return row ? this.sessionSourceUrl(row) : 'https://results.asiangames2026.org';
  }

  singleFixtureDetail(row: GamesScheduleRow): GamesSessionDetail | null {
    const details = this.competitionDetails(row);
    return details.length === 1 ? details[0] : null;
  }

  isSingleFixture(row: GamesScheduleRow): boolean {
    const details = this.competitionDetails(row);
    if (details.length === 1) {
      const sides = this.detailSides(details[0], row);
      if (sides.length >= 2) return true;
      if (details[0].unit || details[0].phase) return true;
      if (/\bv\b|\bvs\b/i.test(row.name || row.eventName || '')) return true;
    }
    return false;
  }

  isSingleFixtureCell(cell: { sessions?: GamesScheduleRow[] } | null): boolean {
    return !!cell?.sessions && cell.sessions.length === 1 && this.isSingleFixture(cell.sessions[0]);
  }

  fixtureStage(row: GamesScheduleRow): string | null {
    const detail = this.singleFixtureDetail(row);
    const phase = detail?.phase || row.phase;
    const unit = detail?.unit;
    if (unit && phase && !unit.toLowerCase().includes(phase.toLowerCase())) {
      return `${this.formatStageLabel(phase)} · ${unit}`;
    }
    if (unit) return unit;
    if (phase) return this.formatStageLabel(phase);
    return null;
  }

  fixtureDraw(row: GamesScheduleRow): string | null {
    const detail = this.singleFixtureDetail(row);
    const event = detail?.event || row.eventName || '';
    if (/\bwomen\b/i.test(event)) return "Women's Draw";
    if (/\bmen\b/i.test(event)) return "Men's Draw";
    if (/\bmixed\b/i.test(event)) return "Mixed Draw";
    return event || null;
  }

  private formatStageLabel(stage: string): string {
    const map: Record<string, string> = {
      'quarterfinal': 'Quarterfinal',
      'quarterfinals': 'Quarterfinals',
      'semifinal': 'Semifinal',
      'semifinals': 'Semifinals',
      'final': 'Final',
      'finals': 'Finals',
      'gold-medal': 'Gold Medal Match',
      'bronze-medal': 'Bronze Medal Match',
      'group': 'Group Stage',
      'heats': 'Heats',
      'preliminary': 'Preliminary',
    };
    return map[stage.toLowerCase()] || stage;
  }

  getLocalTiming(row: GamesScheduleRow): string {
    return row.localTimeLabel || '';
  }

  rowSport(row: GamesScheduleRow): Sport | null {
    const sport = row.sport || this.events().find((event) => event.id === row.calendarEvent?.id)?.sport;
    return sport || null;
  }

  matrixSportDisplayName(name: string): string {
    if (!name) return '';
    if (name === 'Canoe Sprint and Canoe Slalom') return 'Canoe';
    if (name === 'Wushu (Taolu and Sanda)') return 'Wushu';
    if (name === 'Indoor Volleyball') return 'Volleyball';
    if (name === 'Mixed Martial Arts') return 'MMA';
    return name;
  }

  private buildTimelineGroups(rows: GamesScheduleRow[]): TimelineGroup[] {
    const sorted = [...rows].sort((a, b) => this.compareTimelineRows(a, b));
    const groups: TimelineGroup[] = [];
    const maxGroupRows = 6;

    for (const row of sorted) {
      const startMs = this.getSessionStartMs(row);
      const endMs = this.getSessionEndMs(row);
      const activeEndMs = endMs > startMs ? endMs : startMs;
      const currentGroup = groups[groups.length - 1];
      const sameClockStart = Boolean(currentGroup && startMs === currentGroup.startMs);
      const canJoinCurrentGroup = Boolean(
        currentGroup &&
        currentGroup.rows.length < maxGroupRows &&
        sameClockStart
      );

      if (canJoinCurrentGroup && currentGroup) {
        currentGroup.rows.push(row);
        currentGroup.endMs = Math.max(currentGroup.endMs, activeEndMs);
        currentGroup.id = currentGroup.rows.map(item => item.id).join('|');
        currentGroup.timeLabel = this.getScheduleTiming(row);
        currentGroup.isLive = currentGroup.rows.some(item => this.isSessionLive(item));
        currentGroup.hasMedal = currentGroup.rows.some(item => this.isMedalRow(item));
        currentGroup.hasQuota = currentGroup.rows.some(item => this.isQuotaSport(this.rowSport(item)?.slug));
        continue;
      }

      const key = indiaDateKey(row.startTime);
      const d = new Date(`${key}T12:00:00+05:30`);
      const dayLabel = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(d);
      const dateLabel = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(d);

      groups.push({
        id: row.id,
        startMs,
        endMs: activeEndMs,
        dayLabel,
        dateLabel,
        timeLabel: this.getScheduleTiming(row),
        rows: [row],
        isLive: this.isSessionLive(row),
        hasMedal: this.isMedalRow(row),
        hasQuota: this.isQuotaSport(this.rowSport(row)?.slug),
      });
    }

    return groups;
  }

  private compareTimelineRows(a: GamesScheduleRow, b: GamesScheduleRow): number {
    const startDelta = this.getSessionStartMs(a) - this.getSessionStartMs(b);
    if (startDelta !== 0) return startDelta;
    const liveDelta = Number(this.isSessionLive(b)) - Number(this.isSessionLive(a));
    if (liveDelta !== 0) return liveDelta;
    const medalDelta = Number(this.isMedalRow(b)) - Number(this.isMedalRow(a));
    if (medalDelta !== 0) return medalDelta;
    return (a.name || '').localeCompare(b.name || '');
  }

  private matchesSport(sport?: Sport | null): boolean {
    return matchesGamesScope(sport?.slug, this.la28Only(), this.selectedSport(), this.iodCoverageOnly());
  }

  private read<T>(key: string, request: Observable<T[]>): Observable<T[]> {
    return request.pipe(catchError(() => {
      this.failed.update((keys) => [...keys, key]);
      return of([] as T[]);
    }));
  }
}
