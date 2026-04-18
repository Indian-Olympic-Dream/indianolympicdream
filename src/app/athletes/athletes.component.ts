import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ContenderUnit as PayloadContenderUnit,
  PayloadService,
  Sport,
} from '../services/payload.service';
import {
  IndiaTier,
  INDIA_TIER_LABELS,
  INDIA_TIER_TRACK_LABELS,
  normalizeLegacyContenderTier,
  resolveDefaultIndiaTier,
} from '../models/india-tier';

type AthleteTab = 'medal_hopeful' | 'outside_chance' | 'qualification_watch' | 'retired';
type ContenderType = 'individual' | 'pair' | 'team' | 'event_team';
type ContenderGender = 'male' | 'female' | 'mixed';
type RetiredCategory = 'team' | 'individual' | 'medalists';

interface AthleteRow {
  id: string;
  name: string;
  country: string;
  photoUrl: string | null;
  sports: string[];
  sportsDisplay: string;
  events: string[];
  eventsDisplay: string;
  sportPictograms: Record<string, string>;
  sportMedalCounts: Record<string, number>;
  editionIds: string[];
  editions: string[];
  editionYears: number[];
  firstEditionYear: number | null;
  lastEditionYear: number | null;
  editionsDisplay: string;
  participationCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  medalCount: number;
  isActive: boolean | null;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface SportToolbarOption {
  value: string;
  label: string;
  count: number;
  pictogram: string | null;
  pictograms?: string[];
  showLabel?: boolean;
  fallbackIcon?: string;
}

interface RetiredSportStat {
  name: string;
  count: number;
}

interface ContenderCard {
  id: string;
  name: string;
  tier: IndiaTier;
  type: ContenderType;
  sport: string;
  imageUrl: string | null;
  events: string[];
  gender?: ContenderGender;
  athleteNames: string[];
  priority: number;
  source: 'cms';
}

@Component({
  selector: 'app-athletes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './athletes.component.html',
  styleUrls: ['./athletes.component.scss'],
})
export class AthletesComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private payload = inject(PayloadService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private applyingQueryParams = false;
  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private retiredRequestSub: Subscription | null = null;
  private retiredRequestToken = 0;
  private readonly retiredPageSize = 36;
  private readonly retiredTeamSportLabels = ['Hockey', 'Basketball', 'Football'];
  private readonly retiredTeamSports = new Set(this.retiredTeamSportLabels.map((sport) => sport.toLowerCase()));

  loading = signal(true);
  errorMessage = signal<string | null>(null);
  retiredLoading = signal(false);
  retiredLoaded = signal(false);
  retiredError = signal<string | null>(null);
  retiredPage = signal(1);
  retiredHasNextPage = signal(false);
  retiredTotalDocs = signal(0);
  retiredCategoryCounts = signal<{ team: number; individual: number; medalists: number }>({
    team: 0,
    individual: 0,
    medalists: 0,
  });
  retiredSportsByCategory = signal<{
    team: RetiredSportStat[];
    individual: RetiredSportStat[];
    medalists: RetiredSportStat[];
  }>({
    team: [],
    individual: [],
    medalists: [],
  });
  retiredTabCount = signal(0);

  retiredDocs = signal<AthleteRow[]>([]);
  contenderUnits = signal<PayloadContenderUnit[]>([]);
  failedContenderImages = signal<Set<string>>(new Set());
  failedRetiredPhotos = signal<Set<string>>(new Set());
  allSportsCatalog = signal<Sport[]>([]);
  cmsContenderUnits = computed<PayloadContenderUnit[]>(() => this.contenderUnits());
  selectedTab = signal<AthleteTab>('medal_hopeful');
  selectedSport = signal<string>('all');
  searchQuery = signal<string>('');

  retiredCategorySports = computed(() =>
    this.retiredSportsByCategory(),
  );

  selectedRetiredCategory = computed<RetiredCategory | null>(() =>
    this.parseRetiredFilter(this.selectedSport()).category,
  );

  visibleRetiredSports = computed<RetiredSportStat[]>(() => {
    const selectedCategory = this.selectedRetiredCategory();
    if (!selectedCategory) return [];

    return this.getRetiredSportsForCategory(selectedCategory);
  });

  cmsMedalHopefulUnits = computed(() =>
    this.buildContenderCardsFromCms(this.contenderUnits(), 'medal_hopeful'),
  );
  cmsOutsideChanceUnits = computed(() =>
    this.buildContenderCardsFromCms(this.contenderUnits(), 'outside_chance'),
  );
  cmsQualificationWatchUnits = computed(() =>
    this.buildContenderCardsFromCms(this.contenderUnits(), 'qualification_watch'),
  );

  medalHopefulUnits = computed(() => this.cmsMedalHopefulUnits());
  outsideChanceUnits = computed(() => this.cmsOutsideChanceUnits());
  qualificationWatchUnits = computed(() => this.cmsQualificationWatchUnits());

  displayedRetiredAthletes = computed(() => this.retiredDocs());

  canLoadMoreRetired = computed(() =>
    this.retiredHasNextPage(),
  );

  displayedContenderUnits = computed(() => {
    const selectedTab = this.selectedTab();
    const sport = this.selectedSport();
    const query = this.searchQuery().trim().toLowerCase();

    const pool = this.getContenderPoolForTab(selectedTab);

    return pool.filter((unit) => {
      const matchesSport = sport === 'all' || unit.sport === sport;
      if (!matchesSport) return false;

      if (!query) return true;
      const searchable = [
        unit.name,
        unit.sport,
        ...unit.events,
        ...unit.athleteNames,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  });

  currentSportOptions = computed<FilterOption[]>(() => {
    const selectedTab = this.selectedTab();
    if (selectedTab === 'retired') {
      return this.buildRetiredSportCategoryOptionsFromCounts(this.retiredCategoryCounts());
    }
    const units = this.getContenderPoolForTab(selectedTab);
    return this.buildSportOptionsFromUnits(units);
  });

  sportPictogramByName = computed(() => {
    const pictogramMap = new Map<string, string>();
    this.cmsContenderUnits().forEach((unit) => {
      if (!unit?.sport) return;
      const sportName = unit.sport.parentSport?.name || unit.sport.name;
      const pictogramUrl = this.payload.getSportPictogramUrl({
        sport: unit.sport,
        includePlaceholderFallback: false,
      });
      if (sportName && pictogramUrl && !pictogramMap.has(sportName)) {
        pictogramMap.set(sportName, pictogramUrl);
      }
    });

    this.retiredDocs().forEach((row) => {
      row.sports.forEach((sportName) => {
        const url = row.sportPictograms[sportName];
        if (url && !pictogramMap.has(sportName)) {
          pictogramMap.set(sportName, url);
        }
      });
    });

    // Third source: full sports catalog (ensures all sports have pictograms even if not in contender/retired data)
    this.allSportsCatalog().forEach((sport) => {
      const name = sport.parentSport?.name || sport.name;
      if (name && !pictogramMap.has(name)) {
        const url = this.payload.getSportPictogramUrl({
          sport,
          includePlaceholderFallback: false,
        });
        if (url) {
          pictogramMap.set(name, url);
        }
      }
    });

    return pictogramMap;
  });

  sportToolbarOptions = computed<SportToolbarOption[]>(() =>
    {
      const options = this.currentSportOptions();
      const pictogramMap = this.sportPictogramByName();
      const selectedTab = this.selectedTab();

      const allOption: SportToolbarOption = {
        value: 'all',
        label: 'All',
        count: selectedTab === 'retired'
          ? this.retiredTabCount()
          : this.getContenderPoolForTab(selectedTab).length,
        pictogram: null,
        showLabel: true,
        fallbackIcon: 'apps',
      };

      if (selectedTab !== 'retired') {
        return [allOption, ...options.map((option) => ({
          value: option.value,
          label: option.label,
          count: option.count,
          pictogram: pictogramMap.get(option.value) || null,
        }))];
      }

      const categoryPictograms = this.buildRetiredCategoryPictograms(this.retiredCategorySports(), pictogramMap);

      return [allOption, ...options.map((option) => {
        if (option.value === 'team' || option.value === 'individual' || option.value === 'medalists') {
          const pictograms =
            option.value === 'team'
              ? categoryPictograms.team
              : option.value === 'individual'
                ? categoryPictograms.individual
                : categoryPictograms.medalists;
          return {
            value: option.value,
            label: option.label,
            count: option.count,
            pictogram: pictograms[0] || null,
            pictograms,
            showLabel: true,
            fallbackIcon:
              option.value === 'team'
                ? 'groups_3'
                : option.value === 'individual'
                  ? 'person'
                  : 'workspace_premium',
          };
        }

        return {
          value: option.value,
          label: option.label,
          count: option.count,
          pictogram: pictogramMap.get(option.value) || null,
        };
      })];
    },
  );

  trackByAthleteId = (_: number, row: AthleteRow): string => row.id;
  trackBySportOption = (_: number, option: SportToolbarOption): string => option.value;
  trackByRetiredSport = (_: number, sport: RetiredSportStat): string => sport.name;
  trackByContenderId = (_: number, unit: ContenderCard): string => unit.id;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchDebounceHandle) {
        clearTimeout(this.searchDebounceHandle);
        this.searchDebounceHandle = null;
      }
      this.retiredRequestSub?.unsubscribe();
      this.retiredRequestSub = null;
    });
  }

  getInitials(value: string, maxChars = 2): string {
    const clean = value.trim();
    if (!clean) return 'IO';
    return clean
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, maxChars)
      .join('');
  }

  isContenderImageVisible(unit: ContenderCard): boolean {
    if (!unit.imageUrl) return false;
    return !this.failedContenderImages().has(unit.id);
  }

  markContenderImageFailed(unitId: string): void {
    if (!unitId) return;
    this.failedContenderImages.update((current) => {
      if (current.has(unitId)) return current;
      const next = new Set(current);
      next.add(unitId);
      return next;
    });
  }

  shouldShowRetiredPhoto(row: AthleteRow): boolean {
    if (!row.photoUrl) return false;
    return !this.failedRetiredPhotos().has(row.id);
  }

  markRetiredPhotoFailed(athleteId: string): void {
    if (!athleteId) return;
    this.failedRetiredPhotos.update((current) => {
      if (current.has(athleteId)) return current;
      const next = new Set(current);
      next.add(athleteId);
      return next;
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.applyingQueryParams = true;
        this.searchQuery.set(params.get('search') || '');
        this.selectedSport.set(params.get('sport') || 'all');
        this.selectedTab.set(this.parseTab(params.get('tab'), params.get('status')));
        this.applyingQueryParams = false;
        if (this.selectedTab() === 'retired') {
          this.loadRetiredData({ page: 1, append: false });
        }
        this.ensureSelectedSportIsAvailable();
      });

    this.loadInitialData();
  }

  setSportFilter(value: string): void {
    const normalized = value || 'all';
    this.selectedSport.set(this.selectedSport() === normalized ? 'all' : normalized);
    this.updateQueryParams();
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value || '');
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => {
      this.searchDebounceHandle = null;
      this.updateQueryParams();
    }, 220);
  }

  setTab(tab: AthleteTab): void {
    this.selectedTab.set(tab);
    if (tab === 'retired') {
      this.ensureRetiredDataLoaded();
    }
    this.ensureSelectedSportIsAvailable();
    this.updateQueryParams();
  }

  loadMoreRetired(): void {
    if (this.retiredLoading() || !this.retiredHasNextPage()) return;
    this.loadRetiredData({ page: this.retiredPage() + 1, append: true });
  }

  getTabCount(tab: AthleteTab): number {
    if (tab === 'medal_hopeful') {
      return this.medalHopefulUnits().length;
    }
    if (tab === 'outside_chance') {
      return this.outsideChanceUnits().length;
    }
    if (tab === 'qualification_watch') {
      return this.qualificationWatchUnits().length;
    }
    const count = this.retiredTabCount();
    return count > 0 ? count : this.retiredTotalDocs();
  }

  getTrackChipLabel(unit: ContenderCard): string {
    return INDIA_TIER_TRACK_LABELS[unit.tier as Exclude<IndiaTier, 'history_only'>] || INDIA_TIER_LABELS[unit.tier];
  }

  formatContenderType(type: ContenderType): string {
    if (type === 'event_team') return 'Event Team';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  formatContenderGender(gender?: ContenderGender): string {
    if (!gender) return 'Open';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }

  getContenderGenderIcon(gender?: ContenderGender): string {
    if (gender === 'male') return 'man';
    if (gender === 'female') return 'woman';
    if (gender === 'mixed') return 'diversity_3';
    return 'person';
  }

  getSportOptionFallbackIcon(option: SportToolbarOption): string {
    return option.fallbackIcon || 'sports';
  }

  isSportOptionActive(option: SportToolbarOption): boolean {
    const selectedSport = this.selectedSport();

    if (option.value === 'all') {
      return selectedSport === 'all';
    }

    if (this.selectedTab() !== 'retired') {
      return selectedSport === option.value;
    }

    return this.parseRetiredFilter(selectedSport).category === option.value;
  }

  getRetiredSportFilterValue(sportName: string): string {
    const category = this.selectedRetiredCategory();
    if (!category) return sportName;
    return `${category}::${sportName}`;
  }

  isRetiredSportActive(sportName: string): boolean {
    return this.parseRetiredFilter(this.selectedSport()).sport === sportName;
  }

  getCareerSpan(row: AthleteRow): string {
    const first = row.firstEditionYear;
    const last = row.lastEditionYear;
    if (!first && !last) return 'Unknown era';
    if (!first) return `${last}`;
    if (!last) return `${first}`;
    if (first === last) return `${first}`;
    return `${first} - ${last}`;
  }

  getRetiredMedalSummary(row: AthleteRow): string {
    if (row.medalCount === 0) return 'No medals';
    return `🥇 ${row.goldCount}  🥈 ${row.silverCount}  🥉 ${row.bronzeCount}`;
  }

  getContenderDescriptor(unit: ContenderCard): string {
    if (unit.events.length) return this.formatList(unit.events, 2);
    return unit.type === 'team' || unit.type === 'event_team' ? 'Team Unit' : 'Individual Unit';
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      contenders: this.payload.getContenderUnits({
        activeOnly: true,
        limit: 400,
      }).pipe(catchError(() => of({ docs: [], totalDocs: 0 }))),
      retiredCount: this.payload.getRetiredAthletesFeed({
        limit: 1,
        page: 1,
      }).pipe(catchError(() => of({
        docs: [],
        totalDocs: 0,
        totalPages: 0,
        page: 1,
        hasNextPage: false,
        totalRetired: 0,
        facets: {
          categories: { team: 0, individual: 0, medalists: 0 },
          sportsByCategory: { team: [], individual: [], medalists: [] },
        },
      }))),
      sportsCatalog: this.payload.getSports().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ contenders, retiredCount, sportsCatalog }) => {
        this.contenderUnits.set(contenders.docs);
        this.allSportsCatalog.set(sportsCatalog);
        this.retiredTabCount.set(retiredCount.totalRetired || retiredCount.totalDocs || 0);
        this.ensureSelectedSportIsAvailable();
        if (this.selectedTab() === 'retired') {
          this.ensureRetiredDataLoaded();
        }
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load athletes right now. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private ensureRetiredDataLoaded(): void {
    if (this.retiredLoaded()) return;
    this.loadRetiredData({ page: 1, append: false });
  }

  private loadRetiredData(options: { page: number; append: boolean }): void {
    if (options.append && this.retiredLoading()) return;
    if (!options.append) {
      this.retiredRequestSub?.unsubscribe();
      this.retiredRequestSub = null;
      this.failedRetiredPhotos.set(new Set());
    }

    const requestToken = ++this.retiredRequestToken;
    this.retiredLoading.set(true);
    if (!options.append) {
      this.retiredError.set(null);
    }

    this.retiredRequestSub = this.payload.getRetiredAthletesFeed({
      page: options.page,
      limit: this.retiredPageSize,
      search: this.searchQuery().trim(),
      sportFilter: this.selectedSport(),
    }).subscribe({
      next: (result) => {
        if (requestToken !== this.retiredRequestToken) return;
        const nextDocs = result.docs.map((row) => ({
          ...row,
          isActive: false as const,
        }));

        if (options.append) {
          const dedupedById = new Map<string, AthleteRow>();
          [...this.retiredDocs(), ...nextDocs].forEach((row) => {
            dedupedById.set(row.id, row);
          });
          this.retiredDocs.set(Array.from(dedupedById.values()));
        } else {
          this.retiredDocs.set(nextDocs);
        }

        this.retiredPage.set(result.page);
        this.retiredHasNextPage.set(result.hasNextPage);
        this.retiredTotalDocs.set(result.totalDocs);
        this.retiredCategoryCounts.set(result.facets.categories);
        this.retiredSportsByCategory.set(result.facets.sportsByCategory);
        this.retiredTabCount.set(result.totalRetired || this.retiredTabCount());
        this.retiredLoaded.set(true);
        this.ensureSelectedSportIsAvailable();
        this.retiredLoading.set(false);
      },
      error: () => {
        if (requestToken !== this.retiredRequestToken) return;
        this.retiredError.set('Unable to load retired athletes right now. Please try again.');
        this.retiredLoading.set(false);
      },
      complete: () => {
        if (requestToken !== this.retiredRequestToken) return;
        this.retiredRequestSub = null;
      },
    });
  }

  private buildRetiredSportCategoryOptionsFromCounts(counts: {
    team: number;
    individual: number;
    medalists: number;
  }): FilterOption[] {
    return [
      { value: 'team', label: 'Team', count: counts.team || 0 },
      { value: 'individual', label: 'Individual', count: counts.individual || 0 },
      { value: 'medalists', label: 'Medalists', count: counts.medalists || 0 },
    ].filter((option) => option.count > 0);
  }

  private buildRetiredCategoryPictograms(
    categories: { team: RetiredSportStat[]; individual: RetiredSportStat[]; medalists: RetiredSportStat[] },
    pictogramMap: Map<string, string>,
  ): { team: string[]; individual: string[]; medalists: string[] } {
    return {
      team: this.takeDistinctPictograms(categories.team.map((sport) => sport.name), pictogramMap, 3),
      individual: this.takeDistinctPictograms(categories.individual.map((sport) => sport.name), pictogramMap, 3),
      medalists: this.takeDistinctPictograms(categories.medalists.map((sport) => sport.name), pictogramMap, 3),
    };
  }

  private takeDistinctPictograms(
    sports: string[],
    pictogramMap: Map<string, string>,
    limit: number,
  ): string[] {
    const result: string[] = [];
    for (const sportName of sports) {
      const url = pictogramMap.get(sportName);
      if (!url || result.includes(url)) continue;
      result.push(url);
      if (result.length >= limit) break;
    }
    return result;
  }

  private getRetiredSportsForCategory(category: RetiredCategory): RetiredSportStat[] {
    const categories = this.retiredCategorySports();
    if (category === 'team') return categories.team;
    if (category === 'individual') return categories.individual;
    return categories.medalists;
  }

  private getContenderPoolForTab(tab: AthleteTab): ContenderCard[] {
    if (tab === 'medal_hopeful') return this.medalHopefulUnits();
    if (tab === 'outside_chance') return this.outsideChanceUnits();
    if (tab === 'qualification_watch') return this.qualificationWatchUnits();
    return [];
  }

  private buildSportOptionsFromUnits(units: ContenderCard[]): FilterOption[] {
    const counts = new Map<string, number>();
    units.forEach((unit) => {
      counts.set(unit.sport, (counts.get(unit.sport) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sportName, count]) => ({ value: sportName, label: sportName, count }));
  }

  private buildContenderCardsFromCms(
    units: PayloadContenderUnit[],
    tier: IndiaTier,
  ): ContenderCard[] {
    return units
      .filter((unit) => unit?.isActive !== false)
      .filter((unit) => this.resolveContenderTier(unit) === tier)
      .map((unit) => {
        const type = this.parseContenderType(unit.type);
        const heroImage = this.payload.getMediaUrl(unit.heroImage);
        const roster = (unit.athletes || []).map((athlete) => athlete.fullName).filter((name) => !!name);
        const rosterImage = (unit.athletes || [])
          .map((athlete) => this.payload.getMediaUrl(athlete.photo))
          .find((url) => !!url) || null;
        const eventNameSet = new Set<string>(
          (unit.events || [])
            .map((event) => event?.name)
            .filter((name): name is string => Boolean(name)),
        );
        const eventNames = Array.from(eventNameSet);

        return {
          id: unit.id,
          name: unit.displayName || 'Unknown',
          tier,
          type,
          sport: unit.sport?.parentSport?.name || unit.sport?.name || 'Unknown',
          imageUrl: type === 'individual' ? (heroImage || rosterImage) : (heroImage || null),
          events: eventNames,
          gender: this.parseContenderGender(unit.gender),
          athleteNames: roster,
          priority: unit.priority || 999,
          source: 'cms' as const,
        };
      })
      .sort((a, b) => (a.priority - b.priority) || a.name.localeCompare(b.name));
  }

  private resolveContenderTier(unit: PayloadContenderUnit): IndiaTier | null {
    const directTier = unit?.indiaTier || null;
    if (directTier) return directTier;

    const parentSport = unit?.sport?.parentSport || null;
    const sportTier = parentSport?.indiaTier || unit?.sport?.indiaTier || null;
    if (sportTier) return sportTier;

    const defaultSportTier = resolveDefaultIndiaTier({
      slug: parentSport?.slug || unit?.sport?.slug || '',
      name: parentSport?.name || unit?.sport?.name || '',
    });
    if (defaultSportTier) return defaultSportTier;

    return normalizeLegacyContenderTier(unit?.status);
  }

  private parseContenderType(type: string | undefined): ContenderType {
    if (type === 'pair' || type === 'team' || type === 'event_team') return type;
    return 'individual';
  }

  private parseContenderGender(gender: string | undefined): ContenderGender | undefined {
    if (gender === 'male' || gender === 'female' || gender === 'mixed') return gender;
    return undefined;
  }

  private formatList(values: string[], maxItems: number): string {
    if (!values.length) return '-';
    if (values.length <= maxItems) return values.join(', ');
    const remaining = values.length - maxItems;
    return `${values.slice(0, maxItems).join(', ')} +${remaining}`;
  }

  private parseRetiredFilter(filter: string): { category: RetiredCategory | null; sport: string | null } {
    const raw = (filter || 'all').trim();
    if (!raw || raw.toLowerCase() === 'all') {
      return { category: null, sport: null };
    }

    const [maybeCategory, ...sportParts] = raw.split('::');
    const normalizedCategory = maybeCategory.trim().toLowerCase();
    const sportFromParts = sportParts.join('::').trim();

    if (normalizedCategory === 'team' || normalizedCategory === 'individual' || normalizedCategory === 'medalists') {
      return {
        category: normalizedCategory,
        sport: sportFromParts || null,
      };
    }

    const normalizedSport = raw.toLowerCase();
    if (this.retiredTeamSports.has(normalizedSport)) {
      return { category: 'team', sport: raw };
    }

    return { category: 'individual', sport: raw };
  }

  private ensureSelectedSportIsAvailable(): void {
    if (this.loading()) return;

    const selectedSport = this.selectedSport();
    if (selectedSport === 'all') return;

    if (this.selectedTab() !== 'retired') {
      const hasSelectedSport = this.currentSportOptions().some((option) => option.value === selectedSport);
      if (!hasSelectedSport) {
        this.selectedSport.set('all');
      }
      return;
    }

    if (!this.retiredLoaded()) return;

    const { category, sport } = this.parseRetiredFilter(selectedSport);
    if (!category) {
      this.selectedSport.set('all');
      return;
    }

    const hasCategory = this.currentSportOptions().some((option) => option.value === category);
    if (!hasCategory) {
      this.selectedSport.set('all');
      return;
    }

    if (!sport) return;

    const hasSport = this.getRetiredSportsForCategory(category).some((item) => item.name === sport);
    if (!hasSport) {
      this.selectedSport.set(category);
    }
  }

  private updateQueryParams(): void {
    if (this.applyingQueryParams) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.searchQuery().trim() ? this.searchQuery().trim() : null,
        sport: this.selectedSport() === 'all' ? null : this.selectedSport(),
        tab: this.selectedTab() === 'medal_hopeful' ? null : this.selectedTab(),
        medalists: null,
        retiredSort: null,
        status: null,
        edition: null,
        active: null,
        sort: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseTab(tabValue: string | null, statusValue: string | null): AthleteTab {
    if (
      tabValue === 'medal_hopeful' ||
      tabValue === 'outside_chance' ||
      tabValue === 'qualification_watch' ||
      tabValue === 'retired'
    ) {
      return tabValue;
    }
    if (tabValue === 'qualification_only') {
      return 'qualification_watch';
    }
    if (statusValue === 'inactive') {
      return 'retired';
    }
    return 'medal_hopeful';
  }

}
