import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, catchError, forkJoin, interval, of } from 'rxjs';
import { OriginalsService, Video } from '../originals/originals.service';
import { selectHubVideo } from '../originals/broadcast-presentation';
import { HubBroadcastComponent } from './hub-broadcast.component';
import { CalendarEvent, GamesParticipationRow, GamesProgrammeEventRow, GamesScheduleRow, PayloadService, Sport } from '../services/payload.service';
import { TemporalEventEngine } from '../shared/services/temporal-event.engine';
import { ASIAN_GAMES_2026 } from './asian-games-2026.config';
import { compareMatrixSportStarts, hasIndiaAppearance, indiaDateKey, scheduleTiming } from './games-hub.presentation';
import { continuousGamesDates, matchesGamesScope } from './asian-games-scope';

@Component({
  selector: 'app-asian-games-2026-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIcon, HubBroadcastComponent],
  templateUrl: './asian-games-2026-hub.component.html',
  styleUrl: './asian-games-2026-hub.component.scss',
})
export class AsianGames2026HubComponent implements OnInit {
  private readonly payload = inject(PayloadService);
  private readonly originals = inject(OriginalsService);
  private readonly temporal = inject(TemporalEventEngine);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
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
  readonly la28Only = signal(false);
  readonly iodCoverageOnly = signal(false);
  readonly selectedView = signal<'schedule' | 'squad' | 'events' | 'matrix'>('matrix');
  readonly selectedDay = signal('');
  readonly scheduleScope = signal<'programme' | 'india'>('programme');
  readonly featuredVideo = computed(() => selectHubVideo(this.videos(), this.now()));
  readonly openingLabel = computed(() => {
    const day = this.now().toLocaleDateString('en-CA', { timeZone: this.games.timeZone });
    const days = Math.round((Date.parse(`${this.games.start.slice(0, 10)}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
    return days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} to opening day`
      : this.now() > new Date(this.games.end) ? 'Games complete' : 'The Games are on';
  });
  readonly allSports = computed(() => {
    const sports = new Map<string, Sport>();
    for (const item of [...this.events(), ...this.schedule(), ...this.participations(), ...this.programme()]) {
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
    const athletes = new Map<string, { id: string; name: string; sport: string; assignments: Set<string>; status: string }>();
    for (const row of this.participations()) {
      if (!row.athlete?.id || ['withdrawn', 'replaced'].includes(row.selectionStatus || '') || row.status === 'withdrawn') continue;
      if (!this.matchesSport(row.sport)) continue;
      const sport = row.sport;
      const key = `${row.athlete.id}:${sport?.id || ''}`;
      const person = athletes.get(key) || {
        id: key, name: row.athlete.fullName, sport: sport?.name || '', assignments: new Set<string>(),
        status: row.status === 'reserve' ? 'Reserve' : row.selectionStatus === 'entry-confirmed' ? 'Entry confirmed' : row.selectionStatus === 'approved' ? 'Approved selection' : 'Provisional',
      };
      if (row.eventBucket || row.eventName) person.assignments.add(row.eventBucket || row.eventName!);
      athletes.set(key, person);
    }
    return [...athletes.values()].map((athlete) => ({ ...athlete, events: [...athlete.assignments].join(' · ') }));
  });
  readonly programmeEvents = computed(() => this.programme().filter((row) => this.matchesSport(row.sport)));
  readonly filteredSchedule = computed(() => this.schedule().filter((row) => {
    if (!Number.isFinite(Date.parse(row.startTime)) || !this.matchesSport(this.rowSport(row))) return false;
    return this.scheduleScope() !== 'india' || hasIndiaAppearance(row);
  }).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)));
  readonly scopedSchedule = computed(() => this.schedule().filter(row =>
    Number.isFinite(Date.parse(row.startTime)) && this.matchesSport(this.rowSport(row))));
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
    const sportMap = new Map<string, { slug: string; name: string; firstDay: string; icon: string | null; cells: Map<string, { sessions: number; medals: number; india: number }> }>();
    for (const row of this.scopedSchedule()) {
      if (!Number.isFinite(Date.parse(row.startTime))) continue;
      const sport = this.rowSport(row);
      const slug = sport?.slug || 'other';
      const name = sport?.name || 'Other';
      const dateKey = indiaDateKey(row.startTime);
      if (!sportMap.has(slug)) sportMap.set(slug, { slug, name, firstDay: dateKey, icon: sport ? this.pictogram(sport) : null, cells: new Map() });
      const entry = sportMap.get(slug)!;
      if (dateKey < entry.firstDay) entry.firstDay = dateKey;
      const cell = entry.cells.get(dateKey) || { sessions: 0, medals: 0, india: 0 };
      cell.sessions++;
      if (row.isMedalSession) cell.medals++;
      if (hasIndiaAppearance(row)) cell.india++;
      entry.cells.set(dateKey, cell);
    }
    return [...sportMap.values()]
      .sort(compareMatrixSportStarts)
      .map((sport) => ({
        ...sport,
        totalSessions: [...sport.cells.values()].reduce((sum, c) => sum + c.sessions, 0),
        totalMedals: [...sport.cells.values()].reduce((sum, c) => sum + c.medals, 0),
        totalIndia: [...sport.cells.values()].reduce((sum, c) => sum + c.india, 0),
        grid: dates.map((d) => sport.cells.get(d.key) || null),
      }));
  });
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
  readonly dayRows = computed(() => this.filteredSchedule().filter((row) => indiaDateKey(row.startTime) === this.activeDay()).map((row) => {
    const temporal = this.temporal.deriveFixtureState(row, this.now());
    const finished = ['completed', 'eliminated'].includes(row.status || '');
    const unavailable = ['cancelled', 'postponed'].includes(row.status || '');
    // A session clock is evidence of its window, not a live result feed.
    const state = unavailable ? 'unavailable' : finished ? 'completed' : row.status === 'live' ? 'live' : temporal === 'active' ? 'active' : 'upcoming';
    return {
      row, sport: this.rowSport(row)?.name || 'Asian Games', time: scheduleTiming(row), state,
      label: row.status === 'cancelled' ? 'Cancelled' : row.status === 'postponed' ? 'Postponed'
        : finished ? 'Result' : row.status === 'live' ? 'Live' : temporal === 'active' ? 'Scheduled window'
        : temporal === 'completed' ? 'Awaiting result' : row.isConditional ? 'If qualified'
        : row.timingPrecision === 'session-window' ? 'Session window' : '',
      result: typeof row.result?.summary === 'string' ? row.result.summary : null,
      india: hasIndiaAppearance(row),
    };
  }));
  ngOnInit(): void {
    if (this.now() >= new Date(this.games.competitionStart)) this.selectedView.set('schedule');
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const view = params.get('view');
      if (view === 'matrix' || view === 'schedule' || view === 'squad' || view === 'events') this.selectedView.set(view);
    });
    this.load();
    interval(60_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(new Date()));
  }
  load(): void {
    this.loading.set(true);
    this.failed.set([]);
    forkJoin({
      events: this.read('competitions', this.payload.getCalendarEvents({ hubKey: this.games.hubKey, limit: 100 })),
      schedule: this.read('schedule', this.payload.getEventHubSchedule(this.games.gamesKey)),
      participations: this.read('squad', this.payload.getEventHubParticipations(this.games.gamesKey)),
      programme: this.read('events', this.payload.getEventHubProgramme(this.games.gamesKey)),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ events, schedule, participations, programme }) => {
      const linked = events.filter((event) => new Date(event.endDate || event.startDate) >= new Date(this.games.competitionStart)
        && new Date(event.startDate) <= new Date(this.games.end));
      this.events.set(linked);
      this.schedule.set(schedule);
      this.participations.set(participations);
      this.programme.set(programme);
      this.loading.set(false);
      this.read('videos', this.originals.getVideosForCalendarEvents(linked.map((event) => event.id)))
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe((videos) => this.videos.set(videos));
    });
  }
  selectSport(slug: string): void { this.selectedSport.set(slug); this.selectedDay.set(''); }
  setProgrammeScope(enabled: boolean): void {
    this.la28Only.set(enabled);
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
  openMatrixDay(sport: string, day: string): void {
    this.selectedSport.set(sport);
    this.selectedDay.set(day);
    this.scheduleScope.set('programme');
    this.selectedView.set('schedule');
  }
  pictogram(sport: Sport): string | null {
    return this.payload.getSportPictogramUrl({ sport, includePlaceholderFallback: false });
  }
  selectView(view: 'schedule' | 'squad' | 'events' | 'matrix'): void { this.selectedView.set(view); }
  matrixCellLabel(cell: { sessions: number; medals: number; india: number } | null): string {
    if (!cell) return '';
    const parts: string[] = [`${cell.sessions} session${cell.sessions !== 1 ? 's' : ''}`];
    if (cell.medals) parts.push(`${cell.medals} medal${cell.medals !== 1 ? 's' : ''}`);
    if (cell.india) parts.push(`${cell.india} India`);
    return parts.join(' · ');
  }
  openGuide(event: MouseEvent): void {
    event.preventDefault();
    this.document.getElementById('games-guide')?.scrollIntoView({ block: 'start' });
  }
  private matchesSport(sport?: Sport | null): boolean {
    return matchesGamesScope(sport?.slug, this.la28Only(), this.selectedSport(), this.iodCoverageOnly());
  }
  private rowSport(row: GamesScheduleRow): Sport | null {
    const sport = row.sport || this.events().find((event) => event.id === row.calendarEvent?.id)?.sport;
    return sport || null;
  }
  private read<T>(key: string, request: Observable<T[]>): Observable<T[]> {
    return request.pipe(catchError(() => {
      this.failed.update((keys) => [...keys, key]);
      return of([] as T[]);
    }));
  }
}
