import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatSpinner } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { PayloadService } from '../services/payload.service';
import { SportsMomentService } from './sports-moment.service';
import { SportsMomentTimelineComponent } from './sports-moment-timeline.component';
import { SportsHomeViewModel, SportsMoment, SportsMomentAction } from './sports-moment.model';
import { SportsDetailService } from '../shared/sports-detail/sports-detail.service';

const EMPTY_HOME: SportsHomeViewModel = {
  now: new Date(),
  liveCalendarCount: 0,
  rightNow: [],
  nextIndia: null,
  days: [],
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DatePipe, NgFor, NgIf, NgTemplateOutlet, RouterModule, MatIcon, MatSpinner, SportsMomentTimelineComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private payload = inject(PayloadService);
  private sportsMoments = inject(SportsMomentService);
  private route = inject(ActivatedRoute);
  private sportsDetail = inject(SportsDetailService);

  loading = signal(true);
  home = signal<SportsHomeViewModel>(EMPTY_HOME);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(
      switchMap((params) => {
        this.loading.set(true);
        const now = this.resolveNow(params.get('asOf'));
        return this.payload.getCalendarEvents({ limit: 500 }).pipe(
          switchMap((events) => forkJoin({
            events: of(events),
            viewModel: this.sportsMoments.loadHome(events, now),
          })),
        );
      }),
    ).subscribe({
      next: ({ viewModel }) => {
        this.home.set(viewModel);
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

  private resolveNow(value: string | null): Date {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
