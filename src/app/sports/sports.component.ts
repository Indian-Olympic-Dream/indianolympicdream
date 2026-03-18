import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { OlympicParticipation, PayloadService, Sport } from '../services/payload.service';
import {
  IndiaTier,
  INDIA_TIER_LABELS,
  SportLifecycle,
  resolveDefaultIndiaTier,
  resolveDefaultSportLifecycle,
} from '../models/india-tier';

type SportTier = IndiaTier;
type SportFilter = 'all' | SportTier;

interface DisciplineSummary {
  id: string;
  name: string;
  slug: string;
  athleteEntries: number;
  participationCount: number;
  medalCount: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
}

interface SportAthleteRow {
  id: string;
  name: string;
  slug: string;
  pictogramUrl: string | null;
  indiaTier: IndiaTier | null;
  olympicStatus: SportLifecycle | null;
  athleteEntries: number;
  participationCount: number;
  uniqueAthletes: number;
  editionCount: number;
  fourthPlaceCount: number;
  bestPlacement: number | null;
  disciplines: DisciplineSummary[];
  medalCount: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
}

@Component({
  selector: 'app-sports',
  standalone: true,
  imports: [CommonModule, RouterModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './sports.component.html',
  styleUrl: './sports.component.scss'
})
export class SportsComponent implements OnInit {
  private payload = inject(PayloadService);

  loading = signal(true);
  sportRows = signal<SportAthleteRow[]>([]);
  selectedFilter = signal<SportFilter>('all');

  filterOptions: { label: string; value: SportFilter }[] = [
    { label: 'All Sports', value: 'all' },
    { label: INDIA_TIER_LABELS.medal_hopeful, value: 'medal_hopeful' },
    { label: INDIA_TIER_LABELS.outside_chance, value: 'outside_chance' },
    { label: INDIA_TIER_LABELS.qualification_watch, value: 'qualification_watch' },
    { label: INDIA_TIER_LABELS.history_only, value: 'history_only' },
  ];

  displayedSportRows = computed(() => {
    const filter = this.selectedFilter();

    let rows = this.sportRows();

    if (filter !== 'all') {
      rows = rows.filter(row => this.getSportTier(row) === filter);
    }

    return [...rows].sort((a, b) => {
      const medalRankDiff = this.getDefaultSortRank(a) - this.getDefaultSortRank(b);
      if (medalRankDiff !== 0) return medalRankDiff;
      if (b.medalCount.total !== a.medalCount.total) return b.medalCount.total - a.medalCount.total;
      if (b.fourthPlaceCount !== a.fourthPlaceCount) return b.fourthPlaceCount - a.fourthPlaceCount;
      const productTierDiff = this.getProductTierRank(this.getSportTier(a)) - this.getProductTierRank(this.getSportTier(b));
      if (productTierDiff !== 0) return productTierDiff;
      if (b.athleteEntries !== a.athleteEntries) return b.athleteEntries - a.athleteEntries;
      if ((a.bestPlacement ?? 999) !== (b.bestPlacement ?? 999)) return (a.bestPlacement ?? 999) - (b.bestPlacement ?? 999);
      return a.name.localeCompare(b.name);
    });
  });

  ngOnInit() {
    this.loadSportsData();
  }

  setFilter(filter: SportFilter) {
    this.selectedFilter.set(filter);
  }

  isNearPodiumSport(sport: SportAthleteRow): boolean {
    return sport.medalCount.total === 0 && sport.fourthPlaceCount > 0;
  }

  getFilterCount(filter: SportFilter): number {
    if (filter === 'all') {
      return this.sportRows().length;
    }
    return this.sportRows().filter(row => this.getSportTier(row) === filter).length;
  }

  getSportStatusText(sport: SportAthleteRow): string {
    if (sport.olympicStatus === 'discontinued') {
      return sport.participationCount > 0 ? 'Historical archive · discontinued' : 'Discontinued Olympic sport';
    }
    if (sport.olympicStatus === 'new_in_la28' && sport.participationCount === 0) {
      return 'New in LA 2028';
    }
    if (sport.participationCount === 0) {
      return 'No Olympic participation yet';
    }
    return `${sport.uniqueAthletes} athletes · ${sport.participationCount} participations`;
  }

  isNavigableSport(sport: SportAthleteRow): boolean {
    return sport.participationCount > 0;
  }

  onSportCardClick(event: Event, sport: SportAthleteRow) {
    if (this.isNavigableSport(sport)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  getLifecycleBadge(sport: SportAthleteRow): string | null {
    if (sport.olympicStatus === 'new_in_la28') return 'LA28 New';
    if (sport.olympicStatus === 'discontinued') return 'Discontinued';
    return null;
  }

  getSportFallbackIcon(sportName: string): string {
    const icons: Record<string, string> = {
      'Hockey': '🏑',
      'Athletics': '🏃',
      'Shooting': '🎯',
      'Wrestling': '🤼',
      'Badminton': '🏸',
      'Boxing': '🥊',
      'Weightlifting': '🏋️',
      'Tennis': '🎾',
      'Swimming': '🏊',
      'Archery': '🏹',
      'Gymnastics': '🤸',
      'Rowing': '🚣',
      'Sailing': '⛵',
      'Equestrian': '🏇',
      'Fencing': '🤺',
      'Football': '⚽',
      'Golf': '⛳',
      'Judo': '🥋',
      'Table Tennis': '🏓',
      'Taekwondo': '🥋',
      'Volleyball': '🏐',
      'Cycling': '🚴',
      'Canoe': '🛶',
      'Triathlon': '🏃',
    };

    const lowerSportName = sportName.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lowerSportName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerSportName)) {
        return icon;
      }
    }
    return icons[sportName] || '🏅';
  }

  private getProductTierRank(tier: SportTier): number {
    if (tier === 'medal_hopeful') return 0;
    if (tier === 'outside_chance') return 1;
    if (tier === 'qualification_watch') return 2;
    return 3;
  }

  private getDefaultSortRank(row: SportAthleteRow): number {
    if (row.medalCount.gold > 0) return 0;
    if (row.medalCount.gold === 0 && row.medalCount.silver > 0) return 1;
    if (row.medalCount.gold === 0 && row.medalCount.silver === 0 && row.medalCount.bronze > 0) return 2;
    if (this.isNearPodiumSport(row)) return 3;
    if (row.olympicStatus === 'new_in_la28') return 4;
    return 5;
  }

  private loadSportsData() {
    forkJoin({
      sports: this.payload.getSports(),
      participations: this.payload.getParticipations({ limit: 5000 }),
    }).subscribe({
      next: ({ sports, participations }) => {
        this.sportRows.set(this.buildSportRows(sports, participations));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private getSportTier(row: SportAthleteRow): SportTier {
    return row.indiaTier || 'history_only';
  }

  private buildSportRows(sports: Sport[], participations: OlympicParticipation[]): SportAthleteRow[] {
    const sportsById = new Map(sports.map(sport => [sport.id, sport]));
    const childDisciplinesByParent = new Map<string, Sport[]>();
    sports.forEach(sport => {
      const parentId = this.getParentSportId(sport);
      if (!parentId || parentId === sport.id) return;
      if (!childDisciplinesByParent.has(parentId)) {
        childDisciplinesByParent.set(parentId, []);
      }
      childDisciplinesByParent.get(parentId)!.push(sport);
    });

    const totals = new Map<string, {
      id: string;
      name: string;
      slug: string;
      pictogramUrl: string | null;
      indiaTier: IndiaTier | null;
      olympicStatus: SportLifecycle | null;
      athleteEditionKeys: Set<string>;
      participationCount: number;
      uniqueAthleteIds: Set<string>;
      editionIds: Set<string>;
      countedMedals: Set<string>;
      countedFourthPlaces: Set<string>;
      bestPlacement: number | null;
      fourthPlaceCount: number;
      medalCount: { gold: number; silver: number; bronze: number; total: number };
      disciplineMap: Map<string, {
        id: string;
        name: string;
        slug: string;
        athleteEditionKeys: Set<string>;
        participationCount: number;
        countedMedals: Set<string>;
        medalCount: { gold: number; silver: number; bronze: number; total: number };
      }>;
    }>();

    // Seed all top-level sports so sports with zero participation remain visible and ready for future qualifiers.
    sports
      .filter((sport) => {
        const parentId = this.getParentSportId(sport);
        return !parentId || parentId === sport.id;
      })
      .forEach(sport => {
        const firstChildPictogram = (childDisciplinesByParent.get(sport.id) || [])
          .map(child =>
            this.payload.getSportPictogramUrl({
              sport: child,
              includePlaceholderFallback: false,
            })
          )
          .find((url): url is string => !!url);

        totals.set(sport.id, {
          id: sport.id,
          name: sport.name,
          slug: sport.slug,
          pictogramUrl:
            this.payload.getSportPictogramUrl({
              sport,
              includePlaceholderFallback: false,
            }) ||
            firstChildPictogram ||
            null,
          indiaTier: this.resolveSportIndiaTier(sport),
          olympicStatus: this.resolveSportLifecycle(sport),
          athleteEditionKeys: new Set<string>(),
          participationCount: 0,
          uniqueAthleteIds: new Set<string>(),
          editionIds: new Set<string>(),
          countedMedals: new Set<string>(),
          countedFourthPlaces: new Set<string>(),
          bestPlacement: null,
          fourthPlaceCount: 0,
          medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
          disciplineMap: new Map(),
        });
      });

    participations.forEach(participation => {
      const sportResolution = this.resolveSports(participation, sportsById);
      if (!sportResolution) return;
      const { canonical, discipline } = sportResolution;

      if (!totals.has(canonical.id)) {
        totals.set(canonical.id, {
          id: canonical.id,
          name: canonical.name,
          slug: canonical.slug,
          pictogramUrl: canonical.pictogramUrl,
          indiaTier: canonical.indiaTier,
          olympicStatus: canonical.olympicStatus,
          athleteEditionKeys: new Set<string>(),
          participationCount: 0,
          uniqueAthleteIds: new Set<string>(),
          editionIds: new Set<string>(),
          countedMedals: new Set<string>(),
          countedFourthPlaces: new Set<string>(),
          bestPlacement: null,
          fourthPlaceCount: 0,
          medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
          disciplineMap: new Map(),
        });
      }

      const row = totals.get(canonical.id)!;
      if (!row.pictogramUrl && canonical.pictogramUrl) {
        row.pictogramUrl = canonical.pictogramUrl;
      }
      if (!row.indiaTier && canonical.indiaTier) {
        row.indiaTier = canonical.indiaTier;
      }
      if (!row.olympicStatus && canonical.olympicStatus) {
        row.olympicStatus = canonical.olympicStatus;
      }

      if (!row.disciplineMap.has(discipline.id)) {
        row.disciplineMap.set(discipline.id, {
          id: discipline.id,
          name: discipline.name,
          slug: discipline.slug,
          athleteEditionKeys: new Set<string>(),
          participationCount: 0,
          countedMedals: new Set<string>(),
          medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
        });
      }
      const disciplineRow = row.disciplineMap.get(discipline.id)!;

      const athleteId = typeof participation.athlete === 'object' ? participation.athlete?.id : null;
      const editionId = participation.edition?.id;
      const eventId = typeof participation.event === 'object' ? participation.event?.id : '';
      const eventName = typeof participation.event === 'object' ? participation.event?.name : '';
      const placement = this.extractPlacement(participation.placement);

      if (athleteId && editionId) {
        row.athleteEditionKeys.add(`${athleteId}-${editionId}`);
        disciplineRow.athleteEditionKeys.add(`${athleteId}-${editionId}`);
      }
      if (athleteId) {
        row.uniqueAthleteIds.add(athleteId);
      }
      if (editionId) {
        row.editionIds.add(editionId);
      }
      if (placement && placement > 0) {
        row.bestPlacement = row.bestPlacement === null ? placement : Math.min(row.bestPlacement, placement);
      }

      if (['gold', 'silver', 'bronze'].includes(participation.result)) {
        const medalKey = `${editionId || ''}-${eventId || eventName}-${participation.result}`;
        if (!row.countedMedals.has(medalKey)) {
          row.countedMedals.add(medalKey);
          if (participation.result === 'gold') row.medalCount.gold++;
          if (participation.result === 'silver') row.medalCount.silver++;
          if (participation.result === 'bronze') row.medalCount.bronze++;
          row.medalCount.total++;
        }

        if (!disciplineRow.countedMedals.has(medalKey)) {
          disciplineRow.countedMedals.add(medalKey);
          if (participation.result === 'gold') disciplineRow.medalCount.gold++;
          if (participation.result === 'silver') disciplineRow.medalCount.silver++;
          if (participation.result === 'bronze') disciplineRow.medalCount.bronze++;
          disciplineRow.medalCount.total++;
        }
      }

      if (this.isFourthPlaceResult(participation.result, placement)) {
        const fourthPlaceKey = `${editionId || ''}-${eventId || eventName}-4`;
        if (!row.countedFourthPlaces.has(fourthPlaceKey)) {
          row.countedFourthPlaces.add(fourthPlaceKey);
          row.fourthPlaceCount++;
        }
      }
    });

    return Array.from(totals.values())
      .map(row => {
        const disciplines = Array.from(row.disciplineMap.values())
          .map(discipline => ({
            id: discipline.id,
            name: discipline.name,
            slug: discipline.slug,
            athleteEntries: discipline.athleteEditionKeys.size,
            participationCount: discipline.athleteEditionKeys.size,
            medalCount: discipline.medalCount,
          }))
          .sort((a, b) => {
            if (b.participationCount !== a.participationCount) return b.participationCount - a.participationCount;
            if (b.athleteEntries !== a.athleteEntries) return b.athleteEntries - a.athleteEntries;
            if (b.medalCount.total !== a.medalCount.total) return b.medalCount.total - a.medalCount.total;
            return a.name.localeCompare(b.name);
          });

        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          pictogramUrl: row.pictogramUrl,
          indiaTier: row.indiaTier,
          olympicStatus: row.olympicStatus,
          athleteEntries: row.athleteEditionKeys.size,
          participationCount: disciplines.reduce((total, discipline) => total + discipline.participationCount, 0),
          uniqueAthletes: row.uniqueAthleteIds.size,
          editionCount: row.editionIds.size,
          fourthPlaceCount: row.fourthPlaceCount,
          bestPlacement: row.bestPlacement,
          disciplines,
          medalCount: row.medalCount,
        };
      })
      .sort((a, b) => {
        if (b.participationCount !== a.participationCount) return b.participationCount - a.participationCount;
        if (b.athleteEntries !== a.athleteEntries) return b.athleteEntries - a.athleteEntries;
        if (b.medalCount.gold !== a.medalCount.gold) return b.medalCount.gold - a.medalCount.gold;
        if ((a.bestPlacement ?? 999) !== (b.bestPlacement ?? 999)) return (a.bestPlacement ?? 999) - (b.bestPlacement ?? 999);
        return a.name.localeCompare(b.name);
      });
  }

  private getParentSportId(sport: Sport | null | undefined): string | null {
    if (!sport) return null;
    const rawParent = (sport as unknown as { parentSport?: unknown }).parentSport;

    if (typeof rawParent === 'string') return rawParent;
    if (typeof rawParent === 'object' && rawParent && 'id' in (rawParent as Record<string, unknown>)) {
      const parentId = (rawParent as Record<string, unknown>).id;
      return typeof parentId === 'string' ? parentId : null;
    }

    return null;
  }

  private isFourthPlaceResult(
    result: OlympicParticipation['result'] | string | undefined,
    placement: number | null,
  ): boolean {
    if (placement === 4) return true;

    const normalized = (result || '').toString().trim().toLowerCase();
    return normalized === '4th' || normalized === 'fourth' || normalized === '4';
  }

  private extractPlacement(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private resolveSports(
    participation: OlympicParticipation,
    sportsById: Map<string, Sport>,
  ): {
    canonical: {
      id: string;
      name: string;
      slug: string;
      pictogramUrl: string | null;
      indiaTier: IndiaTier | null;
      olympicStatus: SportLifecycle | null;
    };
    discipline: { id: string; name: string; slug: string; pictogramUrl: string | null };
  } | null {
    if (typeof participation.event !== 'object' || !participation.event?.sport || typeof participation.event.sport !== 'object') {
      return null;
    }

    const eventSportRaw = participation.event.sport as any;
    if (!eventSportRaw?.id || !eventSportRaw?.name) {
      return null;
    }

    const eventSport = sportsById.get(eventSportRaw.id) || eventSportRaw;
    const parentFromParticipation = typeof eventSportRaw.parentSport === 'object' ? eventSportRaw.parentSport : null;
    const parentId =
      (typeof eventSport.parentSport === 'object' ? eventSport.parentSport?.id : null) ||
      parentFromParticipation?.id ||
      null;
    const canonicalId = parentId || eventSport.id;
    const canonicalSport = sportsById.get(canonicalId);

    return {
      canonical: {
        id: canonicalId,
        name: canonicalSport?.name || parentFromParticipation?.name || eventSport.name,
        slug: canonicalSport?.slug || parentFromParticipation?.slug || eventSport.slug || '',
        indiaTier: this.resolveSportIndiaTier(canonicalSport || parentFromParticipation || eventSport),
        olympicStatus: this.resolveSportLifecycle(canonicalSport || parentFromParticipation || eventSport),
        pictogramUrl:
          this.payload.getSportPictogramUrl({
            sport: canonicalSport || eventSport,
            sportSlug: canonicalSport?.slug || parentFromParticipation?.slug || eventSport.slug,
            sportName: canonicalSport?.name || parentFromParticipation?.name || eventSport.name,
            parentSport: parentFromParticipation,
            includePlaceholderFallback: false,
          }) || null,
      },
      discipline: {
        id: eventSport.id,
        name: eventSport.name,
        slug: eventSport.slug || '',
        pictogramUrl:
          this.payload.getSportPictogramUrl({
            sport: eventSport,
            includePlaceholderFallback: false,
          }) || null,
      },
    };
  }

  private resolveSportIndiaTier(sport: Partial<Sport> | null | undefined): IndiaTier | null {
    const parentSport = typeof sport?.parentSport === 'object' ? sport.parentSport : null;
    return (
      sport?.indiaTier ||
      parentSport?.indiaTier ||
      resolveDefaultIndiaTier({
        slug: parentSport?.slug || sport?.slug || '',
        name: parentSport?.name || sport?.name || '',
      })
    );
  }

  private resolveSportLifecycle(sport: Partial<Sport> | null | undefined): SportLifecycle | null {
    const parentSport = typeof sport?.parentSport === 'object' ? sport.parentSport : null;
    return (
      sport?.olympicStatus ||
      parentSport?.olympicStatus ||
      resolveDefaultSportLifecycle({
        slug: parentSport?.slug || sport?.slug || '',
        name: parentSport?.name || sport?.name || '',
      })
    );
  }
}
