import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { PayloadService, OlympicParticipation, Edition, GoldenMoment } from '../services/payload.service';

interface SportBreakdown {
  name: string;
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
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatChipsModule,
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
  selectedEra = signal<string>('all');
  totalAthletes = signal(0);

  // Era definitions with year ranges shown
  eras: Era[] = [
    { label: 'Pre-Independence', shortLabel: 'Pre-Ind.', startYear: 1900, endYear: 1947 },
    { label: 'Golden Age', shortLabel: 'Golden Age', startYear: 1948, endYear: 1972 },
    { label: 'Transition Era', shortLabel: 'Transition', startYear: 1976, endYear: 1992 },
    { label: 'Modern Era', shortLabel: 'Modern', startYear: 1996, endYear: 2024 },
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
          athleteCount: editionAthletes.size
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
    const breakdown: Record<string, SportBreakdown> = {};
    const counted = new Set<string>();

    this.participations().forEach(p => {
      const sportName = this.getSportName(p);
      if (!sportName) return;

      if (!breakdown[sportName]) {
        breakdown[sportName] = { name: sportName, gold: 0, silver: 0, bronze: 0, total: 0 };
      }

      const key = `${p.edition?.name || ''}-${p.event?.name || ''}-${p.result}`;
      if (!counted.has(key)) {
        counted.add(key);
        if (p.result === 'gold') breakdown[sportName].gold++;
        else if (p.result === 'silver') breakdown[sportName].silver++;
        else if (p.result === 'bronze') breakdown[sportName].bronze++;
        breakdown[sportName].total++;
      }
    });

    return Object.values(breakdown).sort((a, b) => b.total - a.total);
  });

  // Filtered sports breakdown (by era)
  sportsBreakdown = computed<SportBreakdown[]>(() => {
    const breakdown: Record<string, SportBreakdown> = {};
    const counted = new Set<string>();

    this.filteredParticipations().forEach(p => {
      const sportName = this.getSportName(p);
      if (!sportName) return;

      if (!breakdown[sportName]) {
        breakdown[sportName] = { name: sportName, gold: 0, silver: 0, bronze: 0, total: 0 };
      }

      const key = `${p.edition?.name || ''}-${p.event?.name || ''}-${p.result}`;
      if (!counted.has(key)) {
        counted.add(key);
        if (p.result === 'gold') breakdown[sportName].gold++;
        else if (p.result === 'silver') breakdown[sportName].silver++;
        else if (p.result === 'bronze') breakdown[sportName].bronze++;
        breakdown[sportName].total++;
      }
    });

    return Object.values(breakdown).sort((a, b) => b.total - a.total);
  });

  // Dynamic athlete count for current era
  filteredAthleteCount = computed(() => {
    const athletes = new Set<string>();
    this.filteredParticipationCounts().forEach(p => {
      if (p.athleteId) athletes.add(p.athleteId);
    });
    return athletes.size;
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // Load medal participations
    this.payload.getMedalists().subscribe(participations => {
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

    // Load athlete count
    this.payload.getAthletes({ limit: 1 }).subscribe(response => {
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

  private getSportName(p: OlympicParticipation): string {
    if (typeof p.event === 'object' && p.event?.sport) {
      return typeof p.event.sport === 'object' ? p.event.sport.name : '';
    }
    return '';
  }
}
