import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SportsDetailService } from './sports-detail.service';
import { BadmintonEntryItem } from './sports-detail.model';

@Component({
  selector: 'app-sports-detail-sheet',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './sports-detail-sheet.component.html',
  styleUrls: ['./sports-detail-sheet.component.scss'],
})
export class SportsDetailSheetComponent {
  detailService = inject(SportsDetailService);

  detail = this.detailService.detail;
  activeDiscipline = signal<string>('');

  disciplines = computed(() => {
    const entries = this.detail()?.badmintonEntries;
    if (!entries?.length) return [];
    return [...new Set(entries.map((e) => e.discipline).filter(Boolean))];
  });

  effectiveDiscipline = computed(() => {
    const list = this.disciplines();
    if (!list.length) return '';
    const current = this.activeDiscipline();
    if (current && list.includes(current)) return current;
    return list[0];
  });

  filteredBadmintonEntries = computed<BadmintonEntryItem[]>(() => {
    const entries = this.detail()?.badmintonEntries;
    if (!entries?.length) return [];
    const disc = this.effectiveDiscipline();
    if (!disc) return entries;
    return entries.filter((e) => e.discipline === disc);
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.detailService.isOpen()) {
      this.close();
    }
  }

  selectDiscipline(disc: string): void {
    this.activeDiscipline.set(disc);
  }

  getDisciplineShort(disc: string): string {
    const d = disc.toLowerCase();
    if (d.includes("men's singles") || d === 'ms') return 'MS';
    if (d.includes("women's singles") || d === 'ws') return 'WS';
    if (d.includes("men's doubles") || d === 'md') return 'MD';
    if (d.includes("women's doubles") || d === 'wd') return 'WD';
    if (d.includes("mixed") || d === 'xd') return 'XD';
    return disc.slice(0, 2).toUpperCase();
  }

  close(): void {
    this.detailService.close();
  }

  onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.classList.contains('sports-detail-backdrop')) {
      this.close();
    }
  }
}
