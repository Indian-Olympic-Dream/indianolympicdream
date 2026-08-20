import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { SportsMoment } from './sports-moment.model';

interface RecentResultsGroup {
  dateKey: string;
  label: string;
  results: SportsMoment[];
}

const INDIA_TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-recent-results-sheet',
  standalone: true,
  imports: [NgFor, NgIf, MatIcon],
  templateUrl: './recent-results-sheet.component.html',
  styleUrls: ['./recent-results-sheet.component.scss'],
})
export class RecentResultsSheetComponent {
  @Input({ required: true }) results: SportsMoment[] = [];
  @Input() now = new Date();
  @Input() covered = false;
  @Output() closed = new EventEmitter<void>();
  @Output() resultSelected = new EventEmitter<SportsMoment>();

  get groups(): RecentResultsGroup[] {
    const grouped = new Map<string, SportsMoment[]>();
    for (const result of this.results) {
      grouped.set(result.dateKey, [...(grouped.get(result.dateKey) || []), result]);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, results]) => ({
        dateKey,
        label: this.groupLabel(dateKey),
        results,
      }));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.covered) return;
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  select(result: SportsMoment): void {
    this.resultSelected.emit(result);
  }

  outcomeLabel(result: SportsMoment): string {
    if (result.result?.outcome === 'win') return 'Win';
    if (result.result?.outcome === 'loss') return 'Loss';
    if (result.result?.outcome === 'draw') return 'Draw';
    return 'Result';
  }

  trackGroup(_: number, group: RecentResultsGroup): string {
    return group.dateKey;
  }

  trackResult(_: number, result: SportsMoment): string {
    return result.id;
  }

  private groupLabel(dateKey: string): string {
    const today = this.dateKey(this.now);
    const yesterday = this.dateKey(new Date(this.now.getTime() - DAY_MS));
    if (dateKey === today) return 'Today';
    if (dateKey === yesterday) return 'Yesterday';

    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: INDIA_TIME_ZONE,
    }).format(new Date(`${dateKey}T12:00:00+05:30`));
  }

  private dateKey(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: INDIA_TIME_ZONE,
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values['year']}-${values['month']}-${values['day']}`;
  }
}
