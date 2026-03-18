import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { PayloadService, OlympicParticipation, Edition, GoldenMoment, Sport } from '../services/payload.service';
import { SportLifecycle, resolveDefaultSportLifecycle } from '../models/india-tier';

interface SportBreakdown {
  name: string;
  slug: string;
  pictogramUrl?: string | null;
  olympicStatus?: SportLifecycle | null;
  participationCount: number;
  uniqueAthletes: number;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

interface Medalist {
  name: string;
  sport: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}



interface Era {
  label: string;
  shortLabel: string;
  startYear: number;
  endYear: number;
}

interface EditionCard {
  id: string;
  slug: string;
  year: number;
  city: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  athleteCount: number;
  colors?: { primary?: string; secondary?: string; accent?: string };
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIconModule,
  ],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  private payload = inject(PayloadService);

  // Signals for reactive state
  loading = signal(true);
  participations = signal<OlympicParticipation[]>([]);
  participationCounts = signal<{ athleteId: string; editionId: string; year: number }[]>([]); // Lightweight for counting
  editions = signal<Edition[]>([]);
  sportsCatalog = signal<Sport[]>([]);
  private sportsById = computed<Map<string, Sport>>(() => new Map(this.sportsCatalog().map((sport) => [sport.id, sport])));
  selectedEra = signal<string>('all');
  totalAthletes = signal(0);

  // Era definitions with year ranges shown
  eras: Era[] = [
    { label: 'Pre-Ind.', shortLabel: 'Pre-Ind.', startYear: 1900, endYear: 1947 },
    { label: 'Golden Age', shortLabel: 'Golden Age', startYear: 1948, endYear: 1972 },
    { label: 'Decline', shortLabel: 'Decline', startYear: 1976, endYear: 1992 },
    { label: 'Transition', shortLabel: 'Transition', startYear: 1996, endYear: 2004 },
    { label: 'Modern', shortLabel: 'Modern', startYear: 2008, endYear: 2024 },
  ];

  // Golden Moments - Loaded dynamically
  goldenMoments = signal<GoldenMoment[]>([]);

  // Computed: filtered participations by era (medal participations only)
  filteredParticipations = computed(() => {
    const era = this.selectedEra();
    if (era === 'all') return this.participations();

    const selectedEra = this.eras.find(e => e.label === era);
    if (!selectedEra) return this.participations();

    return this.participations().filter(p => {
      const year = p.edition?.year;
      return year && year >= selectedEra.startYear && year <= selectedEra.endYear;
    });
  });

  // Computed: filtered participation counts by era (for athlete counts)
  filteredParticipationCounts = computed(() => {
    const era = this.selectedEra();
    if (era === 'all') return this.participationCounts();

    const selectedEra = this.eras.find(e => e.label === era);
    if (!selectedEra) return this.participationCounts();

    return this.participationCounts().filter(p => {
      return p.year && p.year >= selectedEra.startYear && p.year <= selectedEra.endYear;
    });
  });

  // Computed: filtered editions by era
  filteredEditions = computed(() => {
    const era = this.selectedEra();
    const eds = this.editions().filter(e => e.year && e.year < 2028); // Exclude future

    if (era === 'all') return eds;

    const selectedEra = this.eras.find(e => e.label === era);
    if (!selectedEra) return eds;

    return eds.filter(e => e.year && e.year >= selectedEra.startYear && e.year <= selectedEra.endYear);
  });

  // Edition cards with medal counts
  editionCards = computed<EditionCard[]>(() => {
    const cards: EditionCard[] = [];
    const allCounts = this.filteredParticipationCounts();
    const medalParts = this.filteredParticipations();

    this.filteredEditions().forEach(edition => {
      const editionMedals = medalParts.filter(p => p.edition?.id === edition.id);
      const editionAthletes = new Set(allCounts
        .filter(p => p.editionId === edition.id)
        .map(p => p.athleteId)
      );

      // Count unique medals (team sports = 1 medal per event)
      const counted = new Set<string>();
      let gold = 0, silver = 0, bronze = 0;

      editionMedals.forEach(p => {
        const key = `${p.event?.name || ''}-${p.result}`;
        if (!counted.has(key)) {
          counted.add(key);
          if (p.result === 'gold') gold++;
          else if (p.result === 'silver') silver++;
          else if (p.result === 'bronze') bronze++;
        }
      });

      if (editionAthletes.size > 0 || gold + silver + bronze > 0) {
        cards.push({
          id: edition.id,
          slug: edition.slug || edition.year?.toString() || '',
          year: edition.year || 0,
          city: edition.city || '',
          gold, silver, bronze,
          total: gold + silver + bronze,
          athleteCount: editionAthletes.size,
          colors: (edition as any).colors || undefined
        });
      }
    });

    return cards.sort((a, b) => b.year - a.year); // Most recent first
  });

  // Correct medal counts using unique event+result key
  goldCount = computed(() => this.countUniqueMedals('gold'));
  silverCount = computed(() => this.countUniqueMedals('silver'));
  bronzeCount = computed(() => this.countUniqueMedals('bronze'));
  totalMedals = computed(() => this.goldCount() + this.silverCount() + this.bronzeCount());

  // Overall medals by sport (always shows all-time, not filtered)
  overallSportsBreakdown = computed<SportBreakdown[]>(() => {
    return this.buildSportsBreakdown(this.participations());
  });

  // Filtered sports breakdown (by era)
  sportsBreakdown = computed<SportBreakdown[]>(() => {
    return this.buildSportsBreakdown(this.filteredParticipations());
  });

  // Dynamic athlete count for current era
  filteredAthleteCount = computed(() => {
    const athletes = new Set<string>();
    this.filteredParticipationCounts().forEach(p => {
      if (p.athleteId) athletes.add(p.athleteId);
    });
    return athletes.size;
  });

  // LA 2028 Countdown
  daysToLA2028 = computed(() => {
    const la2028 = new Date('2028-07-14'); // LA 2028 Opening Ceremony
    const today = new Date();
    const diff = la2028.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // Load all participation records (medals + participated results)
    this.payload.getParticipations({ limit: 5000 }).subscribe(participations => {
      this.participations.set(participations);
      this.loading.set(false);
    });

    // Load ALL participation counts (lightweight)
    this.payload.getParticipationCounts().subscribe(counts => {
      this.participationCounts.set(counts);
    });

    // Load editions
    this.payload.getEditions().subscribe(docs => {
      this.editions.set(docs);
    });

    // Load sports catalog for parent sport canonical mapping
    this.payload.getSports().subscribe(sports => {
      this.sportsCatalog.set(sports);
    });

    // Load Golden Moments
    this.payload.getGoldenMoments().subscribe(moments => {
      this.goldenMoments.set(moments);
    });
  }

  onEraFilter(era: string) {
    this.selectedEra.set(era);
  }

  getEraYearRange(era: Era): string {
    return `${era.startYear}–${era.endYear}`;
  }

  getSportStatusText(sport: SportBreakdown): string {
    if (sport.olympicStatus === 'discontinued') {
      return 'Historical archive · discontinued';
    }
    const athleteLabel = sport.uniqueAthletes === 1 ? 'athlete' : 'athletes';
    const participationLabel = sport.participationCount === 1 ? 'participation' : 'participations';
    return `${sport.uniqueAthletes} ${athleteLabel} · ${sport.participationCount} ${participationLabel}`;
  }

  getSportLifecycleBadge(sport: SportBreakdown): string | null {
    if (sport.olympicStatus === 'discontinued') return 'Discontinued';
    if (sport.olympicStatus === 'new_in_la28') return 'LA28 New';
    return null;
  }

  private buildSportsBreakdown(participations: OlympicParticipation[]): SportBreakdown[] {
    type SportAccumulator = SportBreakdown & {
      athleteIds: Set<string>;
      countedMedals: Set<string>;
    };

    const sportsById = this.sportsById();
    const breakdown = new Map<string, SportAccumulator>();

    participations.forEach(participation => {
      const sportResolution = this.resolveSportsForParticipation(participation, sportsById);
      if (!sportResolution) return;
      const canonicalSport = sportResolution.canonical;
      const sportKey = canonicalSport.id || canonicalSport.slug;
      if (!sportKey) return;

      if (!breakdown.has(sportKey)) {
        breakdown.set(sportKey, {
          name: canonicalSport.name,
          slug: canonicalSport.slug,
          pictogramUrl: canonicalSport.pictogramUrl,
          olympicStatus: canonicalSport.olympicStatus,
          participationCount: 0,
          uniqueAthletes: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
          total: 0,
          athleteIds: new Set<string>(),
          countedMedals: new Set<string>(),
        });
      }

      const row = breakdown.get(sportKey)!;
      if (!row.pictogramUrl && canonicalSport.pictogramUrl) {
        row.pictogramUrl = canonicalSport.pictogramUrl;
      }
      if (!row.olympicStatus && canonicalSport.olympicStatus) {
        row.olympicStatus = canonicalSport.olympicStatus;
      }

      row.participationCount += 1;
      const athleteId = typeof participation.athlete === 'object' ? participation.athlete?.id : null;
      if (athleteId) {
        row.athleteIds.add(athleteId);
      }

      if (!(participation.result === 'gold' || participation.result === 'silver' || participation.result === 'bronze')) {
        return;
      }

      const medalKey = `${this.getMedalKey(participation)}|${sportKey}`;
      if (row.countedMedals.has(medalKey)) return;
      row.countedMedals.add(medalKey);

      if (participation.result === 'gold') row.gold += 1;
      else if (participation.result === 'silver') row.silver += 1;
      else if (participation.result === 'bronze') row.bronze += 1;
      row.total += 1;
    });

    return Array.from(breakdown.values())
      .map((sport) => ({
        name: sport.name,
        slug: sport.slug,
        pictogramUrl: sport.pictogramUrl,
        olympicStatus: sport.olympicStatus,
        participationCount: sport.participationCount,
        uniqueAthletes: sport.athleteIds.size,
        gold: sport.gold,
        silver: sport.silver,
        bronze: sport.bronze,
        total: sport.total,
      }))
      .sort((a, b) => {
        const tierDiff = this.getSportTier(a) - this.getSportTier(b);
        if (tierDiff !== 0) return tierDiff;
        if (b.gold !== a.gold) return b.gold - a.gold;
        if (b.silver !== a.silver) return b.silver - a.silver;
        if (b.bronze !== a.bronze) return b.bronze - a.bronze;
        if (b.total !== a.total) return b.total - a.total;
        if (b.participationCount !== a.participationCount) return b.participationCount - a.participationCount;
        return a.name.localeCompare(b.name);
      });
  }

  private getSportTier(sport: SportBreakdown): number {
    if (sport.gold > 0) return 0;
    if (sport.silver > 0) return 1;
    if (sport.bronze > 0) return 2;
    return 3;
  }

  private getOutcomeEventKey(participation: OlympicParticipation): string {
    const editionId = participation.edition?.id || participation.edition?.name || '';
    const eventId = typeof participation.event === 'object'
      ? (participation.event?.id || participation.event?.name || '')
      : '';
    return `${editionId}|${eventId}`;
  }

  private getMedalKey(participation: OlympicParticipation): string {
    return `${this.getOutcomeEventKey(participation)}|${participation.result || ''}`;
  }

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private countUniqueMedals(type: 'gold' | 'silver' | 'bronze'): number {
    const counted = new Set<string>();
    let count = 0;

    this.filteredParticipations().forEach(p => {
      if (p.result !== type) return;
      const key = `${p.edition?.name || ''}-${p.event?.name || ''}-${type}`;
      if (!counted.has(key)) {
        counted.add(key);
        count++;
      }
    });

    return count;
  }

  private resolveSportsForParticipation(
    participation: OlympicParticipation,
    sportsById: Map<string, Sport>,
  ): {
    canonical: {
      id: string;
      name: string;
      slug: string;
      pictogramUrl: string | null;
      olympicStatus: SportLifecycle | null;
    };
    discipline: { id: string; name: string; slug: string; pictogramUrl: string | null };
  } | null {
    if (typeof participation.event !== 'object' || !participation.event?.sport || typeof participation.event.sport !== 'object') {
      return null;
    }

    const eventSportRaw = participation.event.sport as Sport;
    if (!eventSportRaw?.id || !eventSportRaw?.name) {
      return null;
    }

    const eventSport = sportsById.get(eventSportRaw.id) || eventSportRaw;
    const parentFromParticipation = typeof eventSportRaw.parentSport === 'object' ? eventSportRaw.parentSport as Sport : null;
    const parentId = this.getParentSportId(eventSport, sportsById) || parentFromParticipation?.id || null;
    const canonicalId = parentId || eventSport.id;
    const canonicalSport = sportsById.get(canonicalId) || parentFromParticipation || null;

    const canonicalName = canonicalSport?.name || eventSport.name;
    const canonicalSlug = canonicalSport?.slug || eventSport.slug || this.toSlug(canonicalName);

    return {
      canonical: {
        id: canonicalId,
        name: canonicalName,
        slug: canonicalSlug,
        olympicStatus: this.resolveSportLifecycle(canonicalSport || eventSport),
        pictogramUrl:
          this.payload.getSportPictogramUrl({
            sport: canonicalSport || eventSport,
            sportSlug: canonicalSlug,
            sportName: canonicalName,
            parentSport: parentFromParticipation,
            includePlaceholderFallback: false,
          }) || null,
      },
      discipline: {
        id: eventSport.id,
        name: eventSport.name,
        slug: eventSport.slug || this.toSlug(eventSport.name),
        pictogramUrl:
          this.payload.getSportPictogramUrl({
            sport: eventSport,
            includePlaceholderFallback: false,
          }) || null,
      },
    };
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

  private getParentSportId(sport: Sport | null, sportsById: Map<string, Sport>): string | null {
    if (!sport) return null;

    const rawParent = (sport as unknown as { parentSport?: unknown }).parentSport;
    const directParentId = this.extractParentSportId(rawParent);
    if (directParentId) return directParentId;

    const catalogSport = sport.id ? sportsById.get(sport.id) || null : null;
    if (!catalogSport) return null;
    return this.extractParentSportId((catalogSport as unknown as { parentSport?: unknown }).parentSport);
  }

  private extractParentSportId(rawParent: unknown): string | null {
    if (typeof rawParent === 'string') return rawParent;
    if (typeof rawParent === 'object' && rawParent && 'id' in (rawParent as Record<string, unknown>)) {
      const parentId = (rawParent as Record<string, unknown>).id;
      return typeof parentId === 'string' ? parentId : null;
    }
    return null;
  }

  getSportFallbackIcon(sport: string): string {
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
      'Artistic Gymnastics': '🤸',
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
      'Diving': '🏊',
      'Cycling': '🚴',
      'Canoe': '🛶',
      'Triathlon': '🏃',
    };
    // Also try partial match
    const lowerSport = sport.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lowerSport.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerSport)) {
        return icon;
      }
    }
    return icons[sport] || '🏅';
  }
}
