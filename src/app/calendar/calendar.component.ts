import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CalendarEvent,
  CalendarEventNavigation,
  PayloadService,
  Sport,
} from '../services/payload.service';

type TimeGroup = 'live' | 'today' | 'thisWeek' | 'thisMonth' | 'later' | 'completed';

interface CalendarCard {
  event: CalendarEvent;
  timeGroup: TimeGroup;
  relativeLabel: string;
  dateLabel: string;
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

interface SportFilter {
  slug: string;
  name: string;
  pictogramUrl: string | null;
  count: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [NgIf, NgFor, MatSpinner, MatIcon],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  private payload = inject(PayloadService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  allCards = signal<CalendarCard[]>([]);
  activeSportFilter = signal<string>('all');
  showCompleted = signal(false);

  sportFilters = computed<SportFilter[]>(() => {
    const cards = this.allCards();
    const sportMap = new Map<string, SportFilter>();

    for (const card of cards) {
      if (card.timeGroup === 'completed') continue;
      const existing = sportMap.get(card.sportSlug);
      if (existing) {
        existing.count++;
      } else {
        sportMap.set(card.sportSlug, {
          slug: card.sportSlug,
          name: card.sportName,
          pictogramUrl: card.pictogramUrl,
          count: 1,
        });
      }
    }

    return Array.from(sportMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  private filteredCards = computed(() => {
    const filter = this.activeSportFilter();
    const cards = this.allCards();
    if (filter === 'all') return cards;
    return cards.filter((c) => c.sportSlug === filter);
  });

  private unfilteredUpcomingCards = computed(() =>
    this.allCards().filter((c) => c.timeGroup !== 'completed'),
  );

  liveCards = computed(() => this.filteredCards().filter((c) => c.timeGroup === 'live'));
  todayCards = computed(() => this.filteredCards().filter((c) => c.timeGroup === 'today'));
  thisWeekCards = computed(() => this.filteredCards().filter((c) => c.timeGroup === 'thisWeek'));
  thisMonthCards = computed(() => this.filteredCards().filter((c) => c.timeGroup === 'thisMonth'));
  laterCards = computed(() => this.filteredCards().filter((c) => c.timeGroup === 'later'));
  completedCards = computed(() =>
    this.filteredCards()
      .filter((c) => c.timeGroup === 'completed')
      .sort((a, b) => b.sortValue - a.sortValue)
      .slice(0, 20),
  );

  upcomingCount = computed(
    () =>
      this.liveCards().length +
      this.todayCards().length +
      this.thisWeekCards().length +
      this.thisMonthCards().length +
      this.laterCards().length,
  );

  totalUpcomingCount = computed(() => this.unfilteredUpcomingCards().length);

  hasNoUpcoming = computed(() => this.upcomingCount() === 0);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const requestedSport = (params.get('sport') || 'all').trim().toLowerCase();
      this.activeSportFilter.set(requestedSport || 'all');
    });

    forkJoin({
      events: this.payload.getCalendarEvents({ limit: 500 }),
      sports: this.payload.getSports(),
    }).subscribe({
      next: ({ events, sports }) => {
        const sportLookup = new Map(sports.map((s) => [s.id, s]));
        this.allCards.set(this.buildCards(events, sportLookup));
        this.ensureValidSportFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setSportFilter(slug: string): void {
    this.activeSportFilter.set(slug);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sport: slug === 'all' ? null : slug },
      queryParamsHandling: 'merge',
    });
  }

  toggleCompleted(): void {
    this.showCompleted.update((v) => !v);
  }

  trackByCard(_: number, card: CalendarCard): string {
    return card.event.id;
  }

  getCardLinkLabel(card: CalendarCard): string | null {
    if (card.navigation.kind === 'external') {
      return card.timeGroup === 'completed' ? 'Official Results' : 'Official Source';
    }
    return null;
  }

  // ── Build pipeline ──────────────────────────────────────────

  private buildCards(
    events: CalendarEvent[],
    sportLookup: Map<string, Sport>,
  ): CalendarCard[] {
    return events
      .map((event) => this.toCard(event, sportLookup))
      .filter((card): card is CalendarCard => !!card)
      .sort((a, b) => {
        const groupOrder = this.groupSortOrder(a.timeGroup) - this.groupSortOrder(b.timeGroup);
        if (groupOrder !== 0) return groupOrder;
        return a.sortValue - b.sortValue;
      });
  }

  private toCard(
    event: CalendarEvent,
    sportLookup: Map<string, Sport>,
  ): CalendarCard | null {
    void sportLookup;
    const sport = event.sport || null;
    const parentSport = sport?.parentSport || null;
    const resolvedSport = parentSport || sport;
    const startDate = this.toDate(event.startDate);
    const endDate = this.toDate(event.endDate || event.startDate);

    if (this.isSeasonWrapperEvent(event, startDate, endDate)) {
      return null;
    }

    const sportName = resolvedSport?.name || 'Sport';
    const sportSlug = resolvedSport?.slug || sport?.slug || 'unknown';

    const pictogramUrl = this.payload.getSportPictogramUrl({
      sport,
      parentSport,
      includePlaceholderFallback: false,
    });

    const timeGroup = this.getTimeGroup(event);

    return {
      event,
      timeGroup,
      relativeLabel: this.getRelativeLabel(event),
      dateLabel: this.formatDateRange(event.startDate, event.endDate),
      sportName,
      sportSlug,
      pictogramUrl,
      importanceClass: this.getImportanceClass(event.importance),
      importanceLabel: this.getImportanceLabel(event.importance),
      sortValue: startDate?.getTime() || Number.MAX_SAFE_INTEGER,
      locationLabel: this.getLocationLabel(event.location, event.country),
      categoryLabel: this.getCategoryLabel(event),
      typeLabel: this.getTypeLabel(event.type, event.category) || '',
      summaryLabel: this.getSummaryLabel(event),
      navigation: this.payload.getCalendarEventNavigation(event),
    };
  }

  private getTimeGroup(event: CalendarEvent): TimeGroup {
    const now = new Date();
    const today = this.startOfDay(now);
    const start = this.toDate(event.startDate);
    const end = this.toDate(event.endDate || event.startDate);

    if (!start || !end) return 'later';

    if (this.isCompletedEvent(event, end, today)) return 'completed';

    if (this.isLiveEvent(event, start, end, now, today)) return 'live';

    // Today
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);
    if (start >= today && start < endOfToday) return 'today';

    // This week (within 7 days)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    if (start < endOfWeek) return 'thisWeek';

    if (start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()) {
      return 'thisMonth';
    }

    return 'later';
  }

  private getRelativeLabel(event: CalendarEvent): string {
    const now = new Date();
    const today = this.startOfDay(now);
    const start = this.toDate(event.startDate);
    const end = this.toDate(event.endDate || event.startDate);

    if (!start || !end) return 'TBC';

    if (this.isCompletedEvent(event, end, today)) return 'Completed';
    if (this.isLiveEvent(event, start, end, now, today)) return 'LIVE';

    const daysAway = Math.ceil((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (daysAway === 0) return 'Today';
    if (daysAway === 1) return 'Tomorrow';
    if (daysAway <= 7) return `In ${daysAway} days`;
    if (daysAway <= 30) {
      const weeks = Math.floor(daysAway / 7);
      return weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`;
    }
    const months = Math.floor(daysAway / 30);
    return months <= 1 ? 'Next month' : `In ${months} months`;
  }

  private getImportanceClass(importance?: string): string {
    switch (importance) {
      case 'core':
        return 'importance-core';
      case 'high':
        return 'importance-high';
      case 'watch':
        return 'importance-watch';
      default:
        return 'importance-context';
    }
  }

  private getImportanceLabel(importance?: string): string {
    switch (importance) {
      case 'core':
        return 'Core';
      case 'high':
        return 'High';
      case 'watch':
        return 'Watch';
      default:
        return 'Build-up';
    }
  }

  private getSummaryLabel(event: CalendarEvent): string | null {
    return event.summary || null;
  }

  private isCompletedEvent(event: CalendarEvent, end: Date, today: Date): boolean {
    if (end < today) return true;
    if ((event.status || '').toLowerCase() !== 'completed') return false;
    return end < today;
  }

  private isLiveEvent(
    event: CalendarEvent,
    start: Date,
    end: Date,
    now: Date,
    today: Date,
  ): boolean {
    if (this.isSeasonWrapperEvent(event, start, end)) return false;

    const status = (event.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'postponed') {
      return false;
    }

    return start <= now && end >= today;
  }

  private isSeasonWrapperEvent(
    event: CalendarEvent,
    start?: Date | null,
    end?: Date | null,
  ): boolean {
    if (!start || !end) return false;

    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (durationDays < 45) return false;

    const location = (event.location || '').toLowerCase();
    const country = (event.country || '').toLowerCase();
    const isMultiVenue = location.includes('multiple') || location.includes('various') || country === 'multiple';

    return isMultiVenue && !event.externalUrl;
  }

  private getTypeLabel(type?: string, category?: string): string {
    const normalizedType = this.normalizeCalendarTypeValue(type);

    switch (normalizedType) {
      case 'world championship':
      case 'world championships':
        return 'World';
      case 'continental':
        return 'Continental';
      case 'qualification':
      case 'qualifier':
      case 'qualifiers':
        return 'Qualification';
      case 'tour':
        return 'Tour';
      case 'major':
      case 'games':
        return 'Games';
      case 'super':
      case 'super series':
        return 'Super Series';
      case 'international':
        return 'International';
      case 'domestic':
        return 'Domestic';
    }

    const normalizedCategory = this.normalizeCalendarTypeValue(category);
    if (normalizedCategory.includes('world championship')) return 'World';
    if (normalizedCategory.includes('asian games') || normalizedCategory.includes('commonwealth games')) {
      return 'Games';
    }
    if (normalizedCategory.includes('qualifier')) return 'Qualification';

    return '';
  }

  private getCategoryLabel(event: CalendarEvent): string {
    const category = (event.category || '').trim();
    const qualificationContext = this.normalizeCalendarTypeValue(event.qualificationContext);

    if (qualificationContext === 'la 2028 qualifier') {
      if (!category) return 'LA28 Qualifier';
      if (this.normalizeCalendarTypeValue(category).includes('qualifier')) return category;
      return `${category} · LA28 Qualifier`;
    }

    return category;
  }

  private normalizeCalendarTypeValue(value?: string | null): string {
    return (value || '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private ensureValidSportFilter(): void {
    const activeFilter = this.activeSportFilter();
    if (activeFilter === 'all') return;

    const validSlugs = new Set(this.sportFilters().map((sport) => sport.slug));
    if (!validSlugs.has(activeFilter)) {
      this.activeSportFilter.set('all');
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { sport: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private getLocationLabel(location?: string, country?: string): string {
    if (!location && !country) return '';
    if (!country || country === 'Multiple' || country === 'TBC') return location || country || '';
    if ((location || '').toLowerCase().includes(country.toLowerCase())) return location || '';
    return location ? `${location}, ${country}` : country;
  }

  private formatDateRange(startValue?: string, endValue?: string): string {
    const startDate = this.toDate(startValue);
    const endDate = this.toDate(endValue || startValue);
    if (!startDate || !endDate) return 'Date TBC';

    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

    if (startDate.getTime() === endDate.getTime()) {
      return new Intl.DateTimeFormat('en-IN', opts).format(startDate);
    }

    const sameMonth =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth();

    if (sameMonth) {
      return `${startDate.getDate()}–${new Intl.DateTimeFormat('en-IN', opts).format(endDate)}`;
    }

    return `${new Intl.DateTimeFormat('en-IN', opts).format(startDate)} – ${new Intl.DateTimeFormat('en-IN', opts).format(endDate)}`;
  }

  private groupSortOrder(group: TimeGroup): number {
    switch (group) {
      case 'live':
        return 0;
      case 'today':
        return 1;
      case 'thisWeek':
        return 2;
      case 'thisMonth':
        return 3;
      case 'later':
        return 4;
      case 'completed':
        return 5;
    }
  }

  private toDate(value?: string): Date | null {
    if (!value) return null;
    return new Date(`${value.slice(0, 10)}T00:00:00`);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
