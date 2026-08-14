import { Component, Input, inject } from '@angular/core';
import { NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import {
  SportsMoment,
  SportsMomentAction,
  SportsMomentAnchor,
  SportsProgrammeSummary,
  SportsTimelineDay,
  SportsTimelineEntry,
} from './sports-moment.model';
import { SportsDetailService } from '../shared/sports-detail/sports-detail.service';

@Component({
  selector: 'app-sports-moment-timeline',
  standalone: true,
  imports: [NgFor, NgIf, NgTemplateOutlet, RouterModule, MatIcon],
  templateUrl: './sports-moment-timeline.component.html',
  styleUrls: ['./sports-moment-timeline.component.scss'],
})
export class SportsMomentTimelineComponent {
  private sportsDetail = inject(SportsDetailService);

  @Input({ required: true }) days: SportsTimelineDay[] = [];

  private expandedDays = new Set<string>();

  trackDay(_: number, day: SportsTimelineDay): string {
    return day.dateKey;
  }

  trackMoment(_: number, moment: SportsMoment): string {
    return moment.id;
  }

  trackEntry(_: number, entry: SportsTimelineEntry): string {
    return entry.id;
  }

  isExpanded(day: SportsTimelineDay): boolean {
    return this.expandedDays.has(day.dateKey);
  }

  toggleDay(day: SportsTimelineDay): void {
    if (this.expandedDays.has(day.dateKey)) {
      this.expandedDays.delete(day.dateKey);
    } else {
      this.expandedDays.add(day.dateKey);
    }
  }

  visibleUntimed(day: SportsTimelineDay): SportsMoment[] {
    return day.dense && !this.isExpanded(day) ? day.untimedMoments.slice(0, 3) : day.untimedMoments;
  }

  visibleEntries(day: SportsTimelineDay): SportsTimelineEntry[] {
    if (!day.dense || this.isExpanded(day)) return day.timedEntries;
    const momentEntries = day.timedEntries.filter((entry) => entry.kind === 'moment').slice(0, 4);
    const nowEntry = day.timedEntries.find((entry) => entry.kind === 'now');
    return [...momentEntries, ...(nowEntry ? [nowEntry] : [])]
      .sort((a, b) => a.sortMinutes - b.sortMinutes);
  }

  hiddenLoadedCount(day: SportsTimelineDay): number {
    if (!day.dense || this.isExpanded(day)) return 0;
    const visible = this.visibleUntimed(day).length +
      this.visibleEntries(day).filter((entry) => entry.kind === 'moment').length;
    const loaded = day.untimedMoments.length +
      day.timedEntries.filter((entry) => entry.kind === 'moment').length;
    return Math.max(0, loaded - visible);
  }

  unpublishedProgrammeCount(day: SportsTimelineDay): number {
    if (!day.programme) return 0;
    const loaded = day.untimedMoments.length +
      day.timedEntries.filter((entry) => entry.kind === 'moment').length;
    return Math.max(0, day.programme.totalEvents - loaded);
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
      event.stopPropagation();
    }
    if (moment.isDisabled || moment.timingState === 'conditional') {
      return;
    }
    this.sportsDetail.openMoment(moment);
  }

  onAnchorClick(anchor: SportsMomentAnchor, event?: Event): void {
    if (anchor.action?.navigation.kind === 'external' && anchor.action.navigation.href) {
      return;
    }
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.sportsDetail.openAnchor(anchor);
  }

  onProgrammeClick(programme: SportsProgrammeSummary, event?: Event): void {
    if (programme.action?.navigation.kind === 'external' && programme.action.navigation.href) {
      return;
    }
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.sportsDetail.openProgramme({
      title: programme.title,
      location: programme.location || '',
      externalUrl: programme.action?.navigation.href || undefined,
    } as any);
  }
}
