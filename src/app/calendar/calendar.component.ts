import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import {
  CalendarEvent,
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
  sortValue: number;
  locationLabel: string;
  categoryLabel: string;
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
  imports: [CommonModule, RouterModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  private payload = inject(PayloadService);

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

  hasNoUpcoming = computed(() => this.upcomingCount() === 0);

  ngOnInit(): void {
    forkJoin({
      events: this.payload.getCalendarEvents({ limit: 500 }),
      sports: this.payload.getSports(),
    }).subscribe({
      next: ({ events, sports }) => {
        const sportLookup = new Map(sports.map((s) => [s.id, s]));
        this.allCards.set(this.buildCards(events, sportLookup));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setSportFilter(slug: string): void {
    this.activeSportFilter.set(slug);
  }

  toggleCompleted(): void {
    this.showCompleted.update((v) => !v);
  }

  trackByCard(_: number, card: CalendarCard): string {
    return card.event.id;
  }

  getEventRouterLink(card: CalendarCard): string[] | null {
    return card.event.slug ? ['/calendar', card.event.slug] : null;
  }

  // ── Build pipeline ──────────────────────────────────────────

  private buildCards(events: CalendarEvent[], sportLookup: Map<string, Sport>): CalendarCard[] {
    return events
      .map((event) => this.toCard(event, sportLookup))
      .sort((a, b) => {
        const groupOrder = this.groupSortOrder(a.timeGroup) - this.groupSortOrder(b.timeGroup);
        if (groupOrder !== 0) return groupOrder;
        return a.sortValue - b.sortValue;
      });
  }

  private toCard(event: CalendarEvent, sportLookup: Map<string, Sport>): CalendarCard {
    const sport = event.sport || null;
    const parentSport = sport?.parentSport || null;
    const resolvedSport = parentSport || sport;

    const sportName = resolvedSport?.name || 'Sport';
    const sportSlug = resolvedSport?.slug || sport?.slug || 'unknown';

    const pictogramUrl = this.payload.getSportPictogramUrl({
      sport,
      parentSport,
      includePlaceholderFallback: false,
    });

    const timeGroup = this.getTimeGroup(event);
    const startDate = this.toDate(event.startDate);

    return {
      event,
      timeGroup,
      relativeLabel: this.getRelativeLabel(event),
      dateLabel: this.formatDateRange(event.startDate, event.endDate),
      sportName,
      sportSlug,
      pictogramUrl,
      importanceClass: this.getImportanceClass(event.importance),
      sortValue: startDate?.getTime() || Number.MAX_SAFE_INTEGER,
      locationLabel: this.getLocationLabel(event.location, event.country),
      categoryLabel: event.category || this.getTypeLabel(event.type) || '',
    };
  }

  private getTimeGroup(event: CalendarEvent): TimeGroup {
    const now = new Date();
    const today = this.startOfDay(now);
    const start = this.toDate(event.startDate);
    const end = this.toDate(event.endDate || event.startDate);

    if (!start || !end) return 'later';

    // Completed
    if (end < today || event.status === 'completed') return 'completed';

    // Live — currently happening
    if (start <= now && end >= today && event.status === 'live') return 'live';
    if (start <= now && end >= today) return 'live';

    // Today
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);
    if (start >= today && start < endOfToday) return 'today';

    // This week (within 7 days)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    if (start < endOfWeek) return 'thisWeek';

    // This month (within 30 days)
    const endOfMonth = new Date(today);
    endOfMonth.setDate(endOfMonth.getDate() + 30);
    if (start < endOfMonth) return 'thisMonth';

    return 'later';
  }

  private getRelativeLabel(event: CalendarEvent): string {
    const now = new Date();
    const today = this.startOfDay(now);
    const start = this.toDate(event.startDate);
    const end = this.toDate(event.endDate || event.startDate);

    if (!start || !end) return 'TBC';

    if (event.status === 'completed' || end < today) return 'Completed';
    if (event.status === 'live' || (start <= now && end >= today)) return 'LIVE';

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

  private getTypeLabel(type?: string): string {
    switch (type) {
      case 'world-championship':
        return 'World Championship';
      case 'continental':
        return 'Continental';
      case 'qualification':
        return 'Olympic Qualification';
      case 'tour':
        return 'Tour';
      case 'major':
        return 'Grand Slam';
      case 'super':
        return 'Super Series';
      case 'international':
        return 'International';
      case 'domestic':
        return 'Domestic';
      default:
        return '';
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
