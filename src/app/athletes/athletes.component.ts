import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Athlete, Edition, OlympicParticipation, PayloadService, Sport } from '../services/payload.service';

type ActiveFilter = 'all' | 'active' | 'inactive';

interface AthleteRow {
  id: string;
  name: string;
  country: string;
  sports: string[];
  sportsDisplay: string;
  sportPictograms: Record<string, string>;
  editionIds: string[];
  editions: string[];
  editionsDisplay: string;
  participationCount: number;
  isActive: boolean | null;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface AthleteAggregate {
  fallbackName: string;
  sportNames: Set<string>;
  sportPictograms: Map<string, string>;
  editionIds: Set<string>;
  participationCount: number;
}

@Component({
  selector: 'app-athletes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  templateUrl: './athletes.component.html',
  styleUrls: ['./athletes.component.scss'],
})
export class AthletesComponent implements OnInit {
  private payload = inject(PayloadService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private applyingQueryParams = false;

  loading = signal(true);
  errorMessage = signal<string | null>(null);

  athleteRows = signal<AthleteRow[]>([]);
  sportOptions = signal<FilterOption[]>([]);
  editionOptions = signal<FilterOption[]>([]);

  selectedSport = signal<string>('all');
  selectedEdition = signal<string>('all');
  selectedActive = signal<ActiveFilter>('all');
  selectedTab = signal<'active' | 'all'>('active');
  searchQuery = signal<string>('');
  filtersOpen = signal<boolean>(false);

  hasActiveFilters = computed(() =>
    this.selectedSport() !== 'all' ||
    this.selectedEdition() !== 'all' ||
    this.selectedActive() !== 'all' ||
    this.searchQuery().length > 0,
  );

  filteredRows = computed(() => {
    let rows = this.athleteRows();

    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      rows = rows.filter((row) => row.name.toLowerCase().includes(query));
    }

    const sport = this.selectedSport();
    if (sport !== 'all') {
      rows = rows.filter((row) => row.sports.includes(sport));
    }

    const edition = this.selectedEdition();
    if (edition !== 'all') {
      rows = rows.filter((row) => row.editionIds.includes(edition));
    }

    const activeFilter = this.selectedActive();
    if (activeFilter === 'active') {
      rows = rows.filter((row) => row.isActive === true);
    } else if (activeFilter === 'inactive') {
      rows = rows.filter((row) => row.isActive === false);
    }

    return [...rows].sort((a, b) => {
      const nameDiff = a.name.localeCompare(b.name);
      if (nameDiff !== 0) return nameDiff;
      return a.id.localeCompare(b.id);
    });
  });

  activeAthletes = computed(() => {
    return this.filteredRows().filter((r) => r.isActive === true);
  });

  allFilteredAthletes = computed(() => {
    return this.filteredRows();
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.applyingQueryParams = true;
      this.selectedSport.set(params.get('sport') || 'all');
      this.selectedEdition.set(params.get('edition') || 'all');
      this.selectedActive.set(this.parseActiveFilter(params.get('active')));
      this.applyingQueryParams = false;
    });

    this.loadData();
  }

  setSportFilter(value: string): void {
    this.selectedSport.set(value || 'all');
    this.updateQueryParams();
  }

  setEditionFilter(value: string): void {
    this.selectedEdition.set(value || 'all');
    this.updateQueryParams();
  }

  setActiveFilter(value: ActiveFilter): void {
    this.selectedActive.set(value || 'all');
    this.updateQueryParams();
  }

  resetFilters(): void {
    this.selectedSport.set('all');
    this.selectedEdition.set('all');
    this.selectedActive.set('all');
    this.searchQuery.set('');
    this.updateQueryParams();
  }

  trackByAthleteId = (_: number, row: AthleteRow): string => row.id;

  private loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      athletes: this.loadAllAthletes(250),
      participations: this.payload.getParticipations({ limit: 10000 }),
      sports: this.payload.getSports(),
      editions: this.payload.getEditions({ limit: 120 }),
    }).subscribe({
      next: ({ athletes, participations, sports, editions }) => {
        const { rows, editionLabelById, editionYearById } = this.buildAthleteRows(
          athletes,
          participations,
          sports,
          editions,
        );

        this.athleteRows.set(rows);
        this.sportOptions.set(this.buildSportOptions(rows));
        this.editionOptions.set(this.buildEditionOptions(rows, editionLabelById, editionYearById));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load athletes right now. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private loadAllAthletes(limit: number): Observable<Athlete[]> {
    return this.payload.getAthletes({ limit, page: 1 }).pipe(
      switchMap((firstPage) => {
        if (!firstPage.totalPages || firstPage.totalPages <= 1) {
          return of(firstPage.docs);
        }

        const pageRequests = Array.from({ length: firstPage.totalPages - 1 }, (_, index) => {
          const page = index + 2;
          return this.payload.getAthletes({ limit, page });
        });

        return forkJoin(pageRequests).pipe(
          map((otherPages) => [
            ...firstPage.docs,
            ...otherPages.flatMap((pageResult) => pageResult.docs),
          ]),
        );
      }),
      map((docs) => {
        const seen = new Set<string>();
        return docs.filter((athlete) => {
          if (!athlete?.id || seen.has(athlete.id)) return false;
          seen.add(athlete.id);
          return true;
        });
      }),
    );
  }

  private buildAthleteRows(
    athletes: Athlete[],
    participations: OlympicParticipation[],
    sportsCatalog: Sport[],
    editions: Edition[],
  ): {
    rows: AthleteRow[];
    editionLabelById: Map<string, string>;
    editionYearById: Map<string, number>;
  } {
    const sportsById = new Map<string, Sport>(sportsCatalog.map((sport) => [sport.id, sport]));

    const editionLabelById = new Map<string, string>();
    const editionYearById = new Map<string, number>();

    editions.forEach((edition) => {
      if (!edition?.id) return;
      const year = edition.year || 0;
      const label = edition.city && year ? `${edition.city} ${year}` : edition.name || String(year || 'Unknown');
      editionLabelById.set(edition.id, label);
      editionYearById.set(edition.id, year);
    });

    const aggregates = new Map<string, AthleteAggregate>();

    participations.forEach((participation) => {
      const athleteId = this.getAthleteId(participation);
      if (!athleteId) return;

      if (!aggregates.has(athleteId)) {
        aggregates.set(athleteId, {
          fallbackName: this.getAthleteName(participation),
          sportNames: new Set<string>(),
          sportPictograms: new Map<string, string>(),
          editionIds: new Set<string>(),
          participationCount: 0,
        });
      }

      const aggregate = aggregates.get(athleteId)!;
      aggregate.participationCount += 1;

      const editionId = participation.edition?.id || null;
      if (editionId) {
        aggregate.editionIds.add(editionId);
        if (!editionLabelById.has(editionId)) {
          const year = participation.edition?.year || 0;
          const label = participation.edition?.name || String(year || 'Unknown');
          editionLabelById.set(editionId, label);
          editionYearById.set(editionId, year);
        }
      }

      if (typeof participation.event === 'object' && participation.event?.sport) {
        const rawSport = participation.event.sport;
        const canonicalSportName = this.getCanonicalSportName(rawSport, sportsById);
        if (canonicalSportName) {
          aggregate.sportNames.add(canonicalSportName);
          if (!aggregate.sportPictograms.has(canonicalSportName)) {
            const pictogramUrl = this.getCanonicalSportPictogram(rawSport, sportsById);
            if (pictogramUrl) {
              aggregate.sportPictograms.set(canonicalSportName, pictogramUrl);
            }
          }
        }
      }
    });

    const athleteIds = new Set<string>();
    const rows: AthleteRow[] = athletes.map((athlete) => {
      athleteIds.add(athlete.id);
      const aggregate = aggregates.get(athlete.id);

      const sportNames = new Set<string>();
      const sportPictograms: Record<string, string> = {};

      (athlete.sports || []).forEach((sport) => {
        const canonicalSportName = this.getCanonicalSportName(sport, sportsById);
        if (canonicalSportName) {
          sportNames.add(canonicalSportName);
          if (!sportPictograms[canonicalSportName]) {
            const url = this.getCanonicalSportPictogram(sport, sportsById);
            if (url) sportPictograms[canonicalSportName] = url;
          }
        }
      });
      aggregate?.sportNames.forEach((sportName) => sportNames.add(sportName));
      aggregate?.sportPictograms.forEach((url, name) => {
        if (!sportPictograms[name]) sportPictograms[name] = url;
      });

      const editionEntries = Array.from(aggregate?.editionIds || []).map((editionId) => ({
        id: editionId,
        label: editionLabelById.get(editionId) || editionId,
        year: editionYearById.get(editionId) || 0,
      }));

      editionEntries.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.label.localeCompare(b.label);
      });

      const sports = Array.from(sportNames).sort((a, b) => a.localeCompare(b));
      const editionIds = editionEntries.map((entry) => entry.id);
      const editionLabels = editionEntries.map((entry) => entry.label);

      return {
        id: athlete.id,
        name: athlete.fullName || 'Unknown',
        country: athlete.country || 'India',
        sports,
        sportsDisplay: this.formatList(sports, 3),
        sportPictograms,
        editionIds,
        editions: editionLabels,
        editionsDisplay: this.formatList(editionLabels, 4),
        participationCount: aggregate?.participationCount || 0,
        isActive: typeof athlete.isActive === 'boolean' ? athlete.isActive : null,
      };
    });

    aggregates.forEach((aggregate, athleteId) => {
      if (athleteIds.has(athleteId)) return;

      const sports = Array.from(aggregate.sportNames).sort((a, b) => a.localeCompare(b));
      const editionEntries = Array.from(aggregate.editionIds).map((editionId) => ({
        id: editionId,
        label: editionLabelById.get(editionId) || editionId,
        year: editionYearById.get(editionId) || 0,
      }));

      editionEntries.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.label.localeCompare(b.label);
      });

      const editionIds = editionEntries.map((entry) => entry.id);
      const editionLabels = editionEntries.map((entry) => entry.label);

      // Merge pictogram URLs from aggregate
      const pictograms: Record<string, string> = {};
      aggregate.sportPictograms.forEach((url, name) => { pictograms[name] = url; });

      rows.push({
        id: athleteId,
        name: aggregate.fallbackName || 'Unknown',
        country: 'India',
        sports,
        sportsDisplay: this.formatList(sports, 3),
        sportPictograms: pictograms,
        editionIds,
        editions: editionLabels,
        editionsDisplay: this.formatList(editionLabels, 4),
        participationCount: aggregate.participationCount,
        isActive: null,
      });
    });

    rows.sort((a, b) => {
      const nameDiff = a.name.localeCompare(b.name);
      if (nameDiff !== 0) return nameDiff;
      return a.id.localeCompare(b.id);
    });

    return { rows, editionLabelById, editionYearById };
  }

  private buildSportOptions(rows: AthleteRow[]): FilterOption[] {
    const counts = new Map<string, number>();

    rows.forEach((row) => {
      row.sports.forEach((sportName) => {
        counts.set(sportName, (counts.get(sportName) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sportName, count]) => ({ value: sportName, label: sportName, count }));
  }

  private buildEditionOptions(
    rows: AthleteRow[],
    editionLabelById: Map<string, string>,
    editionYearById: Map<string, number>,
  ): FilterOption[] {
    const counts = new Map<string, number>();

    rows.forEach((row) => {
      row.editionIds.forEach((editionId) => {
        counts.set(editionId, (counts.get(editionId) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => {
        const yearDiff = (editionYearById.get(b[0]) || 0) - (editionYearById.get(a[0]) || 0);
        if (yearDiff !== 0) return yearDiff;
        return (editionLabelById.get(a[0]) || a[0]).localeCompare(editionLabelById.get(b[0]) || b[0]);
      })
      .map(([editionId, count]) => ({
        value: editionId,
        label: editionLabelById.get(editionId) || editionId,
        count,
      }));
  }

  private formatList(values: string[], maxItems: number): string {
    if (!values.length) return '—';
    if (values.length <= maxItems) return values.join(', ');
    const remaining = values.length - maxItems;
    return `${values.slice(0, maxItems).join(', ')} +${remaining}`;
  }

  private getCanonicalSportName(rawSport: Sport | null | undefined, sportsById: Map<string, Sport>): string | null {
    if (!rawSport) return null;

    const sourceSport = rawSport.id ? sportsById.get(rawSport.id) || rawSport : rawSport;
    const parentId = this.getParentSportId(sourceSport, sportsById);

    if (parentId) {
      const parentSport = sportsById.get(parentId);
      if (parentSport?.name) return parentSport.name;
    }

    return sourceSport.name || null;
  }

  private getCanonicalSportPictogram(rawSport: Sport | null | undefined, sportsById: Map<string, Sport>): string | null {
    if (!rawSport) return null;

    const sourceSport = rawSport.id ? sportsById.get(rawSport.id) || rawSport : rawSport;

    // Try the sport itself first
    let url = this.payload.getMediaUrl(sourceSport.pictogram);
    if (url) return url;

    // Try the parent sport
    const parentId = this.getParentSportId(sourceSport, sportsById);
    if (parentId) {
      const parentSport = sportsById.get(parentId);
      if (parentSport) {
        url = this.payload.getMediaUrl(parentSport.pictogram);
        if (url) return url;
      }
    }

    return null;
  }

  private getParentSportId(sport: Sport | null, sportsById: Map<string, Sport>): string | null {
    if (!sport) return null;

    const directParentId = this.extractParentSportId((sport as unknown as { parentSport?: unknown }).parentSport);
    if (directParentId) return directParentId;

    const catalogSport = sport.id ? sportsById.get(sport.id) || null : null;
    if (!catalogSport) return null;

    return this.extractParentSportId((catalogSport as unknown as { parentSport?: unknown }).parentSport);
  }

  private extractParentSportId(rawParent: unknown): string | null {
    if (typeof rawParent === 'string') return rawParent;
    if (typeof rawParent === 'object' && rawParent && 'id' in (rawParent as Record<string, unknown>)) {
      const id = (rawParent as Record<string, unknown>).id;
      return typeof id === 'string' ? id : null;
    }
    return null;
  }

  private getAthleteId(participation: OlympicParticipation): string | null {
    if (typeof participation.athlete === 'object' && participation.athlete?.id) {
      return participation.athlete.id;
    }
    return null;
  }

  private getAthleteName(participation: OlympicParticipation): string {
    if (typeof participation.athlete === 'object' && participation.athlete?.fullName) {
      return participation.athlete.fullName;
    }
    return 'Unknown';
  }

  private updateQueryParams(): void {
    if (this.applyingQueryParams) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sport: this.selectedSport() === 'all' ? null : this.selectedSport(),
        edition: this.selectedEdition() === 'all' ? null : this.selectedEdition(),
        active: this.selectedActive() === 'all' ? null : this.selectedActive(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseActiveFilter(value: string | null): ActiveFilter {
    if (value === 'active' || value === 'inactive') return value;
    return 'all';
  }
}
