import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import {
  CalendarEvent,
  CalendarEventParticipant,
  PayloadService,
} from '../services/payload.service';

@Component({
  selector: 'app-calendar-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatProgressSpinnerModule],
  templateUrl: './calendar-detail.component.html',
  styleUrls: ['./calendar-detail.component.scss'],
})
export class CalendarDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private payload = inject(PayloadService);

  loading = signal(true);
  event = signal<CalendarEvent | null>(null);

  sportName = computed(
    () => this.event()?.sport?.parentSport?.name || this.event()?.sport?.name || 'Olympic sport',
  );

  sportSlug = computed(
    () => this.event()?.sport?.parentSport?.slug || this.event()?.sport?.slug || null,
  );

  heroImageUrl = computed(() => {
    const currentEvent = this.event();
    return (
      this.payload.getMediaUrl(currentEvent?.heroImage || null) ||
      this.payload.getMediaUrl(currentEvent?.edition?.heroImage || null) ||
      null
    );
  });

  heroBackground = computed(() => {
    const heroImageUrl = this.heroImageUrl();

    if (heroImageUrl) {
      return `linear-gradient(180deg, rgba(4, 7, 12, 0.1) 0%, rgba(4, 7, 12, 0.78) 58%, rgba(4, 7, 12, 0.96) 100%), url('${heroImageUrl}')`;
    }

    return `
      radial-gradient(720px 320px at 10% 10%, rgba(243, 200, 92, 0.18), transparent 58%),
      radial-gradient(640px 280px at 100% 0%, rgba(126, 176, 255, 0.16), transparent 60%),
      linear-gradient(180deg, rgba(10, 16, 26, 0.96) 0%, rgba(6, 8, 12, 1) 100%)
    `;
  });

  sportPictogramUrl = computed(() =>
    this.payload.getSportPictogramUrl({
      sport: this.event()?.sport || null,
      includePlaceholderFallback: false,
    }),
  );

  dateLabel = computed(() => this.formatDateRange(this.event()?.startDate, this.event()?.endDate));

  locationLabel = computed(() =>
    this.getLocationLabel(this.event()?.location, this.event()?.country),
  );

  scopeLabel = computed(() => this.getScopeLabel(this.event()?.eventScope));
  importanceLabel = computed(() => this.getImportanceLabel(this.event()?.importance));
  statusLabel = computed(() => this.getStatusLabel(this.event()?.status));

  participants = computed(() => this.event()?.indianParticipants || []);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        distinctUntilChanged(),
        switchMap((slug) => {
          if (!slug) {
            this.event.set(null);
            this.loading.set(false);
            return of(null);
          }

          this.loading.set(true);
          return this.payload.getCalendarEventBySlug(slug).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.event.set(event);
        this.loading.set(false);
      });
  }

  trackByParticipant(_: number, participant: CalendarEventParticipant): string {
    return participant.id;
  }

  getParticipantImageUrl(participant: CalendarEventParticipant): string {
    return this.payload.getMediaUrl(participant.photo || null) || this.payload.FALLBACK_ATHLETE_IMAGE;
  }

  getParticipantInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private getLocationLabel(location?: string, country?: string): string {
    if (!location && !country) {
      return 'Location to be confirmed';
    }

    if (!country || country === 'Multiple') {
      return location || country || 'Location to be confirmed';
    }

    if ((location || '').toLowerCase().includes(country.toLowerCase())) {
      return location || country;
    }

    return location ? `${location}, ${country}` : country;
  }

  private getScopeLabel(scope?: CalendarEvent['eventScope']): string {
    switch (scope) {
      case 'qualification_window':
        return 'Qualification window';
      case 'multi_sport_window':
        return 'Multi-sport window';
      case 'sport_event':
      default:
        return 'Sport event';
    }
  }

  private getImportanceLabel(importance?: CalendarEvent['importance']): string {
    switch (importance) {
      case 'core':
        return 'Core India watch';
      case 'watch':
        return 'Watchlist event';
      case 'high':
      default:
        return 'High-priority event';
    }
  }

  private getStatusLabel(status?: string): string {
    switch ((status || '').toLowerCase()) {
      case 'live':
        return 'Live now';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'postponed':
        return 'Postponed';
      case 'upcoming':
      default:
        return 'Upcoming';
    }
  }

  private formatDateRange(startValue?: string, endValue?: string): string {
    const startDate = this.toDate(startValue);
    const endDate = this.toDate(endValue || startValue);

    if (!startDate || !endDate) {
      return 'Dates to be confirmed';
    }

    if (startDate.getTime() === endDate.getTime()) {
      return this.formatDate(startDate, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

    if (sameMonth) {
      return `${this.formatDate(startDate, { day: 'numeric' })}-${this.formatDate(endDate, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }

    return `${this.formatDate(startDate, { day: 'numeric', month: 'short' })} - ${this.formatDate(endDate, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  private formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-IN', options).format(date);
  }

  private toDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const dateOnly = value.slice(0, 10);
    return new Date(`${dateOnly}T00:00:00`);
  }
}
