import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, forkJoin, of } from 'rxjs';
import { CalendarEvent, PayloadService, Sport } from '../services/payload.service';

type CalendarTab = 'upcoming' | 'completed';

interface CalendarDraftEvent {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  competitionLevel?: string;
  location?: string;
  country?: string;
  notes?: string;
}

interface CalendarDraftSport {
  sportSlug: string;
  sportName: string;
  events?: CalendarDraftEvent[];
}

interface CalendarDraft {
  sports: CalendarDraftSport[];
}

interface CalendarCardSeed {
  id: string;
  sportSlug: string;
  sportName: string;
  title: string;
  dateLabel: string;
  metaLabel?: string;
  note?: string;
  sortValue: number;
}

interface SportFilterChip {
  slug: string;
  name: string;
  pictogramUrl: string | null;
}

const COMPLETED_EVENT_SEEDS: CalendarCardSeed[] = [
  {
    id: 'asian-shooting-championship',
    sportSlug: 'shooting',
    sportName: 'Shooting',
    title: 'Asian Shooting Championship',
    dateLabel: '4th-12th Feb',
    sortValue: 1,
  },
  {
    id: 'national-weightlifting-championship',
    sportSlug: 'weightlifting',
    sportName: 'Weightlifting',
    title: 'National Weightlifting Championship',
    dateLabel: '4th-14th Feb',
    sortValue: 2,
  },
  {
    id: 'fih-womens-hockey-wc-qualifiers',
    sportSlug: 'hockey',
    sportName: 'Hockey',
    title: "FIH Women's Hockey WC Qualifiers",
    dateLabel: '8th-14th March',
    sortValue: 3,
  },
  {
    id: 'national-open-jumps',
    sportSlug: 'athletics',
    sportName: 'Athletics',
    title: 'National Open Jumps',
    dateLabel: '14th-15th March',
    sortValue: 4,
  },
];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  private http = inject(HttpClient);
  private payload = inject(PayloadService);

  loading = signal(true);
  selectedTab = signal<CalendarTab>('upcoming');
  selectedSport = signal<string>('all');

  sportPictograms = signal<Record<string, string | null>>({});
  upcomingCards = signal<CalendarCardSeed[]>([]);

  completedCards = computed(() => [...COMPLETED_EVENT_SEEDS]);

  activeCards = computed(() =>
    this.selectedTab() === 'upcoming' ? this.upcomingCards() : this.completedCards(),
  );

  displayedCards = computed(() => {
    const selectedSport = this.selectedSport();
    const cards = this.activeCards();

    if (selectedSport === 'all') {
      return cards;
    }

    return cards.filter((card) => card.sportSlug === selectedSport);
  });

  sportFilters = computed<SportFilterChip[]>(() => {
    const counts = new Map<string, { name: string; count: number }>();

    this.activeCards().forEach((card) => {
      const current = counts.get(card.sportSlug);
      counts.set(card.sportSlug, {
        name: card.sportName,
        count: (current?.count || 0) + 1,
      });
    });

    return [
      { slug: 'all', name: 'All Sports', pictogramUrl: null },
      ...Array.from(counts.entries())
        .sort((a, b) => {
          const countDiff = b[1].count - a[1].count;
          if (countDiff !== 0) {
            return countDiff;
          }

          return a[1].name.localeCompare(b[1].name);
        })
        .map(([slug, value]) => ({
          slug,
          name: value.name,
          pictogramUrl: this.sportPictograms()[slug] || null,
        })),
    ];
  });

  panelTitle = computed(() => (this.selectedTab() === 'upcoming' ? 'Upcoming' : 'Completed'));

  panelCopy = computed(() =>
    this.selectedTab() === 'upcoming'
      ? 'Only the major events IOD Sports is likely to follow closely.'
      : 'Events already covered by IOD Sports this year.',
  );

  emptyTitle = computed(() =>
    this.selectedTab() === 'upcoming'
      ? 'No events in this filter yet'
      : 'No completed events in this filter yet',
  );

  emptyCopy = computed(() =>
    this.selectedTab() === 'upcoming'
      ? 'Try another sport pictogram, or add the next sport feed when it is ready.'
      : 'Completed events will appear here as coverage expands.',
  );

  ngOnInit(): void {
    this.loadCalendar();
  }

  setTab(tab: CalendarTab) {
    this.selectedTab.set(tab);
    this.selectedSport.set('all');
  }

  setSportFilter(slug: string) {
    this.selectedSport.set(slug);
  }

  trackByCard(_: number, card: CalendarCardSeed): string {
    return card.id;
  }

  trackByFilter(_: number, filter: SportFilterChip): string {
    return filter.slug;
  }

  getSportChipText(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }

  private loadCalendar() {
    this.loading.set(true);

    forkJoin({
      sports: this.payload.getSports().pipe(catchError(() => of([] as Sport[]))),
      dbEvents: this.payload.getCalendarEvents({ limit: 400 }).pipe(catchError(() => of([] as CalendarEvent[]))),
      draft: this.http
        .get<CalendarDraft>('assets/data/indi-calendar-2026.json')
        .pipe(catchError(() => of({ sports: [] } as CalendarDraft))),
    }).subscribe({
      next: ({ sports, dbEvents, draft }) => {
        this.sportPictograms.set(this.buildSportPictogramMap(sports));
        this.upcomingCards.set(this.buildUpcomingCards(draft, dbEvents));
        this.loading.set(false);
      },
      error: () => {
        this.upcomingCards.set([]);
        this.loading.set(false);
      },
    });
  }

  private buildSportPictogramMap(sports: Sport[]): Record<string, string | null> {
    const pictograms: Record<string, string | null> = {};

    sports.forEach((sport) => {
      const slug = sport.parentSport?.slug || sport.slug;
      const anchorSport = sport.parentSport || sport;

      if (!slug || pictograms[slug]) {
        return;
      }

      pictograms[slug] =
        this.payload.getSportPictogramUrl({
          sport: anchorSport,
          includePlaceholderFallback: false,
        }) || null;
    });

    return pictograms;
  }

  private buildUpcomingCards(draft: CalendarDraft, dbEvents: CalendarEvent[]): CalendarCardSeed[] {
    const today = this.startOfToday();

    const curatedDraftCards = (draft.sports || [])
      .flatMap((sport) =>
        sport.sportSlug === 'badminton'
          ? []
          : (sport.events || [])
              .filter((event) => this.isFocusDraftEvent(event))
              .filter((event) => this.isUpcomingDate(event.endDate || event.startDate, today))
              .map((event) => this.toDraftCard(sport, event)),
      );

    const badmintonCards = dbEvents
      .filter((event) => this.isFocusBadmintonEvent(event))
      .filter((event) => !['completed', 'cancelled', 'postponed'].includes((event.status || '').toLowerCase()))
      .filter((event) => this.isUpcomingDate(event.endDate || event.startDate, today))
      .map((event) => this.toBadmintonCard(event));

    return [...curatedDraftCards, ...badmintonCards].sort(
      (a, b) => a.sortValue - b.sortValue || a.title.localeCompare(b.title),
    );
  }

  private isFocusDraftEvent(event: CalendarDraftEvent): boolean {
    const name = (event.name || '').toLowerCase();
    const level = (event.competitionLevel || '').toLowerCase();

    if (level === 'world-championship' || level === 'continental' || level === 'multi-sport-games') {
      return true;
    }

    return /world cup|world championship|world championships|asian games|asian|commonwealth|national|qualifier/.test(
      name,
    );
  }

  private isFocusBadmintonEvent(event: CalendarEvent): boolean {
    const sportSlug = event.sport?.slug || event.sport?.parentSport?.slug || '';
    if (sportSlug !== 'badminton') {
      return false;
    }

    const searchable = `${event.category || ''} ${event.type || ''}`.toLowerCase();
    return searchable.includes('1000') || searchable.includes('750');
  }

  private toDraftCard(sport: CalendarDraftSport, event: CalendarDraftEvent): CalendarCardSeed {
    const metaBits = [
      this.getDraftEventLabel(event),
      this.getLocationLabel(event.location, event.country),
    ].filter(Boolean);

    return {
      id: `${sport.sportSlug}-${event.id}`,
      sportSlug: sport.sportSlug,
      sportName: sport.sportName,
      title: event.name,
      dateLabel: this.formatDateRange(event.startDate, event.endDate),
      metaLabel: metaBits.join(' · ') || undefined,
      note: undefined,
      sortValue: this.toSortValue(event.startDate),
    };
  }

  private toBadmintonCard(event: CalendarEvent): CalendarCardSeed {
    const metaBits = [
      this.getBadmintonCategoryLabel(event.category, event.type),
      this.getLocationLabel(event.location, event.country),
    ].filter(Boolean);

    return {
      id: `badminton-${event.id}`,
      sportSlug: 'badminton',
      sportName: 'Badminton',
      title: event.title,
      dateLabel: this.formatDateRange(event.startDate, event.endDate),
      metaLabel: metaBits.join(' · ') || undefined,
      note: undefined,
      sortValue: this.toSortValue(event.startDate),
    };
  }

  private getDraftEventLabel(event: CalendarDraftEvent): string {
    const name = (event.name || '').toLowerCase();
    const level = (event.competitionLevel || '').toLowerCase();

    if (name.includes('asian games')) return 'Asian Games';
    if (name.includes('commonwealth games')) return 'Commonwealth Games';
    if (name.includes('commonwealth')) return 'Commonwealth';
    if (name.includes('qualifier')) return 'Qualifier';
    if (name.includes('world cup')) return 'World Cup';
    if (level === 'world-championship' || name.includes('world championship')) return 'World Championship';
    if (name.includes('national')) return 'National Championship';
    if (level === 'continental' || name.includes('asian')) return 'Asian Championship';
    if (level === 'multi-sport-games') return 'Multi-Sport Games';
    return '';
  }

  private getBadmintonCategoryLabel(category?: string, type?: string): string {
    const raw = `${category || ''} ${type || ''}`.toLowerCase();
    if (raw.includes('1000')) return 'BWF 1000';
    if (raw.includes('750')) return 'BWF 750';
    return 'BWF Event';
  }

  private getLocationLabel(location?: string, country?: string): string {
    if (!location && !country) {
      return '';
    }

    if (!country || country === 'Multiple') {
      return location || country || '';
    }

    const safeLocation = location || '';
    if (safeLocation.toLowerCase().includes(country.toLowerCase())) {
      return safeLocation;
    }

    return safeLocation ? `${safeLocation}, ${country}` : country;
  }

  private formatDateRange(startValue?: string, endValue?: string): string {
    const startDate = this.toDate(startValue);
    const endDate = this.toDate(endValue || startValue);

    if (!startDate || !endDate) {
      return 'Date TBC';
    }

    if (startDate.getTime() === endDate.getTime()) {
      return this.formatDate(startDate, { day: 'numeric', month: 'short' });
    }

    const sameMonth =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth();

    if (sameMonth) {
      return `${this.formatDate(startDate, { day: 'numeric' })}-${this.formatDate(endDate, {
        day: 'numeric',
        month: 'short',
      })}`;
    }

    return `${this.formatDate(startDate, { day: 'numeric', month: 'short' })}-${this.formatDate(endDate, {
      day: 'numeric',
      month: 'short',
    })}`;
  }

  private formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-IN', options).format(date);
  }

  private isUpcomingDate(value: string | undefined, today: Date): boolean {
    const date = this.toDate(value);
    if (!date) {
      return false;
    }

    return date.getTime() >= today.getTime();
  }

  private toSortValue(value?: string): number {
    return this.toDate(value)?.getTime() || Number.MAX_SAFE_INTEGER;
  }

  private toDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const dateOnly = value.slice(0, 10);
    return new Date(`${dateOnly}T00:00:00`);
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
