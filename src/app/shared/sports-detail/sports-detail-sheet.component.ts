import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SportsDetailService } from './sports-detail.service';
import { BadmintonEntryItem } from './sports-detail.model';
import { LiveScoreUpdate } from '../../services/payload.service';
import { CountryFlagComponent } from '../country-flag/country-flag.component';
import { ShuttleIconComponent } from '../shuttle-icon/shuttle-icon.component';

@Component({
  selector: 'app-sports-detail-sheet',
  standalone: true,
  imports: [CommonModule, MatIconModule, CountryFlagComponent, ShuttleIconComponent],
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

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.detailService.isOpen()) {
      event.preventDefault();
      event.stopImmediatePropagation();
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

  compactRound(round: string): string {
    const number = round.match(/\d+/)?.[0];
    if (number) return `R${number}`;
    return round.replace(/^round\s*/i, '').toUpperCase();
  }

  scoreAt(score: string | null | undefined, index: number): string {
    return score?.split(' ')[index] || '—';
  }

  isGameWinner(match: BadmintonEntryItem, index: number, side: 'india' | 'opponent'): boolean {
    const india = Number(match.score?.split(' ')[index]);
    const opponent = Number(match.opponentScore?.split(' ')[index]);
    if (!Number.isFinite(india) || !Number.isFinite(opponent) || india === opponent) return false;
    return side === 'india' ? india > opponent : opponent > india;
  }

  liveUpdateTitle(update: LiveScoreUpdate, match: BadmintonEntryItem): string {
    const side = update.side ? this.liveSideLabel(match, update.side) : null;
    if (update.commentary && side) return `${update.commentary.label} · ${side}`;
    switch (update.type) {
      case 'match-initialized': return 'Match initialized';
      case 'players-march-on': return 'Players on court';
      case 'coin-toss': return `${side || 'Toss winner'} won the toss`;
      case 'warm-up': return 'Warm-up underway';
      case 'match-start': return 'Match underway';
      case 'game-start': return `Game ${update.currentGame} begins`;
      case 'interval-start': return `Game ${update.currentGame} interval`;
      case 'interval-end': return 'Play resumes after the interval';
      case 'game-complete': return `Game ${update.currentGame} to ${this.liveSideLabel(match, update.winner || 'india')}`;
      case 'challenge-start': return `${side || 'Player'} challenge`;
      case 'challenge-result': return `Challenge ${update.resolution || 'resolved'}`;
      case 'match-complete': return 'Match complete · provisional';
      case 'official-result': return 'Verified result published';
      case 'suspended': return 'Play suspended';
      case 'resumed': return 'Play resumes';
      case 'correction': return 'Score corrected';
      case 'point': return `Point to ${side || 'player'}`;
    }
  }

  private liveSideLabel(match: BadmintonEntryItem, side: 'india' | 'opponent'): string {
    if (side === 'india') return 'India';
    return match.opponentCountry || match.opponentNames?.join(' / ') || 'opponent';
  }

  liveMatchState(match: BadmintonEntryItem): string {
    if (match.liveStatus === 'suspended') return 'Coverage paused';
    if (match.livePhase === 'interval') return `Interval · Game ${match.currentGame || 1}`;
    if (match.livePhase === 'challenge') return 'Challenge in review';
    if (match.livePhase === 'between-games') return `Game ${match.currentGame || 1} complete`;
    if (match.livePressure) {
      const owner = match.livePressure.side === 'both'
        ? 'Both sides'
        : this.liveSideLabel(match, match.livePressure.side);
      return `${match.livePressure.kind === 'match-point' ? 'Match point' : 'Game point'} · ${owner}`;
    }
    return 'Live';
  }

  latestLiveUpdates(match: BadmintonEntryItem): LiveScoreUpdate[] {
    return [...(match.liveUpdates || [])].reverse();
  }

  trackLiveUpdate(_: number, update: LiveScoreUpdate): string {
    return update.id;
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
