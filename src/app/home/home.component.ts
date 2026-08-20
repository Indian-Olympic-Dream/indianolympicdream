import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatSpinner } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { interval, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayloadService } from '../services/payload.service';
import { SportsMomentService } from './sports-moment.service';
import { SportsMomentTimelineComponent } from './sports-moment-timeline.component';
import { SportsHomeViewModel, SportsMoment, SportsMomentAction } from './sports-moment.model';
import { SportsDetailService } from '../shared/sports-detail/sports-detail.service';
import { RecentResultsSheetComponent } from './recent-results-sheet.component';
import { CountryFlagComponent } from '../shared/country-flag/country-flag.component';
import { ShuttleIconComponent } from '../shared/shuttle-icon/shuttle-icon.component';

const EMPTY_HOME: SportsHomeViewModel = {
  now: new Date(),
  liveCalendarCount: 0,
  rightNow: [],
  nextIndia: null,
  recentResults: [],
  days: [],
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    RouterModule,
    MatIcon,
    MatSpinner,
    SportsMomentTimelineComponent,
    RecentResultsSheetComponent,
    CountryFlagComponent,
    ShuttleIconComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private payload = inject(PayloadService);
  private sportsMoments = inject(SportsMomentService);
  private route = inject(ActivatedRoute);
  private sportsDetail = inject(SportsDetailService);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  home = signal<SportsHomeViewModel>(EMPTY_HOME);
  resultsOpen = signal(false);
  detailOpen = this.sportsDetail.isOpen;
  latestResult = computed(() => this.home().recentResults[0] || null);
  clock = signal(Date.now());

  ngOnInit(): void {
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clock.set(Date.now()));
    this.route.queryParamMap.pipe(
      switchMap((params) => {
        this.loading.set(true);
        const now = this.resolveNow(params.get('asOf'));
        return this.payload.getCalendarEvents({ limit: 500 }).pipe(
          switchMap((events) => this.sportsMoments.loadHome(events, now)),
          map((viewModel) => ({ viewModel })),
        );
      }),
    ).subscribe({
      next: ({ viewModel }) => {
        this.home.set(viewModel);
        const activeMomentId = this.sportsDetail.activeMomentId();
        if (activeMomentId) {
          const refreshed = viewModel.days
            .flatMap((day) => [
              ...day.untimedMoments,
              ...day.timedEntries.flatMap((entry) => entry.kind === 'moment' ? [entry.moment] : []),
            ])
            .concat(viewModel.recentResults)
            .find((moment) => moment.id === activeMomentId);
          if (refreshed) this.sportsDetail.refreshOpenMoment(refreshed);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  trackMoment(_: number, moment: SportsMoment): string {
    return moment.id;
  }

  isInternal(action: SportsMomentAction | null): boolean {
    return action?.navigation.kind === 'internal';
  }

  isExternal(action: SportsMomentAction | null): boolean {
    return action?.navigation.kind === 'external';
  }

  onMomentClick(moment: SportsMoment, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.sportsDetail.openMoment(moment);
  }

  openRecentResults(): void {
    this.resultsOpen.set(true);
  }

  closeRecentResults(): void {
    this.resultsOpen.set(false);
  }

  openRecentResult(moment: SportsMoment): void {
    this.sportsDetail.openMomentFromResults(moment);
  }

  outcomeLabel(moment: SportsMoment): string {
    if (moment.result?.outcome === 'win') return 'Win';
    if (moment.result?.outcome === 'loss') return 'Loss';
    if (moment.result?.outcome === 'draw') return 'Draw';
    return 'Result';
  }

  liveSideName(moment: SportsMoment, side: 'india' | 'opponent'): string {
    const matchup = moment.result?.matchup;
    const structured = side === 'india' ? matchup?.indiaDisplayName : matchup?.opponentDisplayName;
    if (structured) return structured;
    const parts = moment.headline.split(/\s+(?:vs\.?|v)\s+/i);
    return side === 'india' ? (parts[0] || 'India') : (parts[1] || 'Opponents');
  }

  liveCountryCode(moment: SportsMoment, side: 'india' | 'opponent'): string | null {
    return side === 'india'
      ? moment.result?.matchup?.indiaCountryCode || 'IND'
      : moment.result?.matchup?.opponentCountryCode || null;
  }

  liveScoreAt(moment: SportsMoment, side: 'india' | 'opponent', game: number): number | string | null {
    return moment.result?.score?.[side]?.[game] ?? null;
  }

  liveStateLabel(moment: SportsMoment): string {
    const live = moment.result?.live;
    if (!live) return 'Live';
    if (live.status === 'suspended') return 'Coverage paused';
    if (live.phase === 'interval') return `Interval · Game ${live.currentGame}`;
    if (live.phase === 'challenge') return 'Challenge in review';
    if (live.phase === 'between-games') return `Game ${live.currentGame} complete`;
    if (live.pressure) {
      const owner = live.pressure.side === 'both'
        ? 'Both sides'
        : live.pressure.side === 'india' ? 'India' : this.liveSideName(moment, 'opponent');
      return `${live.pressure.kind === 'match-point' ? 'Match point' : 'Game point'} · ${owner}`;
    }
    return `Game ${live.currentGame}`;
  }

  liveDuration(moment: SportsMoment): string | null {
    const live = moment.result?.live;
    if (!live) return null;
    let seconds = live.elapsedSeconds;
    if (live.startedAt && !live.provisionalCompletedAt) {
      const started = new Date(live.startedAt).getTime();
      if (Number.isFinite(started)) seconds = Math.max(0, Math.floor((this.clock() - started) / 1000));
    }
    if (seconds == null) return null;
    return `${Math.max(0, Math.floor(seconds / 60))} min`;
  }

  private resolveNow(value: string | null): Date {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
