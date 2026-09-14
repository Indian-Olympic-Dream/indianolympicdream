import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatSpinner } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, forkJoin, interval, map, of, startWith, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayloadService } from '../services/payload.service';
import { SportsMomentService } from './sports-moment.service';
import { SportsHomeViewModel, SportsMoment, SportsMomentAction } from './sports-moment.model';
import { SportsDetailService } from '../shared/sports-detail/sports-detail.service';
import { RecentResultsSheetComponent } from './recent-results-sheet.component';
import {
  getYouTubeThumbnailUrl,
  OriginalsService,
  Video,
  resolveYouTubeVideoId,
} from '../originals/originals.service';
import { broadcastLabel, broadcastTimeLabel, selectHomeVideos } from '../originals/broadcast-presentation';

const EMPTY_HOME: SportsHomeViewModel = {
  now: new Date(),
  ongoingEvents: [],
  rightNow: [],
  nextIndia: null,
  recentResults: [],
  days: [],
  comingUp: [],
  horizon: null,
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
    RecentResultsSheetComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private payload = inject(PayloadService);
  private sportsMoments = inject(SportsMomentService);
  private route = inject(ActivatedRoute);
  private sportsDetail = inject(SportsDetailService);
  private originals = inject(OriginalsService);
  private destroyRef = inject(DestroyRef);
  private campaignRequestKey = '';
  private readonly retryRequests = new Subject<void>();
  readonly broadcastLabel = broadcastLabel;
  readonly broadcastTimeLabel = broadcastTimeLabel;
  readonly thumbnail = getYouTubeThumbnailUrl;

  loading = signal(true);
  loadFailed = signal(false);
  home = signal<SportsHomeViewModel>(EMPTY_HOME);
  resultsOpen = signal(false);
  detailOpen = this.sportsDetail.isOpen;
  gateway = signal<{ athletes: number; programme: number } | null>(null);
  gatewayFailed = signal(false);
  editorial = signal<Video[]>([]);
  editorialLoading = signal(true);
  editorialFailed = signal(false);
  visibleOngoing = computed(() => this.home().ongoingEvents.slice(0, 4));
  visibleLive = computed(() => this.home().rightNow.slice(0, 2));
  latestResult = computed(() => this.home().recentResults[0] || null);
  clock = signal(Date.now());

  ngOnInit(): void {
    this.loadEditorial();
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clock.set(Date.now()));
    combineLatest([this.route.queryParamMap, this.retryRequests.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        this.loading.set(true);
        this.loadFailed.set(false);
        const now = this.resolveNow(params.get('asOf'));
        return this.payload.getCalendarEvents({
          activeAfter: this.calendarWindowStart(now),
          limit: 500,
        }).pipe(
          switchMap((events) => this.sportsMoments.loadHome(events, now)),
          catchError(() => { this.loadFailed.set(true); return of(null); }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (viewModel) => {
        if (!viewModel) { this.loading.set(false); return; }
        this.home.set(viewModel);
        this.loadGateway(viewModel.horizon?.hubKey || '');
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

  retryLoad(): void { this.retryRequests.next(); }

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

  nextDateLabel(moment: SportsMoment): string {
    const parsed = new Date(`${moment.dateKey}T00:00:00+05:30`);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
    }).format(parsed).toUpperCase();
  }

  private resolveNow(value: string | null): Date {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private calendarWindowStart(now: Date): string {
    const start = new Date(now);
    start.setDate(start.getDate() - 21);
    return start.toISOString();
  }

  private loadGateway(key: string): void {
    if (key === this.campaignRequestKey) return;
    this.campaignRequestKey = key;
    this.gateway.set(null);
    this.gatewayFailed.set(false);
    if (!key) return;
    forkJoin({
      squad: this.payload.getEventHubParticipations(key),
      programme: this.payload.getEventHubProgramme(key),
    }).pipe(catchError(() => { this.gatewayFailed.set(true); this.campaignRequestKey = ''; return of(null); }), takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      if (!data || this.campaignRequestKey !== key) return;
      this.gateway.set({
        athletes: new Set(data.squad.filter(row => row.athlete?.id && !['withdrawn', 'replaced'].includes(row.selectionStatus || '') && row.status !== 'withdrawn').map(row => row.athlete!.id)).size,
        programme: data.programme.length,
      });
    });
  }

  loadEditorial(): void {
    this.editorialLoading.set(true);
    this.editorialFailed.set(false);
    this.originals.getHomeVideos(40).pipe(
      catchError(() => { this.editorialFailed.set(true); return of([]); }), takeUntilDestroyed(this.destroyRef),
    ).subscribe(videos => {
      this.editorial.set(selectHomeVideos(videos));
      this.editorialLoading.set(false);
    });
  }

  watchUrl(video: Video): string { return `https://www.youtube.com/watch?v=${resolveYouTubeVideoId(video)}`; }

  editorialMeta(video: Video): string {
    if (video.broadcast?.status === 'live') return 'IOD live · YouTube';
    const scheduled = broadcastTimeLabel(video);
    if (scheduled) return scheduled;
    const published = Date.parse(video.publishedDate || '');
    const type = video.broadcast?.status === 'replay' ? 'Replay' : video.type === 'live' ? 'Live show' : video.type === 'mixedZone' ? 'Mixed zone' : video.type;
    return Number.isFinite(published)
      ? `${type} · ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(published)}`
      : type;
  }
}
