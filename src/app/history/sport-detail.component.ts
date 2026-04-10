import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, QueryList, ViewChild, ViewChildren, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
    PayloadService,
    Sport,
    OlympicParticipation,
    Edition,
    Athlete,
    Event,
    GoldenMoment,
    CalendarEvent,
    CalendarEventNavigation,
    QualificationPathway,
    ContenderUnit,
    LegacyEditionOverview,
    SportLegacySummary,
} from '../services/payload.service';
import { INDIA_TIER_LABELS, IndiaTier, resolveDefaultIndiaTier, resolveDefaultSportLifecycle } from '../models/india-tier';
import { catchError, combineLatest, forkJoin, of } from 'rxjs';

interface AthleteEntry {
    name: string;
    events: string[];
    result: string;
    gender: 'men' | 'women' | 'mixed';
}

interface DisciplineGroup {
    id: string;
    name: string;
    slug: string;
    pictogramUrl: string | null;
    athletes: AthleteEntry[];
    menAthletes: AthleteEntry[];
    womenAthletes: AthleteEntry[];
    mixedAthletes: AthleteEntry[];
    medalCount: { gold: number; silver: number; bronze: number };
}

const UNMAPPED_DISCIPLINE_PREFIX = '__unmapped__';
const LA28_EDITION_SLUG = 'la-2028';
const LA28_CYCLE = 'LA 2028';
const MAX_LA28_EVENT_CARDS = 4;
const HIDDEN_SPORT_SWITCHER_SLUGS = new Set(['art-competition', 'art-competitions', 'cricket', 'squash']);
const PRIORITY_SPORT_SWITCHER_SLUGS = [
    'hockey',
    'athletics',
    'shooting',
    'wrestling',
    'badminton',
    'weightlifting',
    'archery',
    'boxing',
    'tennis',
    'table-tennis',
    'cricket',
    'squash',
] as const;
const FULL_CURRENT_COVERAGE_SLUGS = new Set([
    'hockey',
    'athletics',
    'shooting',
    'wrestling',
    'badminton',
    'weightlifting',
    'archery',
    'boxing',
    'tennis',
    'table-tennis',
]);
const SPORT_SWITCH_TIER_ORDER: IndiaTier[] = [
    'medal_hopeful',
    'outside_chance',
    'qualification_watch',
    'history_only',
];

type CurrentCalendarGroup = 'live' | 'today' | 'thisWeek' | 'thisMonth' | 'later' | 'completed';
type CurrentCalendarFilter = 'all' | 'live' | 'core' | 'watch' | 'buildUp';
type CurrentContentView = 'calendar' | 'athletes';

interface EditionGroup {
    edition: Edition;
    athletes: AthleteEntry[];
    menAthletes: AthleteEntry[];
    womenAthletes: AthleteEntry[];
    mixedAthletes: AthleteEntry[];
    medalCount: { gold: number; silver: number; bronze: number };
    disciplines: DisciplineGroup[];
}

interface DisciplineSummary {
    id: string;
    name: string;
    slug: string;
    pictogramUrl: string | null;
    athleteEntries: number;
    medalCount: { gold: number; silver: number; bronze: number; total: number };
}

interface La28TimelineItem {
    label: string;
    dateLabel: string;
    note?: string;
    sortValue: number;
}

interface CurrentCheckpointItem {
    eyebrow?: string;
    label: string;
    dateLabel: string;
    sortValue: number;
    note?: string;
}

interface CurrentSnapshotStat {
    label: string;
    value: string;
    note?: string;
}

interface CurrentPhaseSummary {
    label: string;
    note: string;
}

interface CurrentCalendarCard {
    event: CalendarEvent;
    timeGroup: CurrentCalendarGroup;
    relativeLabel: string;
    dateLabel: string;
    sortValue: number;
    locationLabel: string;
    categoryLabel: string;
    typeLabel: string;
    importanceClass: string;
    pictogramUrl: string | null;
    disciplineId: string;
    navigation: CalendarEventNavigation;
}

interface CurrentDisciplineSummary {
    id: string;
    name: string;
    slug: string;
    pictogramUrl: string | null;
    pathwayCount: number;
    eventCount: number;
    contenderCount: number;
    athleteCount: number;
    totalSignals: number;
}

interface CurrentDisciplineNavItem {
    id: string;
    name: string;
    slug: string;
    pictogramUrl: string | null;
    isOverview?: boolean;
}

interface HeroAthletePreview {
    id: string;
    fullName: string;
    photoUrl: string | null;
    meta?: string;
    initial: string;
}

interface HeroDisciplineFilterItem {
    id: string;
    name: string;
    pictogramUrl: string | null;
    isOverview?: boolean;
}

interface SportSwitchItem {
    id: string;
    name: string;
    slug: string;
    pictogramUrl: string | null;
    tier: IndiaTier | null;
}

interface SportSwitchGroup {
    tier: IndiaTier;
    label: string;
    items: SportSwitchItem[];
}

type SportDetailView = 'current' | 'legacy';

@Component({
    selector: 'app-sport-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './sport-detail.component.html',
    styleUrls: ['./sport-detail.component.scss']
})
export class SportDetailComponent implements OnInit, AfterViewInit {
    private payload = inject(PayloadService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private destroyRef = inject(DestroyRef);
    private platformId = inject(PLATFORM_ID);
    private sportsById = signal<Map<string, Sport>>(new Map());
    private lastLoadedSportSlug: string | null = null;
    private resolvedCurrentHeroImageUrl = signal<string | null>(null);
    private resolvedLegacyHeroImageUrl = signal<string | null>(null);
    private currentHeroImageLoadFailed = signal(false);
    private legacyHeroImageLoadFailed = signal(false);
    @ViewChild('sportSwitchBar') private sportSwitchBar?: ElementRef<HTMLDivElement>;
    @ViewChildren('sportSwitchLink') private sportSwitchLinks!: QueryList<ElementRef<HTMLAnchorElement>>;

    sport = signal<Sport | null>(null);
    legacySummary = signal<SportLegacySummary | null>(null);
    legacyEditionSummaries = signal<LegacyEditionOverview[]>([]);
    legacyEditionParticipations = signal<Map<string, OlympicParticipation[]>>(new Map());
    participations = computed<OlympicParticipation[]>(() =>
        Array.from(this.legacyEditionParticipations().values()).flat()
    );
    goldenMoments = signal<GoldenMoment[]>([]);
    la28QualificationPathways = signal<QualificationPathway[]>([]);
    la28CalendarEvents = signal<CalendarEvent[]>([]);
    la28ContenderUnits = signal<ContenderUnit[]>([]);
    activeAthletes = signal<Athlete[]>([]);
    loading = signal(true);
    legacyLoading = signal(false);
    legacyLoaded = signal(false);
    legacyEditionCount = signal<number | null>(null);
    legacyError = signal<string | null>(null);
    legacyEditionLoadingIds = signal<Set<string>>(new Set());
    legacyEditionErrors = signal<Map<string, string>>(new Map());

    // Edition filter - when coming from an Edition page
    activeView = signal<SportDetailView>('current');
    focusedEditionSlug = signal<string | null>(null);
    showFullHistory = signal(false);
    selectedDisciplineId = signal<string>('all');
    expandedEditionIds = signal<Set<string>>(new Set());
    currentCalendarFilter = signal<CurrentCalendarFilter>('all');
    currentCompletedExpanded = signal(false);
    currentContentView = signal<CurrentContentView>('calendar');
    sportSwitchExpanded = signal(false);

    isLegacyOnlySport = computed(() => this.resolveSportLifecycle(this.sport()) === 'discontinued');
    usesUnifiedCurrentLayout = computed(() =>
        !this.isLegacyOnlySport() && !this.supportsFullCurrentCoverage()
    );
    showCurrentHero = computed(() =>
        !this.isLegacyOnlySport() && (this.activeView() === 'current' || this.usesUnifiedCurrentLayout())
    );
    showLegacyArchiveSections = computed(() =>
        this.activeView() === 'legacy' || this.usesUnifiedCurrentLayout()
    );

    hasSubDisciplineView = computed(() => {
        const selectedSport = this.sport();
        if (!selectedSport) return false;
        if (this.getChildDisciplinesForSport(selectedSport.id).length > 0) return true;

        const disciplineIds = new Set<string>();
        this.legacyEditionSummaries().forEach(group => {
            group.disciplines.forEach(discipline => disciplineIds.add(discipline.id));
        });

        if (disciplineIds.size === 0) return false;
        if (disciplineIds.size > 1) return true;
        return !disciplineIds.has(selectedSport.id);
    });

    displayedDisciplineSummary = computed<DisciplineSummary[]>(() => {
        const summary = new Map<string, DisciplineSummary>();
        const selectedSport = this.sport();

        if (selectedSport) {
            this.getChildDisciplinesForSport(selectedSport.id).forEach(discipline => {
                summary.set(discipline.id, {
                    id: discipline.id,
                    name: discipline.name,
                    slug: discipline.slug,
                    pictogramUrl:
                        this.payload.getSportPictogramUrl({
                            sport: discipline,
                            includePlaceholderFallback: false,
                        }) || null,
                    athleteEntries: 0,
                    medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
                });
            });
        }

        this.baseDisplayedEditions().forEach(group => {
            group.disciplines.forEach(discipline => {
                if (!summary.has(discipline.id)) {
                    summary.set(discipline.id, {
                        id: discipline.id,
                        name: discipline.name,
                        slug: discipline.slug,
                        pictogramUrl: discipline.pictogramUrl || null,
                        athleteEntries: 0,
                        medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
                    });
                }

                const row = summary.get(discipline.id)!;
                if (!row.pictogramUrl && discipline.pictogramUrl) {
                    row.pictogramUrl = discipline.pictogramUrl;
                }
                row.athleteEntries += discipline.participationCount;
                row.medalCount.gold += discipline.medalCount.gold;
                row.medalCount.silver += discipline.medalCount.silver;
                row.medalCount.bronze += discipline.medalCount.bronze;
                row.medalCount.total += discipline.medalCount.total;
            });
        });

        return Array.from(summary.values()).sort((a, b) => {
            if (b.medalCount.total !== a.medalCount.total) return b.medalCount.total - a.medalCount.total;
            if (b.athleteEntries !== a.athleteEntries) return b.athleteEntries - a.athleteEntries;
            return a.name.localeCompare(b.name);
        });
    });

    activeDisciplineId = computed(() => {
        const selected = this.selectedDisciplineId();
        if (selected === 'all') return 'all';

        const existsInCurrent = this.currentDisciplineNavItems().some(discipline => discipline.id === selected);
        const existsInLegacy = this.displayedDisciplineSummary().some(discipline => discipline.id === selected);
        const existsInUnified = this.unifiedHeroDisciplineItems().some(discipline => discipline.id === selected);

        const exists = this.usesUnifiedCurrentLayout()
            ? existsInUnified
            : this.activeView() === 'legacy'
                ? existsInLegacy
                : existsInCurrent;
        return exists ? selected : 'all';
    });

    // Computed: Group participations by Edition
    editionGroups = computed<EditionGroup[]>(() => {
        const groups = new Map<string, EditionGroup>();
        const countedMedals = new Map<string, Set<string>>(); // editionId -> Set of "event-result"
        const disciplineIndexes = new Map<string, Map<string, DisciplineGroup>>();
        const countedDisciplineMedals = new Map<string, Set<string>>(); // editionId-disciplineId -> Set of "event-result"

        this.participations().forEach(p => {
            const edition = p.edition as Edition;
            if (!edition?.id) return;

            if (!groups.has(edition.id)) {
                groups.set(edition.id, {
                    edition,
                    athletes: [],
                    menAthletes: [],
                    womenAthletes: [],
                    mixedAthletes: [],
                    medalCount: { gold: 0, silver: 0, bronze: 0 },
                    disciplines: [],
                });
                countedMedals.set(edition.id, new Set());
                disciplineIndexes.set(edition.id, new Map());
            }

            const group = groups.get(edition.id)!;
            const athleteName = this.getAthleteName(p);
            const eventName = this.getEventName(p);
            const result = p.result;
            const gender = this.getGenderFromEvent(eventName);
            const discipline = this.resolveDisciplineForParticipation(p);
            const editionDisciplines = disciplineIndexes.get(edition.id)!;

            if (!editionDisciplines.has(discipline.id)) {
                const disciplineGroup: DisciplineGroup = {
                    id: discipline.id,
                    name: discipline.name,
                    slug: discipline.slug,
                    pictogramUrl: discipline.pictogramUrl,
                    athletes: [],
                    menAthletes: [],
                    womenAthletes: [],
                    mixedAthletes: [],
                    medalCount: { gold: 0, silver: 0, bronze: 0 },
                };
                editionDisciplines.set(discipline.id, disciplineGroup);
                group.disciplines.push(disciplineGroup);
            }

            const disciplineGroup = editionDisciplines.get(discipline.id)!;
            if (!disciplineGroup.pictogramUrl && discipline.pictogramUrl) {
                disciplineGroup.pictogramUrl = discipline.pictogramUrl;
            }

            // Add athlete to group
            let athleteEntry = group.athletes.find(a => a.name === athleteName);
            if (!athleteEntry) {
                athleteEntry = { name: athleteName, events: [], result: result || 'participated', gender };
                group.athletes.push(athleteEntry);

                // Add to gender specific list
                if (gender === 'men') group.menAthletes.push(athleteEntry);
                else if (gender === 'women') group.womenAthletes.push(athleteEntry);
                else group.mixedAthletes.push(athleteEntry);
            }
            athleteEntry.events.push(eventName);
            athleteEntry.result = this.getBetterResult(athleteEntry.result, result || 'participated');

            // Add athlete to discipline group
            let disciplineAthlete = disciplineGroup.athletes.find(a => a.name === athleteName);
            if (!disciplineAthlete) {
                disciplineAthlete = { name: athleteName, events: [], result: result || 'participated', gender };
                disciplineGroup.athletes.push(disciplineAthlete);

                if (gender === 'men') disciplineGroup.menAthletes.push(disciplineAthlete);
                else if (gender === 'women') disciplineGroup.womenAthletes.push(disciplineAthlete);
                else disciplineGroup.mixedAthletes.push(disciplineAthlete);
            }
            disciplineAthlete.events.push(eventName);
            disciplineAthlete.result = this.getBetterResult(disciplineAthlete.result, result || 'participated');

            // Count medals — deduplicate by event+result (team sports = 1 medal per event)
            if (['gold', 'silver', 'bronze'].includes(result)) {
                const medalKey = `${eventName}-${result}`;
                const counted = countedMedals.get(edition.id)!;
                if (!counted.has(medalKey)) {
                    counted.add(medalKey);
                    if (result === 'gold') group.medalCount.gold++;
                    else if (result === 'silver') group.medalCount.silver++;
                    else if (result === 'bronze') group.medalCount.bronze++;
                }

                const disciplineCountedKey = `${edition.id}-${discipline.id}`;
                if (!countedDisciplineMedals.has(disciplineCountedKey)) {
                    countedDisciplineMedals.set(disciplineCountedKey, new Set());
                }
                const countedDiscipline = countedDisciplineMedals.get(disciplineCountedKey)!;
                if (!countedDiscipline.has(medalKey)) {
                    countedDiscipline.add(medalKey);
                    if (result === 'gold') disciplineGroup.medalCount.gold++;
                    else if (result === 'silver') disciplineGroup.medalCount.silver++;
                    else if (result === 'bronze') disciplineGroup.medalCount.bronze++;
                }
            }
        });

        groups.forEach(group => {
            group.disciplines.sort((a, b) => {
                const aTotal = a.medalCount.gold + a.medalCount.silver + a.medalCount.bronze;
                const bTotal = b.medalCount.gold + b.medalCount.silver + b.medalCount.bronze;
                if (bTotal !== aTotal) return bTotal - aTotal;
                if (b.athletes.length !== a.athletes.length) return b.athletes.length - a.athletes.length;
                return a.name.localeCompare(b.name);
            });
        });

        // Sort by year descending
        return Array.from(groups.values()).sort((a, b) => b.edition.year - a.edition.year);
    });

    // Computed: Editions to display (filtered or all)
    loadedEditionGroupsMap = computed(() => new Map(this.editionGroups().map(group => [group.edition.id, group])));

    baseDisplayedEditions = computed<LegacyEditionOverview[]>(() => {
        const all = this.legacyEditionSummaries();
        const focusedSlug = this.focusedEditionSlug();

        // Show all if no focus or user toggled full history
        if (!focusedSlug || this.showFullHistory()) {
            return all;
        }

        // Show only the focused edition
        return all.filter(g => g.edition.slug === focusedSlug);
    });

    displayedEditions = computed<LegacyEditionOverview[]>(() => {
        const filteredByEdition = this.baseDisplayedEditions();
        const selectedDiscipline = this.activeDisciplineId();
        if (selectedDiscipline === 'all' || !this.hasSubDisciplineView()) {
            return filteredByEdition;
        }
        return filteredByEdition.filter(group =>
            group.disciplines.some(discipline => discipline.id === selectedDiscipline && discipline.participationCount > 0)
        );
    });

    displayedParticipationsCount = computed(() =>
        this.countParticipationEntries(this.displayedEditions(), this.activeDisciplineId())
    );

    displayedAthletesCount = computed(() =>
        this.countUniqueSummaryAthletes(this.displayedEditions(), this.activeDisciplineId())
    );

    // Computed: Total stats (for displayed editions)
    totalMedals = computed(() => {
        const selectedDiscipline = this.activeDisciplineId();
        const filterByDiscipline = selectedDiscipline !== 'all' && this.hasSubDisciplineView();
        let gold = 0, silver = 0, bronze = 0;
        this.displayedEditions().forEach(g => {
            if (!filterByDiscipline) {
                gold += g.medalCount.gold;
                silver += g.medalCount.silver;
                bronze += g.medalCount.bronze;
                return;
            }

            const discipline = g.disciplines.find(d => d.id === selectedDiscipline);
            if (!discipline) return;
            gold += discipline.medalCount.gold;
            silver += discipline.medalCount.silver;
            bronze += discipline.medalCount.bronze;
        });
        return { gold, silver, bronze, total: gold + silver + bronze };
    });

    sportPictogramUrl = computed(() => {
        const sport = this.sport();
        if (!sport) return null;

        const directUrl = this.payload.getSportPictogramUrl({
            sport,
            includePlaceholderFallback: false,
        });
        if (directUrl) return directUrl;

        // Fallback: use first available child/linked event sport pictogram from loaded participations.
        for (const participation of this.participations()) {
            if (typeof participation.event !== 'object' || !participation.event?.sport || typeof participation.event.sport !== 'object') {
                continue;
            }
            const eventSport = participation.event.sport as Sport;
            const parentSport = typeof eventSport.parentSport === 'object' ? eventSport.parentSport as Sport : null;
            const matchesCurrentSport = eventSport.id === sport.id || parentSport?.id === sport.id;
            if (!matchesCurrentSport) continue;

            const eventSportUrl = this.payload.getSportPictogramUrl({
                sport: eventSport,
                parentSport,
                includePlaceholderFallback: false,
            });
            if (eventSportUrl) return eventSportUrl;
        }

        for (const edition of this.legacyEditionSummaries()) {
            const disciplineWithPictogram = edition.disciplines.find(discipline => !!discipline.pictogramUrl);
            if (disciplineWithPictogram?.pictogramUrl) {
                return disciplineWithPictogram.pictogramUrl;
            }
        }

        return null;
    });

    currentSportHeroImageUrl = computed(() => {
        if (this.currentHeroImageLoadFailed()) return null;
        return this.resolvedCurrentHeroImageUrl();
    });

    legacySportHeroImageUrl = computed(() => {
        if (this.legacyHeroImageLoadFailed()) return null;
        return this.resolvedLegacyHeroImageUrl();
    });

    private allSportSwitchItems = computed<SportSwitchItem[]>(() => {
        const catalog = Array.from(this.sportsById().values());
        return catalog
            .filter(item => {
                const parentId = this.getParentSportId(item);
                if (HIDDEN_SPORT_SWITCHER_SLUGS.has(item.slug)) {
                    return false;
                }

                return !parentId || parentId === item.id;
            })
            .map(item => ({
                id: item.id,
                name: item.name,
                slug: item.slug,
                pictogramUrl:
                    this.payload.getSportPictogramUrl({
                        sport: item,
                        includePlaceholderFallback: false,
                    }) || null,
                tier: this.resolveSportTier(item),
            }))
            .sort((a, b) => {
                const tierOrder =
                    this.getSportTierOrder(a.tier) - this.getSportTierOrder(b.tier);
                if (tierOrder !== 0) return tierOrder;
                return a.name.localeCompare(b.name);
            });
    });

    sportSwitchItems = computed<SportSwitchItem[]>(() => {
        const allItems = this.allSportSwitchItems();
        const bySlug = new Map(allItems.map(item => [item.slug, item]));
        const activeSlug = this.activeSportSwitchSlug();
        const selectedItems: SportSwitchItem[] = [];

        PRIORITY_SPORT_SWITCHER_SLUGS.forEach(slug => {
            const item = bySlug.get(slug);
            if (item) selectedItems.push(item);
        });

        if (activeSlug) {
            const activeItem = bySlug.get(activeSlug);
            if (activeItem && !selectedItems.some(item => item.slug === activeItem.slug)) {
                selectedItems.push(activeItem);
            }
        }

        return selectedItems;
    });

    hasOverflowSportSwitchItems = computed(() =>
        this.allSportSwitchItems().some(
            item => !this.sportSwitchItems().some(primary => primary.slug === item.slug)
        )
    );

    overflowSportSwitchGroups = computed<SportSwitchGroup[]>(() => {
        const primarySlugs = new Set(this.sportSwitchItems().map(item => item.slug));
        const overflowItems = this.allSportSwitchItems().filter(item => !primarySlugs.has(item.slug));

        return SPORT_SWITCH_TIER_ORDER
            .map(tier => ({
                tier,
                label: INDIA_TIER_LABELS[tier],
                items: overflowItems
                    .filter(item => (item.tier || 'history_only') === tier)
                    .sort((a, b) => a.name.localeCompare(b.name)),
            }))
            .filter(group => group.items.length > 0);
    });

    activeSportSwitchSlug = computed(() => {
        const selectedSport = this.resolveSportWithCatalog(this.sport());
        if (!selectedSport) return null;

        const parentId = this.getParentSportId(selectedSport);
        if (!parentId || parentId === selectedSport.id) {
            return selectedSport.slug;
        }

        return this.sportsById().get(parentId)?.slug || selectedSport.slug;
    });

    trackSportSwitchItem(_index: number, item: SportSwitchItem): string {
        return item.id;
    }

    trackSportSwitchGroup(_index: number, group: SportSwitchGroup): string {
        return group.tier;
    }

    trackHeroDisciplineItem(_index: number, item: HeroDisciplineFilterItem): string {
        return item.id;
    }

    currentDisciplineSummary = computed<CurrentDisciplineSummary[]>(() => {
        const selectedSport = this.sport();
        if (!selectedSport) return [];

        const childDisciplines = this.getChildDisciplinesForSport(selectedSport.id);
        if (childDisciplines.length === 0) return [];

        const summary = new Map<string, CurrentDisciplineSummary>(
            childDisciplines.map(discipline => [
                discipline.id,
                {
                    id: discipline.id,
                    name: discipline.name,
                    slug: discipline.slug,
                    pictogramUrl:
                        this.payload.getSportPictogramUrl({
                            sport: discipline,
                            parentSport: selectedSport,
                            includePlaceholderFallback: false,
                        }) || null,
                    pathwayCount: 0,
                    eventCount: 0,
                    contenderCount: 0,
                    athleteCount: 0,
                    totalSignals: 0,
                },
            ])
        );
        const athleteIdsByDiscipline = new Map<string, Set<string>>();

        const trackDiscipline = (rawSport: Sport | null | undefined, kind: 'pathway' | 'event' | 'contender') => {
            const resolvedSport = this.resolveSportWithCatalog(rawSport || null);
            if (!resolvedSport?.id) return;
            if (this.getParentSportId(resolvedSport) !== selectedSport.id) return;

            const row = summary.get(resolvedSport.id);
            if (!row) return;

            if (kind === 'pathway') row.pathwayCount += 1;
            if (kind === 'event') row.eventCount += 1;
            if (kind === 'contender') row.contenderCount += 1;
            row.totalSignals += 1;
        };

        const trackAthleteDiscipline = (rawSport: Sport | null | undefined, athleteId?: string | null) => {
            const resolvedSport = this.resolveSportWithCatalog(rawSport || null);
            if (!resolvedSport?.id) return;
            if (this.getParentSportId(resolvedSport) !== selectedSport.id) return;

            const row = summary.get(resolvedSport.id);
            if (!row) return;

            const disciplineAthletes = athleteIdsByDiscipline.get(resolvedSport.id) || new Set<string>();
            athleteIdsByDiscipline.set(resolvedSport.id, disciplineAthletes);
            const identity = athleteId || `${resolvedSport.id}-${disciplineAthletes.size}`;
            if (disciplineAthletes.has(identity)) return;

            disciplineAthletes.add(identity);
            row.athleteCount += 1;
            row.totalSignals += 1;
        };

        this.la28QualificationPathways().forEach(pathway => trackDiscipline(pathway.sport || null, 'pathway'));
        this.la28CalendarEvents().forEach(event => trackDiscipline(event.sport || null, 'event'));
        this.la28ContenderUnits().forEach(unit => trackDiscipline(unit.sport || null, 'contender'));
        this.activeAthletes().forEach(athlete =>
            (athlete.sports || []).forEach(rawSport => trackAthleteDiscipline(rawSport || null, athlete.id))
        );
        this.la28ContenderUnits().forEach(unit =>
            (unit.athletes || []).forEach(athlete => trackAthleteDiscipline(unit.sport || null, athlete?.id))
        );

        return Array.from(summary.values())
            .filter(row => row.totalSignals > 0)
            .sort((a, b) => {
                if (b.totalSignals !== a.totalSignals) return b.totalSignals - a.totalSignals;
                return a.name.localeCompare(b.name);
            });
    });

    hasCurrentDisciplineSummary = computed(() => this.currentDisciplineSummary().length > 0);

    currentDisciplineNavItems = computed<CurrentDisciplineNavItem[]>(() => {
        const selectedSport = this.sport();
        if (!selectedSport) return [];

        const childDisciplines = this.getChildDisciplinesForSport(selectedSport.id);
        if (childDisciplines.length === 0) return [];

        const summaryById = new Map(this.currentDisciplineSummary().map(row => [row.id, row]));
        const filteredChildDisciplines = childDisciplines.filter(discipline => {
            return summaryById.has(discipline.id);
        });

        if (filteredChildDisciplines.length === 0) return [];

        return [
            {
                id: 'all',
                name: selectedSport.name,
                slug: selectedSport.slug,
                pictogramUrl:
                    this.payload.getSportPictogramUrl({
                        sport: selectedSport,
                        includePlaceholderFallback: false,
                    }) || null,
                isOverview: true,
            },
            ...filteredChildDisciplines
                .map(discipline => {
                    return {
                        id: discipline.id,
                        name: discipline.name,
                        slug: discipline.slug,
                        pictogramUrl:
                            this.payload.getSportPictogramUrl({
                                sport: discipline,
                                parentSport: selectedSport,
                                includePlaceholderFallback: false,
                            }) || null,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name)),
        ];
    });

    currentHeroDisciplineItems = computed<HeroDisciplineFilterItem[]>(() =>
        this.currentDisciplineNavItems().map(item => ({
            id: item.id,
            name: item.isOverview ? 'All' : item.name,
            pictogramUrl: item.pictogramUrl,
            isOverview: item.isOverview,
        }))
    );

    legacyHeroDisciplineItems = computed<HeroDisciplineFilterItem[]>(() => {
        const selectedSport = this.sport();
        if (!selectedSport || !this.hasSubDisciplineView()) return [];
        const visibleDisciplines = this.displayedDisciplineSummary().filter(discipline => discipline.athleteEntries > 0);
        if (visibleDisciplines.length === 0) return [];

        return [
            {
                id: 'all',
                name: 'All',
                pictogramUrl: this.sportPictogramUrl(),
                isOverview: true,
            },
            ...visibleDisciplines.map(discipline => ({
                id: discipline.id,
                name: this.getDisciplineDisplayName(discipline.name),
                pictogramUrl: discipline.pictogramUrl,
            })),
        ];
    });

    unifiedHeroDisciplineItems = computed<HeroDisciplineFilterItem[]>(() => {
        const currentItems = this.currentHeroDisciplineItems();
        const legacyItems = this.legacyHeroDisciplineItems();
        if (legacyItems.length === 0) return currentItems;
        if (currentItems.length === 0) return legacyItems;

        const merged = new Map<string, HeroDisciplineFilterItem>();
        const addItem = (item: HeroDisciplineFilterItem) => {
            if (merged.has(item.id)) return;
            merged.set(item.id, item);
        };

        legacyItems.forEach(addItem);
        currentItems.forEach(addItem);

        return Array.from(merged.values());
    });

    heroDisciplineItems = computed<HeroDisciplineFilterItem[]>(() => {
        if (this.usesUnifiedCurrentLayout()) {
            return this.unifiedHeroDisciplineItems();
        }
        if (this.activeView() === 'current') {
            return this.currentHeroDisciplineItems();
        }
        return this.legacyHeroDisciplineItems();
    });

    hasHeroDisciplineFilters = computed(() => this.heroDisciplineItems().length > 1);

    baseRoadToLa28Athletes = computed(() => {
        const selectedSport = this.sport();
        if (!selectedSport) return [];

        const athleteMap = new Map<string, Athlete>();
        const addAthlete = (athlete: Athlete | null | undefined) => {
            if (!athlete?.id || !this.athleteBelongsToSport(athlete, selectedSport)) return;
            athleteMap.set(athlete.id, athlete);
        };

        this.activeAthletes().forEach(addAthlete);
        this.la28ContenderUnits().forEach(unit => (unit.athletes || []).forEach(addAthlete));

        return Array.from(athleteMap.values())
            .sort((a, b) => {
                const aRank = a.worldRanking ?? Number.MAX_SAFE_INTEGER;
                const bRank = b.worldRanking ?? Number.MAX_SAFE_INTEGER;
                if (aRank !== bRank) return aRank - bRank;
                return a.fullName.localeCompare(b.fullName);
            });
    });

    roadToLa28Athletes = computed(() => {
        const selectedSport = this.sport();
        const activeDisciplineId = this.activeDisciplineId();
        if (!selectedSport || activeDisciplineId === 'all' || !this.hasSubDisciplineView()) {
            return this.baseRoadToLa28Athletes();
        }

        return this.baseRoadToLa28Athletes().filter(athlete =>
            this.athleteMatchesDisciplineFilter(athlete, selectedSport, activeDisciplineId)
        );
    });

    filteredCurrentContenderUnits = computed(() => {
        const selectedSport = this.sport();
        const activeDisciplineId = this.activeDisciplineId();
        if (!selectedSport || activeDisciplineId === 'all' || !this.hasSubDisciplineView()) {
            return this.la28ContenderUnits();
        }

        return this.la28ContenderUnits().filter(unit =>
            this.unitMatchesDisciplineFilter(unit, selectedSport, activeDisciplineId)
        );
    });

    currentCalendarCards = computed<CurrentCalendarCard[]>(() =>
        [...this.la28CalendarEvents()]
            .map(event => this.toCurrentCalendarCard(event))
            .filter((card): card is CurrentCalendarCard => !!card)
            .sort((a, b) => {
                const groupOrder = this.getCurrentCalendarGroupOrder(a.timeGroup) - this.getCurrentCalendarGroupOrder(b.timeGroup);
                if (groupOrder !== 0) return groupOrder;
                if (a.timeGroup === 'completed' && b.timeGroup === 'completed') {
                    return b.sortValue - a.sortValue;
                }
                return a.sortValue - b.sortValue;
            })
    );

    supportsFullCurrentCoverage = computed(() => {
        const rootSlug = this.activeSportSwitchSlug() || this.sport()?.slug || '';
        return FULL_CURRENT_COVERAGE_SLUGS.has(rootSlug);
    });

    visibleCurrentCalendarCards = computed<CurrentCalendarCard[]>(() => {
        if (!this.supportsFullCurrentCoverage()) return [];

        const selectedSport = this.sport();
        const activeDisciplineId = this.activeDisciplineId();
        const cards = this.currentCalendarCards();

        if (!selectedSport || activeDisciplineId === 'all' || !this.hasSubDisciplineView()) {
            return cards;
        }

        return cards.filter(card => card.disciplineId === activeDisciplineId);
    }
    );

    currentCalendarFilterOptions = computed(() => ([
        { id: 'all' as const, label: 'All', count: this.visibleCurrentCalendarCards().length },
        {
            id: 'live' as const,
            label: 'Live',
            count: this.visibleCurrentCalendarCards().filter(card => card.timeGroup === 'live').length
        },
        {
            id: 'core' as const,
            label: 'Core',
            count: this.visibleCurrentCalendarCards().filter(card => this.matchesCurrentCalendarFilter(card, 'core')).length
        },
        {
            id: 'watch' as const,
            label: 'Watch',
            count: this.visibleCurrentCalendarCards().filter(card => this.matchesCurrentCalendarFilter(card, 'watch')).length
        },
        {
            id: 'buildUp' as const,
            label: 'Build-up',
            count: this.visibleCurrentCalendarCards().filter(card => this.matchesCurrentCalendarFilter(card, 'buildUp')).length
        },
    ].filter(option => option.id === 'all' || option.count > 0)));

    currentFilteredCalendarCards = computed(() => {
        const filter = this.currentCalendarFilter();
        const cards = this.visibleCurrentCalendarCards();

        return cards.filter(card =>
            card.timeGroup !== 'completed' &&
            this.matchesCurrentCalendarFilter(card, filter)
        );
    });

    currentLiveCards = computed(() => this.currentFilteredCalendarCards().filter(card => card.timeGroup === 'live'));
    currentTodayCards = computed(() => this.currentFilteredCalendarCards().filter(card => card.timeGroup === 'today'));
    currentThisWeekCards = computed(() => this.currentFilteredCalendarCards().filter(card => card.timeGroup === 'thisWeek'));
    currentThisMonthCards = computed(() => this.currentFilteredCalendarCards().filter(card => card.timeGroup === 'thisMonth'));
    currentLaterCards = computed(() => this.currentFilteredCalendarCards().filter(card => card.timeGroup === 'later'));
    currentCompletedCards = computed(() =>
        this.visibleCurrentCalendarCards().filter(card =>
            card.timeGroup === 'completed' &&
            this.matchesCurrentCalendarFilter(card, this.currentCalendarFilter())
        )
    );

    isCurrentCompletedExpanded = computed(() =>
        this.currentCompletedExpanded() ||
        (this.currentFilteredCalendarCards().length === 0 && this.currentCompletedCards().length > 0)
    );

    currentUpcomingCount = computed(() =>
        this.visibleCurrentCalendarCards().filter(card => card.timeGroup !== 'completed').length
    );

    hasCurrentCalendar = computed(() => this.visibleCurrentCalendarCards().length > 0);

    hasCurrentAthletes = computed(() => this.roadToLa28Athletes().length > 0);

    displayedCurrentContentView = computed<CurrentContentView>(() => {
        const preferred = this.currentContentView();

        if (preferred === 'athletes' && this.hasCurrentAthletes()) {
            return 'athletes';
        }

        if (this.hasCurrentCalendar()) {
            return 'calendar';
        }

        if (this.hasCurrentAthletes()) {
            return 'athletes';
        }

        return 'calendar';
    });

    nextCurrentEvent = computed<CurrentCalendarCard | null>(() => {
        const upcoming = this.visibleCurrentCalendarCards().filter(card => card.timeGroup !== 'completed');
        return upcoming[0] || null;
    });

    liveCurrentEvent = computed<CurrentCalendarCard | null>(() =>
        this.visibleCurrentCalendarCards().find(card => card.timeGroup === 'live') || null
    );

    nextUpcomingCurrentEvent = computed<CurrentCalendarCard | null>(() =>
        this.visibleCurrentCalendarCards().find(card =>
            card.timeGroup !== 'completed' && card.timeGroup !== 'live'
        ) || null
    );

    hasRoadToLa28Content = computed(() =>
        this.hasCurrentDisciplineSummary() ||
        this.hasCurrentCalendar() ||
        this.roadToLa28Athletes().length > 0 ||
        !!this.currentCycleContextNote()
    );

    primaryLa28Pathway = computed<QualificationPathway | null>(() => {
        const pathways = [...this.la28QualificationPathways()];
        pathways.sort((a, b) => {
            const aDeadline = this.toDate(a.qualificationDeadline)?.getTime() || Number.MAX_SAFE_INTEGER;
            const bDeadline = this.toDate(b.qualificationDeadline)?.getTime() || Number.MAX_SAFE_INTEGER;
            return aDeadline - bDeadline || a.title.localeCompare(b.title);
        });
        return pathways[0] || null;
    });

    la28IntroParagraphs = computed(() => this.extractRichTextParagraphs(this.primaryLa28Pathway()?.description));

    la28OfficialLinks = computed(() => {
        const pathway = this.primaryLa28Pathway();
        if (!pathway?.externalLinks?.length) return [];
        return pathway.externalLinks.filter(link => !!link?.url);
    });

    la28Timeline = computed<La28TimelineItem[]>(() => {
        const pathway = this.primaryLa28Pathway();
        if (!pathway?.qualifyingEvents?.length) return [];

        return pathway.qualifyingEvents
            .map((item): La28TimelineItem | null => {
                if (!item?.eventName) return null;

                return {
                    label: item.eventName,
                    dateLabel: this.formatDateRange(item.startDate, item.endDate),
                    note: item.location,
                    sortValue: this.toDate(item.startDate || item.endDate)?.getTime() || Number.MAX_SAFE_INTEGER,
                };
            })
            .filter((item): item is La28TimelineItem => !!item)
            .sort((a, b) => a.sortValue - b.sortValue);
    });

    la28UpcomingEvents = computed(() => {
        const events = [...this.la28CalendarEvents()];
        if (events.length === 0) return [];

        const today = this.startOfDay(new Date());
        const upcoming = events
            .filter(event => {
                const end = this.toDate(event.endDate || event.startDate);
                return !end || end >= today;
            })
            .sort((a, b) => {
                const aStart = this.toDate(a.startDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                const bStart = this.toDate(b.startDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                if (aStart !== bStart) return aStart - bStart;
                return this.getImportanceRank(a.importance) - this.getImportanceRank(b.importance);
            });

        if (upcoming.length > 0) {
            return upcoming.slice(0, MAX_LA28_EVENT_CARDS);
        }

        return events
            .sort((a, b) => {
                const aStart = this.toDate(a.startDate)?.getTime() || 0;
                const bStart = this.toDate(b.startDate)?.getTime() || 0;
                return bStart - aStart;
            })
            .slice(0, MAX_LA28_EVENT_CARDS);
    });

    la28UpcomingEventCount = computed(() => {
        const today = this.startOfDay(new Date());
        return this.la28CalendarEvents().filter(event => {
            const end = this.toDate(event.endDate || event.startDate);
            return !end || end >= today;
        }).length;
    });

    nextLa28Checkpoint = computed<CurrentCheckpointItem | null>(() => {
        const today = this.startOfDay(new Date()).getTime();
        const candidates: CurrentCheckpointItem[] = [];
        const seen = new Set<string>();

        this.la28UpcomingEvents().forEach(event => {
            const sortValue = this.toDate(event.startDate || event.endDate)?.getTime() || Number.MAX_SAFE_INTEGER;
            const item = {
                label: event.title,
                dateLabel: this.formatDateRange(event.startDate, event.endDate),
                sortValue,
            };
            const key = `${item.label}|${item.dateLabel}`;
            if (!seen.has(key)) {
                seen.add(key);
                candidates.push(item);
            }
        });

        this.la28Timeline().forEach(item => {
            const key = `${item.label}|${item.dateLabel}`;
            if (!seen.has(key)) {
                seen.add(key);
                candidates.push({
                    label: item.label,
                    dateLabel: item.dateLabel,
                    sortValue: item.sortValue,
                });
            }
        });

        if (candidates.length === 0) return null;

        return candidates.sort((a, b) => {
            const aPast = a.sortValue < today ? 1 : 0;
            const bPast = b.sortValue < today ? 1 : 0;
            if (aPast !== bPast) return aPast - bPast;
            return a.sortValue - b.sortValue;
        })[0];
    });

    nextProgrammeMilestone = computed<CurrentCheckpointItem | null>(() => {
        const today = this.startOfDay(new Date()).getTime();
        const timeline = this.la28Timeline();
        const futureTimelineItem = timeline.find(item => item.sortValue >= today);
        if (futureTimelineItem) return futureTimelineItem;
        if (timeline.length > 0) return timeline[timeline.length - 1];
        return this.nextLa28Checkpoint();
    });

    currentPhaseSummary = computed<CurrentPhaseSummary>(() => {
        const pathway = this.primaryLa28Pathway();
        const today = this.startOfDay(new Date());
        const deadline = this.toDate(pathway?.qualificationDeadline);
        const qualifyingDates = (pathway?.qualifyingEvents || [])
            .map(item => this.toDate(item.startDate || item.endDate))
            .filter((value): value is Date => !!value)
            .sort((a, b) => a.getTime() - b.getTime());

        const openingDate = qualifyingDates[0] || null;

        if (openingDate && today < openingDate) {
            return {
                label: 'Signal Year',
                note: `Official window opens ${this.formatSingleDate(openingDate.toISOString())}`,
            };
        }

        if (deadline && today > deadline) {
            return {
                label: 'Window Closed',
                note: `Closed ${this.formatSingleDate(deadline.toISOString())}`,
            };
        }

        if (deadline) {
            return {
                label: 'Qualification Live',
                note: `Closes ${this.formatSingleDate(deadline.toISOString())}`,
            };
        }

        if (this.la28UpcomingEventCount() > 0) {
            return {
                label: 'Active Cycle',
                note: `${this.la28UpcomingEventCount()} checkpoints on the calendar`,
            };
        }

        return {
            label: 'Context Building',
            note: 'Qualification milestones are still being added.',
        };
    });

    currentCycleContextNote = computed(() => {
        const pathway = this.primaryLa28Pathway();
        if (pathway?.currentCycleContext) return pathway.currentCycleContext;

        const sportName = this.sport()?.name || 'This sport';
        const nextCheckpoint = this.nextProgrammeMilestone();
        const phase = this.currentPhaseSummary();

        if (phase.label === 'Signal Year') {
            return nextCheckpoint
                ? `${sportName} is still in a build-up year. Results now matter more for form, pairings, and ranking position ahead of ${nextCheckpoint.label}.`
                : `${sportName} is still in an early build-up phase for LA28, so the biggest story right now is positioning rather than direct qualification.`;
        }

        if (phase.label === 'Qualification Live') {
            return nextCheckpoint
                ? `${sportName} is now in an active qualification phase, with ${nextCheckpoint.label} standing out as the next decisive checkpoint.`
                : `${sportName} is now in an active qualification phase, and each result can directly change the Olympic picture.`;
        }

        return phase.note;
    });

    currentHeroDescription = computed(() => {
        if (this.loading()) {
            return 'Loading the live sport front page...';
        }

        const sportName = this.sport()?.name || 'This sport';
        const upcomingCount = this.currentUpcomingCount();
        const athleteCount = this.roadToLa28Athletes().length;
        const liveCount = this.visibleCurrentCalendarCards().filter(card => card.timeGroup === 'live').length;

        if (!this.supportsFullCurrentCoverage()) {
            if (athleteCount > 0) {
                return `Active athletes and current names in ${sportName}.`;
            }

            return `${sportName}'s current view.`;
        }

        if (liveCount > 0) {
            return `Live events, active names and what comes next in ${sportName}.`;
        }

        if (upcomingCount > 0 && athleteCount > 0) {
            return `Live calendar and active athletes.`;
        }

        if (upcomingCount > 0) {
            return `Latest events in ${sportName}.`;
        }

        if (athleteCount > 0) {
            return `Active names in ${sportName}.`;
        }

        return `${sportName}'s live front page.`;
    });

    currentHeroPrimaryCheckpoint = computed<CurrentCheckpointItem | null>(() => {
        const liveEvent = this.liveCurrentEvent();
        if (liveEvent) {
            return this.toCurrentCheckpointItem(liveEvent, 'Live now');
        }

        const nextEvent = this.nextUpcomingCurrentEvent() || this.nextCurrentEvent();
        if (nextEvent) {
            return this.toCurrentCheckpointItem(nextEvent, 'Next up');
        }

        const milestone = this.nextProgrammeMilestone();
        return milestone ? { ...milestone, eyebrow: 'Next up' } : null;
    });

    currentHeroSecondaryCheckpoint = computed<CurrentCheckpointItem | null>(() => {
        if (!this.liveCurrentEvent()) return null;

        const nextEvent = this.nextUpcomingCurrentEvent();
        if (nextEvent) {
            return this.toCurrentCheckpointItem(nextEvent, 'Next up');
        }

        const milestone = this.nextProgrammeMilestone();
        return milestone ? { ...milestone, eyebrow: 'Next up' } : null;
    });

    currentHeroFocusItems = computed<string[]>(() => {
        const selectedSport = this.sport();
        const selectedDisciplineId = this.activeDisciplineId();
        const shouldFilterByDiscipline =
            !!selectedSport && selectedDisciplineId !== 'all' && this.hasSubDisciplineView();
        const activeAthletesById = new Map(
            [...this.baseRoadToLa28Athletes(), ...this.activeAthletes()].map(athlete => [athlete.id, athlete])
        );
        const editorialNames = (this.sport()?.currentFocusAthletes || [])
            .filter(athlete => {
                if (!athlete?.fullName) return false;
                if (!shouldFilterByDiscipline || !selectedSport) return true;
                const activeAthlete = athlete.id ? activeAthletesById.get(athlete.id) : null;
                if (!activeAthlete) return false;
                return this.athleteMatchesDisciplineFilter(activeAthlete, selectedSport, selectedDisciplineId);
            })
            .map(athlete => athlete?.fullName)
            .filter((name): name is string => !!name);

        if (editorialNames.length > 0) {
            return Array.from(new Set(editorialNames)).slice(0, 6);
        }

        const unitNames = this.filteredCurrentContenderUnits()
            .map(unit => unit.displayName)
            .filter((name): name is string => !!name);

        if (unitNames.length > 0) {
            return Array.from(new Set(unitNames)).slice(0, 3);
        }

        return this.roadToLa28Athletes()
            .map(athlete => athlete.fullName)
            .filter((name): name is string => !!name)
            .slice(0, 3);
    });

    currentHeroActivityStat = computed<CurrentSnapshotStat>(() => {
        if (!this.supportsFullCurrentCoverage()) {
            return { label: 'Coverage', value: 'Athletes', note: 'current focus' };
        }

        const liveCount = this.visibleCurrentCalendarCards().filter(card => card.timeGroup === 'live').length;
        if (liveCount > 0) {
            return { label: 'Live now', value: String(liveCount), note: 'events' };
        }

        const todayCount = this.visibleCurrentCalendarCards().filter(card => card.timeGroup === 'today').length;
        if (todayCount > 0) {
            return { label: 'Today', value: String(todayCount), note: 'events' };
        }

        const weekCount = this.visibleCurrentCalendarCards().filter(card => card.timeGroup === 'thisWeek').length;
        if (weekCount > 0) {
            return { label: 'This week', value: String(weekCount), note: 'events' };
        }

        return { label: 'Upcoming', value: String(this.currentUpcomingCount()), note: 'events' };
    });

    currentHeroActiveAthletesStat = computed<CurrentSnapshotStat>(() => ({
        label: 'Active athletes',
        value: String(this.roadToLa28Athletes().length),
        note: 'tracked now',
    }));

    sortedGoldenMoments = computed<GoldenMoment[]>(() => {
        const typeOrder: Record<GoldenMoment['type'], number> = {
            gold: 0,
            silver: 1,
            bronze: 2,
            heartbreak: 3,
        };

        return [...this.goldenMoments()].sort((a, b) => {
            const typeDelta = typeOrder[a.type] - typeOrder[b.type];
            if (typeDelta !== 0) return typeDelta;
            return b.year - a.year;
        });
    });

    currentHeroCardHeader = computed(() =>
        this.supportsFullCurrentCoverage() ? 'Live Snapshot' : 'Active Athletes'
    );

    heroActiveAthletePreviews = computed<HeroAthletePreview[]>(() => {
        const selectedSport = this.sport();
        const selectedDisciplineId = this.activeDisciplineId();
        const shouldFilterByDiscipline =
            !!selectedSport && selectedDisciplineId !== 'all' && this.hasSubDisciplineView();
        const activeById = new Map(this.roadToLa28Athletes().map(athlete => [athlete.id, athlete]));
        const allActiveById = new Map(this.activeAthletes().map(athlete => [athlete.id, athlete]));
        const toPreview = (
            id: string,
            fullName: string,
            photoUrl: string | null,
            meta?: string
        ): HeroAthletePreview => ({
            id,
            fullName,
            photoUrl,
            meta,
            initial: fullName.trim().charAt(0).toUpperCase() || 'A',
        });

        const editorialFocus = (this.sport()?.currentFocusAthletes || [])
            .filter(athlete => {
                if (!athlete?.id || !athlete.fullName) return false;
                if (!shouldFilterByDiscipline || !selectedSport) return true;
                const activeAthlete = activeById.get(athlete.id) || allActiveById.get(athlete.id);
                if (!activeAthlete) return false;
                return this.athleteMatchesDisciplineFilter(activeAthlete, selectedSport, selectedDisciplineId);
            })
            .map(athlete => {
                if (!athlete?.id || !athlete.fullName) return null;
                const activeAthlete = activeById.get(athlete.id) || allActiveById.get(athlete.id);
                return toPreview(
                    athlete.id,
                    athlete.fullName,
                    activeAthlete ? this.getActiveAthleteImageUrl(activeAthlete) : this.payload.getMediaUrl(athlete.photo || null),
                    activeAthlete ? this.getRoadToLa28AthleteMeta(activeAthlete) : undefined
                );
            })
            .filter((athlete): athlete is HeroAthletePreview => !!athlete);

        if (editorialFocus.length > 0) {
            return editorialFocus.slice(0, 4);
        }

        return this.roadToLa28Athletes()
            .slice(0, 4)
            .map(athlete =>
                toPreview(
                    athlete.id,
                    athlete.fullName,
                    this.getActiveAthleteImageUrl(athlete),
                    this.getRoadToLa28AthleteMeta(athlete)
                )
            );
    });

    lightCurrentContextNote = computed(() => {
        if (!this.usesUnifiedCurrentLayout()) return null;

        const cycleNote = this.currentCycleContextNote();
        if (cycleNote) return cycleNote;

        const athleteCount = this.roadToLa28Athletes().length;
        if (athleteCount > 0) {
            const sportName = this.sport()?.name || 'This sport';
            return `Tracking ${athleteCount} active athletes in ${sportName} right now.`;
        }

        return null;
    });

    heroPerformanceSummary = computed(() => {
        const selectedDiscipline = this.activeDisciplineId();
        if (this.hasSubDisciplineView() && selectedDiscipline !== 'all') {
            const medals = this.totalMedals();
            return {
                editionCount: this.displayedEditions().length,
                athleteCount: this.displayedAthletesCount(),
                participationCount: this.displayedParticipationsCount(),
                medalCount: medals,
            };
        }

        const summary = this.legacySummary();
        if (summary) {
            return summary;
        }

        const editions = this.legacyEditionSummaries();
        if (editions.length === 0) {
            return {
                editionCount: 0,
                athleteCount: 0,
                participationCount: 0,
                medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
            };
        }

        const athleteKeys = new Set<string>();
        let participationCount = 0;
        let gold = 0;
        let silver = 0;
        let bronze = 0;

        editions.forEach(edition => {
            edition.athleteKeys.forEach(key => athleteKeys.add(key));
            participationCount += edition.participationCount;
            gold += edition.medalCount.gold;
            silver += edition.medalCount.silver;
            bronze += edition.medalCount.bronze;
        });

        return {
            editionCount: editions.length,
            athleteCount: athleteKeys.size,
            participationCount,
            medalCount: {
                gold,
                silver,
                bronze,
                total: gold + silver + bronze,
            },
        };
    });

    legacyOlympicDebutLabel = computed(() => {
        const editions = this.legacyEditionSummaries();
        if (editions.length === 0) {
            return '—';
        }

        const oldestEdition = editions.reduce((oldest, current) =>
            current.edition.year < oldest.edition.year ? current : oldest
        );

        return oldestEdition.edition.name || String(oldestEdition.edition.year);
    });

    heroStatsHeader = computed(() => {
        return 'Performance Summary';
    });

    // Toggle full history view
    toggleFullHistory() {
        this.showFullHistory.set(!this.showFullHistory());
    }

    setDisciplineFilter(disciplineId: string) {
        if (this.activeDisciplineId() === disciplineId) {
            this.selectedDisciplineId.set('all');
            return;
        }
        this.selectedDisciplineId.set(disciplineId);
        if (this.activeView() === 'current') {
            this.currentCompletedExpanded.set(false);
        }
    }

    setCurrentCalendarFilter(filter: CurrentCalendarFilter): void {
        this.currentCalendarFilter.set(filter);
        this.currentCompletedExpanded.set(false);
    }

    toggleCurrentCompletedExpanded(): void {
        this.currentCompletedExpanded.update(value => !value);
    }

    toggleSportSwitchExpanded(): void {
        this.sportSwitchExpanded.update(value => !value);
    }

    isSportSwitchExpanded(): boolean {
        return this.sportSwitchExpanded();
    }

    setCurrentContentView(view: CurrentContentView): void {
        this.currentContentView.set(view);
    }

    isActiveCurrentContentView(view: CurrentContentView): boolean {
        return this.displayedCurrentContentView() === view;
    }

    getVisibleDisciplines(group: EditionGroup): DisciplineGroup[] {
        const activeDiscipline = this.activeDisciplineId();
        if (activeDiscipline === 'all' || !this.hasSubDisciplineView()) {
            return group.disciplines;
        }
        return group.disciplines.filter(discipline => discipline.id === activeDiscipline);
    }

    toggleEditionExpanded(editionId: string) {
        this.expandedEditionIds.update(current => {
            const next = new Set(current);
            if (next.has(editionId)) {
                next.delete(editionId);
            } else {
                next.add(editionId);
                this.ensureLegacyEditionLoaded(editionId);
            }
            return next;
        });
    }

    isEditionExpanded(editionId: string): boolean {
        return this.expandedEditionIds().has(editionId);
    }

    isEditionLoading(editionId: string): boolean {
        return this.legacyEditionLoadingIds().has(editionId);
    }

    getEditionError(editionId: string): string | null {
        return this.legacyEditionErrors().get(editionId) || null;
    }

    getLoadedEditionGroup(editionId: string): EditionGroup | null {
        return this.loadedEditionGroupsMap().get(editionId) || null;
    }

    getEditionAthleteCount(group: LegacyEditionOverview): number {
        const activeDiscipline = this.activeDisciplineId();
        if (activeDiscipline === 'all' || !this.hasSubDisciplineView()) {
            return group.athleteCount;
        }

        const discipline = group.disciplines.find(item => item.id === activeDiscipline);
        return discipline ? discipline.athleteCount : 0;
    }

    getEditionParticipationCount(group: LegacyEditionOverview): number {
        const activeDiscipline = this.activeDisciplineId();
        if (activeDiscipline === 'all' || !this.hasSubDisciplineView()) {
            return group.participationCount;
        }

        const discipline = group.disciplines.find(item => item.id === activeDiscipline);
        return discipline ? discipline.participationCount : 0;
    }

    setActiveView(view: SportDetailView) {
        const nextView: SportDetailView =
            view === 'current' && this.isLegacyOnlySport() ? 'legacy' : view;
        const focusedEditionSlug = this.focusedEditionSlug();

        if (this.activeView() === nextView) {
            if (nextView === 'legacy') {
                this.ensureLegacyLoaded();
            }
            return;
        }

        this.activeView.set(nextView);
        if (nextView === 'legacy') {
            this.ensureLegacyLoaded();
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                view: nextView,
                edition: nextView === 'legacy' && focusedEditionSlug && !this.showFullHistory()
                    ? focusedEditionSlug
                    : null,
            },
            replaceUrl: true,
        });
    }

    isActiveView(view: SportDetailView): boolean {
        return this.activeView() === view;
    }

    onCurrentHeroImageError(): void {
        this.currentHeroImageLoadFailed.set(true);
    }

    onLegacyHeroImageError(): void {
        this.legacyHeroImageLoadFailed.set(true);
    }

    getSportSwitchQueryParams(): { view: SportDetailView; edition?: string } | null {
        if (this.usesUnifiedCurrentLayout()) {
            return { view: 'current' };
        }

        const focusedEditionSlug = this.focusedEditionSlug();
        if (this.activeView() === 'legacy' && focusedEditionSlug && !this.showFullHistory()) {
            return { view: 'legacy', edition: focusedEditionSlug };
        }

        return { view: 'current' };
    }

    ngAfterViewInit(): void {
        this.sportSwitchLinks.changes
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.scheduleActiveSportScroll());

        this.scheduleActiveSportScroll();
    }

    ngOnInit() {
        combineLatest([this.route.paramMap, this.route.queryParamMap])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([params, queryParams]) => {
                const sportSlug = params.get('sportname');
                const editionSlug = queryParams.get('edition');
                const requestedView = queryParams.get('view');
                const requestedDetailView: SportDetailView =
                    requestedView === 'legacy'
                        ? 'legacy'
                        : requestedView === 'current'
                            ? 'current'
                            : editionSlug
                                ? 'legacy'
                                : 'current';
                const nextView = this.isLegacyOnlySport() ? 'legacy' : requestedDetailView;
                const previousEditionSlug = this.focusedEditionSlug();
                const previousView = this.activeView();

                this.focusedEditionSlug.set(editionSlug);
                this.activeView.set(nextView);

                if (!sportSlug) {
                    this.lastLoadedSportSlug = null;
                    return;
                }

                if (sportSlug !== this.lastLoadedSportSlug) {
                    this.lastLoadedSportSlug = sportSlug;
                    this.loadSportHistory(sportSlug);
                    return;
                }

                if (nextView === 'legacy') {
                    this.ensureLegacyLoaded();
                    if (this.legacyLoaded() && (previousEditionSlug !== editionSlug || previousView !== nextView)) {
                        this.showFullHistory.set(false);
                        this.selectedDisciplineId.set('all');
                        this.initializeExpandedEditions();
                    }
                }
            });
    }

    private scheduleActiveSportScroll(): void {
        if (!isPlatformBrowser(this.platformId)) return;

        const raf = globalThis.requestAnimationFrame?.bind(globalThis);
        if (raf) {
            raf(() => this.scrollActiveSportIntoView());
            return;
        }

        setTimeout(() => this.scrollActiveSportIntoView(), 0);
    }

    private scrollActiveSportIntoView(): void {
        const activeSlug = this.activeSportSwitchSlug();
        const container = this.sportSwitchBar?.nativeElement;
        if (!activeSlug || !container || !this.sportSwitchLinks?.length) return;

        const activeChip = this.sportSwitchLinks
            .toArray()
            .find(ref => ref.nativeElement.dataset['sportSlug'] === activeSlug);

        const activeEl = activeChip?.nativeElement;
        if (!activeEl) return;

        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const buffer = 12;
        const leftOverflow = activeRect.left - containerRect.left - buffer;
        const rightOverflow = activeRect.right - containerRect.right + buffer;

        if (leftOverflow < 0) {
            container.scrollTo({
                left: Math.max(0, container.scrollLeft + leftOverflow),
                behavior: 'smooth',
            });
            return;
        }

        if (rightOverflow > 0) {
            container.scrollTo({
                left: container.scrollLeft + rightOverflow,
                behavior: 'smooth',
            });
        }
    }

    loadSportHistory(sportSlug: string) {
        this.loading.set(true);
        this.resolvedCurrentHeroImageUrl.set(null);
        this.resolvedLegacyHeroImageUrl.set(null);
        this.currentHeroImageLoadFailed.set(false);
        this.legacyHeroImageLoadFailed.set(false);
        this.legacySummary.set(null);
        this.legacyEditionSummaries.set([]);
        this.legacyEditionParticipations.set(new Map());
        this.goldenMoments.set([]);
        this.la28QualificationPathways.set([]);
        this.la28CalendarEvents.set([]);
        this.la28ContenderUnits.set([]);
        this.activeAthletes.set([]);
        this.legacyLoading.set(false);
        this.legacyLoaded.set(false);
        this.legacyEditionCount.set(null);
        this.legacyError.set(null);
        this.legacyEditionLoadingIds.set(new Set());
        this.legacyEditionErrors.set(new Map());
        this.expandedEditionIds.set(new Set());
        this.selectedDisciplineId.set('all');
        this.currentCalendarFilter.set('all');
        this.currentCompletedExpanded.set(false);
        this.currentContentView.set('calendar');
        this.sportSwitchExpanded.set(false);

        // First get the sport details
        this.payload.getSportBySlug(sportSlug).subscribe(sport => {
            this.sport.set(sport);
            this.syncHeroImagesForSport(sport);
            this.scheduleActiveSportScroll();
            if (this.resolveSportLifecycle(sport) === 'discontinued') {
                this.activeView.set('legacy');
            }
            if (sport) {
                forkJoin({
                    sports: this.payload.getSports(),
                    qualificationPathways: this.payload.getQualificationPathways().pipe(catchError(() => of([]))),
                    calendarEvents: this.payload.getCalendarEvents({ limit: 500 }).pipe(catchError(() => of([]))),
                    contenderUnits: this.payload.getContenderUnits({
                        cycle: LA28_CYCLE,
                        activeOnly: true,
                        limit: 400,
                    }).pipe(catchError(() => of({ docs: [], totalDocs: 0 }))),
                    activeAthletes: this.payload.getAthletes({
                        isActive: true,
                        limit: 400,
                    }).pipe(catchError(() => of({ docs: [], totalDocs: 0, totalPages: 0, page: 1 }))),
                    legacySummary: this.payload.getSportLegacySummary(sport.slug).pipe(
                        catchError(() => of<SportLegacySummary | null>(null))
                    ),
                }).subscribe(({ sports, qualificationPathways, calendarEvents, contenderUnits, activeAthletes, legacySummary }) => {
                    this.sportsById.set(new Map(sports.map(item => [item.id, item])));
                    const canonicalSport = sports.find(item => item.id === sport.id) || sport;
                    this.sport.set(canonicalSport);
                    this.syncHeroImagesForSport(canonicalSport);
                    this.scheduleActiveSportScroll();
                    this.la28QualificationPathways.set(
                        qualificationPathways.filter(pathway =>
                            this.isLa28QualificationPathway(pathway) &&
                            this.qualificationPathwayBelongsToSport(pathway, canonicalSport)
                        )
                    );
                    this.la28CalendarEvents.set(
                        calendarEvents.filter(event =>
                            this.isLa28CalendarEventContext(event) &&
                            this.calendarEventBelongsToSport(event, canonicalSport)
                        )
                    );
                    this.la28ContenderUnits.set(
                        contenderUnits.docs.filter(unit => this.contenderUnitBelongsToSport(unit, canonicalSport))
                    );
                    this.activeAthletes.set(
                        activeAthletes.docs.filter(athlete => this.athleteBelongsToSport(athlete, canonicalSport))
                    );
                    this.legacySummary.set(legacySummary);
                    this.legacyEditionCount.set(legacySummary?.editionCount ?? null);
                    this.loading.set(false);
                    this.ensureLegacyLoaded();
                });
            } else {
                this.loading.set(false);
            }
        });
    }

    private syncHeroImagesForSport(sport: Sport | null): void {
        if (!sport) {
            this.resolvedCurrentHeroImageUrl.set(null);
            this.resolvedLegacyHeroImageUrl.set(null);
            this.currentHeroImageLoadFailed.set(false);
            this.legacyHeroImageLoadFailed.set(false);
            return;
        }

        const parentSport =
            sport.parentSport && typeof sport.parentSport === 'object' ? (sport.parentSport as Sport) : null;

        this.currentHeroImageLoadFailed.set(false);
        this.legacyHeroImageLoadFailed.set(false);
        this.resolvedCurrentHeroImageUrl.set(
            this.payload.getSportHeroImageUrl({
                sport,
                parentSport,
                variant: 'current',
            })
        );
        this.resolvedLegacyHeroImageUrl.set(
            this.payload.getSportHeroImageUrl({
                sport,
                parentSport,
                variant: 'legacy',
            })
        );
    }

    private ensureLegacyLoaded() {
        if (this.loading() || this.legacyLoaded() || this.legacyLoading()) return;

        const sport = this.sport();
        if (!sport) return;

        this.loadLegacyData(sport);
    }

    private loadLegacyData(sport: Sport) {
        this.legacyLoading.set(true);
        this.legacyError.set(null);
        this.legacyEditionSummaries.set([]);
        this.legacyEditionParticipations.set(new Map());
        this.goldenMoments.set([]);
        this.legacyEditionLoadingIds.set(new Set());
        this.legacyEditionErrors.set(new Map());
        this.expandedEditionIds.set(new Set());

        this.payload.getSportLegacyOverview(sport.slug).pipe(
            catchError(() => {
                this.legacyError.set('Unable to load Olympic archives right now. Please try again.');
                this.legacyLoading.set(false);
                return of(null);
            })
        ).subscribe(overview => {
            if (!overview) return;

            this.legacyEditionSummaries.set(overview.editions || []);
            this.legacyEditionCount.set((overview.editions || []).length);
            this.goldenMoments.set([...(overview.goldenMoments || [])].sort((a, b) => b.year - a.year));
            this.legacyLoaded.set(true);
            this.legacyLoading.set(false);
            this.initializeExpandedEditions();
        });
    }

    private ensureLegacyEditionLoaded(editionId: string) {
        if (!editionId || this.isEditionLoading(editionId) || this.getLoadedEditionGroup(editionId)) return;

        const sportSlug = this.sport()?.slug;
        if (!sportSlug) return;

        this.legacyEditionErrors.update(current => {
            const next = new Map(current);
            next.delete(editionId);
            return next;
        });
        this.legacyEditionLoadingIds.update(current => new Set(current).add(editionId));

        this.payload.getSportLegacyEditionDetail(sportSlug, editionId).pipe(
            catchError(() => {
                this.legacyEditionErrors.update(current => {
                    const next = new Map(current);
                    next.set(editionId, 'Unable to load this Olympic edition right now.');
                    return next;
                });
                this.legacyEditionLoadingIds.update(current => {
                    const next = new Set(current);
                    next.delete(editionId);
                    return next;
                });
                return of(null);
            })
        ).subscribe(detail => {
            if (!detail) return;

            this.legacyEditionParticipations.update(current => {
                const next = new Map(current);
                next.set(editionId, detail.participations || []);
                return next;
            });
            this.legacyEditionLoadingIds.update(current => {
                const next = new Set(current);
                next.delete(editionId);
                return next;
            });
        });
    }

    private initializeExpandedEditions() {
        const focusedSlug = this.focusedEditionSlug();
        const nextExpanded = new Set<string>();

        if (focusedSlug) {
            const focusedEdition = this.legacyEditionSummaries().find(group => group.edition.slug === focusedSlug);
            if (focusedEdition) {
                nextExpanded.add(focusedEdition.edition.id);
                this.ensureLegacyEditionLoaded(focusedEdition.edition.id);
            }
        }

        this.expandedEditionIds.set(nextExpanded);
    }

    private resolveDisciplineForParticipation(participation: OlympicParticipation): {
        id: string;
        name: string;
        slug: string;
        pictogramUrl: string | null;
    } {
        const selectedSport = this.sport();

        if (typeof participation.event !== 'object' || !participation.event?.sport || typeof participation.event.sport !== 'object') {
            return {
                id: selectedSport?.id || 'unknown-discipline',
                name: selectedSport?.name || 'Discipline',
                slug: selectedSport?.slug || '',
                pictogramUrl:
                    this.payload.getSportPictogramUrl({
                        sport: selectedSport || null,
                        includePlaceholderFallback: false,
                    }) || null,
            };
        }

        const eventSportRaw = participation.event.sport as Sport;
        const eventSport = this.resolveSportWithCatalog(eventSportRaw);
        if (!eventSport) {
            return {
                id: selectedSport?.id || 'unknown-discipline',
                name: selectedSport?.name || 'Discipline',
                slug: selectedSport?.slug || '',
                pictogramUrl:
                    this.payload.getSportPictogramUrl({
                        sport: selectedSport || null,
                        includePlaceholderFallback: false,
                    }) || null,
            };
        }

        const parentId = this.getParentSportId(eventSport);
        const parentSport = parentId ? this.sportsById().get(parentId) || null : null;
        const selectedHasChildren = !!selectedSport && this.getChildDisciplineIdsForSport(selectedSport.id).size > 0;
        const isParentLevelEntry = !!selectedSport && eventSport.id === selectedSport.id && selectedHasChildren;

        if (isParentLevelEntry) {
            const inferredDiscipline = this.inferChildDisciplineForParentEntry(participation, selectedSport!);
            if (inferredDiscipline) {
                return {
                    id: inferredDiscipline.id,
                    name: inferredDiscipline.name,
                    slug: inferredDiscipline.slug,
                    pictogramUrl:
                        this.payload.getSportPictogramUrl({
                            sport: inferredDiscipline,
                            parentSport,
                            includePlaceholderFallback: false,
                        }) || null,
                };
            }

            return {
                id: `${UNMAPPED_DISCIPLINE_PREFIX}${selectedSport!.id}`,
                name: 'Needs Mapping',
                slug: `${selectedSport!.slug}-needs-mapping`,
                pictogramUrl:
                    this.payload.getSportPictogramUrl({
                        sport: selectedSport || null,
                        includePlaceholderFallback: false,
                    }) || null,
            };
        }

        const isChildOfSelected = !!selectedSport && parentId === selectedSport.id;
        const disciplineSport = isChildOfSelected ? eventSport : (selectedSport || eventSport);

        return {
            id: disciplineSport.id || selectedSport?.id || 'unknown-discipline',
            name: disciplineSport.name || selectedSport?.name || 'Discipline',
            slug: disciplineSport.slug || selectedSport?.slug || '',
            pictogramUrl:
                this.payload.getSportPictogramUrl({
                    sport: disciplineSport,
                    parentSport,
                    includePlaceholderFallback: false,
                }) || null,
        };
    }

    private resolveSportWithCatalog(sport: Sport | null): Sport | null {
        if (!sport) return null;
        if (!sport.id) return sport;
        return this.sportsById().get(sport.id) || sport;
    }

    private getParentSportId(sport: Sport | null): string | null {
        if (!sport) return null;

        const rawParent = (sport as unknown as { parentSport?: unknown }).parentSport;
        if (typeof rawParent === 'string') return rawParent;
        if (typeof rawParent === 'object' && rawParent && 'id' in (rawParent as Record<string, unknown>)) {
            const parentId = (rawParent as Record<string, unknown>).id;
            return typeof parentId === 'string' ? parentId : null;
        }

        const catalogSport = sport.id ? this.sportsById().get(sport.id) : null;
        if (!catalogSport) return null;
        const catalogParent = (catalogSport as unknown as { parentSport?: unknown }).parentSport;
        if (typeof catalogParent === 'string') return catalogParent;
        if (typeof catalogParent === 'object' && catalogParent && 'id' in (catalogParent as Record<string, unknown>)) {
            const parentId = (catalogParent as Record<string, unknown>).id;
            return typeof parentId === 'string' ? parentId : null;
        }

        return null;
    }

    private getChildDisciplinesForSport(sportId: string | null): Sport[] {
        if (!sportId) return [];
        return Array.from(this.sportsById().values()).filter(item => this.getParentSportId(item) === sportId);
    }

    private getChildDisciplineIdsForSport(sportId: string): Set<string> {
        return new Set(this.getChildDisciplinesForSport(sportId).map(item => item.id));
    }

    private inferChildDisciplineForParentEntry(participation: OlympicParticipation, selectedSport: Sport): Sport | null {
        const athleteId = this.getAthleteId(participation);
        const editionId = this.getEditionId(participation);
        const sameEditionMatches = new Map<string, Sport>();
        const allMatches = new Map<string, Sport>();

        if (athleteId) {
            this.participations().forEach(candidate => {
                if (candidate === participation) return;
                if (this.getAthleteId(candidate) !== athleteId) return;
                if (typeof candidate.event !== 'object' || !candidate.event?.sport || typeof candidate.event.sport !== 'object') return;

                const candidateSport = this.resolveSportWithCatalog(candidate.event.sport as Sport);
                if (!candidateSport?.id || candidateSport.id === selectedSport.id) return;
                if (this.getParentSportId(candidateSport) !== selectedSport.id) return;

                allMatches.set(candidateSport.id, candidateSport);
                if (editionId && this.getEditionId(candidate) === editionId) {
                    sameEditionMatches.set(candidateSport.id, candidateSport);
                }
            });
        }

        if (sameEditionMatches.size === 1) {
            return Array.from(sameEditionMatches.values())[0];
        }
        if (allMatches.size === 1) {
            return Array.from(allMatches.values())[0];
        }

        const inferredFromAthlete = this.inferChildDisciplineFromAthleteProfile(participation, selectedSport);
        if (inferredFromAthlete) {
            return inferredFromAthlete;
        }

        return this.inferChildDisciplineFromEventName(participation, selectedSport);
    }

    private inferChildDisciplineFromAthleteProfile(participation: OlympicParticipation, selectedSport: Sport): Sport | null {
        if (typeof participation.athlete !== 'object' || !participation.athlete) return null;
        const athleteSports = Array.isArray((participation.athlete as Athlete).sports) ? (participation.athlete as Athlete).sports : [];
        const matches = new Map<string, Sport>();

        athleteSports.forEach(rawSport => {
            if (typeof rawSport !== 'object' || !rawSport) return;
            const resolvedSport = this.resolveSportWithCatalog(rawSport as Sport);
            if (!resolvedSport?.id || resolvedSport.id === selectedSport.id) return;
            if (this.getParentSportId(resolvedSport) !== selectedSport.id) return;
            matches.set(resolvedSport.id, resolvedSport);
        });

        if (matches.size === 1) {
            return Array.from(matches.values())[0];
        }

        return null;
    }

    private inferChildDisciplineFromEventName(participation: OlympicParticipation, selectedSport: Sport): Sport | null {
        const eventName = this.getEventName(participation).toLowerCase();
        const sportSlug = (selectedSport.slug || '').toLowerCase();

        if (sportSlug === 'gymnastics') {
            if (eventName.includes('rhythmic')) {
                return this.findChildDisciplineBySlug(selectedSport, ['rhythmic-gymnastics']);
            }
            if (eventName.includes('trampoline')) {
                return this.findChildDisciplineBySlug(selectedSport, ['trampoline']);
            }
            return this.findChildDisciplineBySlug(selectedSport, ['artistic-gymnastics']);
        }

        if (sportSlug === 'cycling') {
            if (eventName.includes('bmx') && eventName.includes('freestyle')) {
                return this.findChildDisciplineBySlug(selectedSport, ['bmx-freestyle']);
            }
            if (eventName.includes('bmx')) {
                return this.findChildDisciplineBySlug(selectedSport, ['bmx-racing']);
            }
            if (eventName.includes('mountain') || eventName.includes('cross-country') || eventName.includes('cross country')) {
                return this.findChildDisciplineBySlug(selectedSport, ['mountain-bike']);
            }
            if (eventName.includes('road') || eventName.includes('time trial')) {
                return this.findChildDisciplineBySlug(selectedSport, ['road-cycling']);
            }
            return this.findChildDisciplineBySlug(selectedSport, ['track-cycling']);
        }

        if (sportSlug === 'equestrian') {
            if (eventName.includes('three-day') || eventName.includes('eventing')) {
                return this.findChildDisciplineBySlug(selectedSport, ['equestrian-eventing']);
            }
            if (eventName.includes('dressage') || eventName.includes('individual, open')) {
                return this.findChildDisciplineBySlug(selectedSport, ['dressage']);
            }
            if (eventName.includes('jump')) {
                return this.findChildDisciplineBySlug(selectedSport, ['jumping']);
            }
            return null;
        }

        if (sportSlug === 'aquatics') {
            if (eventName.includes('water polo')) {
                return this.findChildDisciplineBySlug(selectedSport, ['water-polo']);
            }
            if (eventName.includes('diving') || eventName.includes('springboard') || eventName.includes('platform')) {
                return this.findChildDisciplineBySlug(selectedSport, ['diving']);
            }
            if (eventName.includes('artistic swimming') || eventName.includes('synchronised swimming') || eventName.includes('synchronized swimming')) {
                return this.findChildDisciplineBySlug(selectedSport, ['artistic-swimming']);
            }
            if (eventName.includes('marathon') || eventName.includes('open water')) {
                return this.findChildDisciplineBySlug(selectedSport, ['marathon-swimming']);
            }
            if (
                eventName.includes('freestyle') ||
                eventName.includes('backstroke') ||
                eventName.includes('breaststroke') ||
                eventName.includes('butterfly') ||
                eventName.includes('medley') ||
                eventName.includes('relay') ||
                eventName.includes('swimming')
            ) {
                return this.findChildDisciplineBySlug(selectedSport, ['swimming']);
            }
            return this.findChildDisciplineBySlug(selectedSport, ['swimming']);
        }

        return null;
    }

    private findChildDisciplineBySlug(selectedSport: Sport, slugs: string[]): Sport | null {
        const children = this.getChildDisciplinesForSport(selectedSport.id);
        if (children.length === 0) return null;

        for (const slug of slugs) {
            const match = children.find(child => (child.slug || '').toLowerCase() === slug.toLowerCase());
            if (match) return match;
        }

        return null;
    }

    private getAthleteId(participation: OlympicParticipation): string | null {
        if (typeof participation.athlete === 'object' && participation.athlete?.id) {
            return participation.athlete.id;
        }
        return null;
    }

    isUnmappedDisciplineId(disciplineId: string): boolean {
        return disciplineId.startsWith(UNMAPPED_DISCIPLINE_PREFIX);
    }

    getDisciplineDisplayName(name: string): string {
        const selectedSport = this.sport();
        if (!selectedSport || !name) return name;

        const prefix = `${selectedSport.name} `;
        if (name.startsWith(prefix) && name.length > prefix.length) {
            return name.slice(prefix.length);
        }

        return name;
    }

    private countParticipationEntries(groups: LegacyEditionOverview[], disciplineId: string): number {
        return groups.reduce((total, group) => {
            if (!this.hasSubDisciplineView()) {
                return total + group.participationCount;
            }
            if (disciplineId === 'all') {
                return total + group.participationCount;
            }
            const discipline = group.disciplines.find(item => item.id === disciplineId);
            return total + (discipline ? discipline.participationCount : 0);
        }, 0);
    }

    private countUniqueSummaryAthletes(groups: LegacyEditionOverview[], disciplineId: string): number {
        const athleteKeys = new Set<string>();
        groups.forEach(group => {
            if (!this.hasSubDisciplineView() || disciplineId === 'all') {
                group.athleteKeys.forEach(athleteKey => athleteKeys.add(athleteKey));
                return;
            }

            const discipline = group.disciplines.find(item => item.id === disciplineId);
            discipline?.athleteKeys.forEach(athleteKey => athleteKeys.add(athleteKey));
        });

        return athleteKeys.size;
    }

    private getEditionId(participation: OlympicParticipation): string | null {
        if (typeof participation.edition === 'object' && participation.edition?.id) {
            return participation.edition.id;
        }
        return null;
    }

    private getAthleteKey(participation: OlympicParticipation): string | null {
        const athleteId = this.getAthleteId(participation);
        if (athleteId) return athleteId;
        const athleteName = this.getAthleteName(participation);
        if (athleteName && athleteName !== 'Unknown') {
            return `name:${athleteName}`;
        }
        return null;
    }

    getAthleteName(p: OlympicParticipation): string {
        if (typeof p.athlete === 'object' && p.athlete) {
            return (p.athlete as Athlete).fullName;
        }
        return 'Unknown';
    }

    getEventName(p: OlympicParticipation): string {
        if (typeof p.event === 'object' && p.event) {
            return (p.event as Event).name;
        }
        return '';
    }

    getGenderFromEvent(eventName: string): 'men' | 'women' | 'mixed' {
        const lower = eventName.toLowerCase();
        if (lower.includes('women') || lower.includes("women's")) {
            return 'women';
        }
        if (lower.includes('mixed')) {
            return 'mixed';
        }
        return 'men'; // Default to men per historical trend (or check explicit 'men')
    }

    getBetterResult(current: string, incoming: string): string {
        const order = {
            gold: 0,
            silver: 1,
            bronze: 2,
            '4th-8th': 3,
            participated: 4,
            reserve: 5,
            dns: 6,
            dnf: 7,
            dq: 8,
        };
        const currentRank = order[current as keyof typeof order] ?? 4;
        const incomingRank = order[incoming as keyof typeof order] ?? 4;
        return incomingRank < currentRank ? incoming : current;
    }

    getMedalEmoji(result: string): string {
        switch (result) {
            case 'gold': return '🥇';
            case 'silver': return '🥈';
            case 'bronze': return '🥉';
            default: return '';
        }
    }

    hasParticipationResultBadge(result: string): boolean {
        return !!result && result !== 'participated';
    }

    getParticipationResultLabel(result: string): string {
        switch (result) {
            case 'gold':
                return 'Gold';
            case 'silver':
                return 'Silver';
            case 'bronze':
                return 'Bronze';
            case '4th-8th':
                return 'Top 8';
            case 'reserve':
                return 'Reserve';
            case 'dns':
                return 'DNS';
            case 'dnf':
                return 'DNF';
            case 'dq':
                return 'DQ';
            default:
                return '';
        }
    }

    getParticipationResultClass(result: string): string {
        switch (result) {
            case 'gold':
                return 'result-gold';
            case 'silver':
                return 'result-silver';
            case 'bronze':
                return 'result-bronze';
            case '4th-8th':
                return 'result-top-eight';
            case 'reserve':
                return 'result-reserve';
            case 'dns':
                return 'result-dns';
            case 'dnf':
                return 'result-dnf';
            case 'dq':
                return 'result-dq';
            default:
                return '';
        }
    }

    getLegacySubtitle(): string {
        const sportName = this.sport()?.name || 'Sport';
        const suffix = sportName.toLowerCase().endsWith('s') ? "'" : "'s";
        return `${sportName}${suffix} Olympic legacy`;
    }

    getCurrentCalendarEventLinkLabel(card: CurrentCalendarCard): string | null {
        if (card.navigation.kind === 'external') {
            return card.timeGroup === 'completed' ? 'Official Results' : 'Official Source';
        }
        return null;
    }

    getLa28EventImportanceLabel(event: CalendarEvent): string {
        switch (event.importance) {
            case 'core':
                return 'Core';
            case 'high':
                return 'High';
            case 'watch':
                return 'Watch';
            default:
                return 'Build-up';
        }
    }

    getLa28EventSynopsis(event: CalendarEvent): string | null {
        return event.summary || null;
    }

    getCurrentCalendarEventImageUrl(event: CalendarEvent): string | null {
        return this.payload.getMediaUrl((event.heroImage as { url: string } | null | undefined) || null);
    }

    getCurrentCalendarParticipantsLabel(event: CalendarEvent): string {
        const names = (event.indianParticipants || [])
            .map(participant => participant?.fullName)
            .filter((name): name is string => !!name);

        if (names.length === 0) return '';
        return this.compactList(Array.from(new Set(names)), 3);
    }

    getRoadToLa28AthleteMeta(athlete: Athlete): string {
        const parts: string[] = [];
        const eventLabel = this.getRoadToLa28AthleteEventLabel(athlete);
        const sportLabel = this.getRoadToLa28AthleteSportLabel(athlete);

        if (eventLabel) {
            parts.push(eventLabel);
        } else if (sportLabel) {
            parts.push(sportLabel);
        }
        if (athlete.worldRanking) {
            parts.push(`WR ${athlete.worldRanking}`);
        }
        if (athlete.state) {
            parts.push(athlete.state);
        }

        return parts.join(' • ');
    }

    getActiveAthleteImageUrl(athlete: Athlete): string {
        return this.payload.getAthleteImageUrl(athlete);
    }

    private getRoadToLa28AthleteSportLabel(athlete: Athlete): string {
        const selectedSport = this.sport();
        if (!selectedSport) return '';

        const matches = (athlete.sports || [])
            .map(rawSport => this.resolveSportWithCatalog(rawSport || null))
            .filter((sport): sport is Sport => !!sport && this.sportMatchesCurrentSport(sport, selectedSport))
            .map(sport => {
                const parentId = this.getParentSportId(sport);
                if (sport.id === selectedSport.id || parentId !== selectedSport.id) {
                    return selectedSport.name;
                }
                return sport.name;
            });

        if (matches.length === 0) return '';
        return this.compactList(Array.from(new Set(matches)), 2);
    }

    private getRoadToLa28AthleteEventLabel(athlete: Athlete): string {
        const selectedSport = this.sport();
        if (!selectedSport) return '';

        const eventNames = this.la28ContenderUnits()
            .filter(unit => (unit.athletes || []).some(member => member?.id === athlete.id))
            .flatMap(unit => (unit.events || []).map(event => event?.name).filter((name): name is string => !!name));

        if (eventNames.length > 0) {
            return this.compactList(Array.from(new Set(eventNames)), 2);
        }

        const disciplineNames = (athlete.sports || [])
            .map(rawSport => this.resolveSportWithCatalog(rawSport || null))
            .filter((sport): sport is Sport => !!sport && this.sportMatchesCurrentSport(sport, selectedSport))
            .map(sport => {
                const parentId = this.getParentSportId(sport);
                if (sport.id === selectedSport.id || parentId !== selectedSport.id) {
                    return '';
                }
                return sport.name;
            })
            .filter((name): name is string => !!name);

        if (disciplineNames.length > 0) {
            return this.compactList(Array.from(new Set(disciplineNames)), 2);
        }

        return '';
    }

    private matchesCurrentCalendarFilter(card: CurrentCalendarCard, filter: CurrentCalendarFilter): boolean {
        if (filter === 'all') return true;
        if (filter === 'live') return card.timeGroup === 'live';

        const importance = card.event.importance || 'context';

        if (filter === 'core') {
            return importance === 'core' || importance === 'high';
        }

        if (filter === 'watch') {
            return importance === 'watch';
        }

        return importance === 'context';
    }

    private getFallbackProgrammeEventCount(): number | null {
        const sportSlug = (this.sport()?.slug || '').toLowerCase();
        if (sportSlug === 'badminton') return 5;

        const intro = this.la28IntroParagraphs().join(' ').toLowerCase();
        const digitMatch = intro.match(/(\d+)\s+medal events?/);
        if (digitMatch) {
            return Number(digitMatch[1]);
        }

        const wordMatch = intro.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+medal events?/);
        if (!wordMatch) return null;

        return this.numberWordToValue(wordMatch[1]);
    }

    private getFallbackMaxEntriesPerNoc(): string | null {
        const sportSlug = (this.sport()?.slug || '').toLowerCase();
        if (sportSlug === 'badminton') return '16 athletes';
        return null;
    }

    private getFallbackQualificationFormat(): string | null {
        const intro = this.la28IntroParagraphs().join(' ').toLowerCase();
        if (intro.includes('ranking-led')) return 'Ranking-led';
        if (intro.includes('single olympic qualifier')) return 'Qualifier-led';
        if (intro.includes('continental')) return 'Continental route';
        return null;
    }

    private toCurrentCalendarCard(event: CalendarEvent): CurrentCalendarCard | null {
        const sport = this.resolveSportWithCatalog(event.sport || null);
        const parentSport = sport ? this.sportsById().get(this.getParentSportId(sport) || '') || null : null;
        const selectedSport = this.sport();
        const start = this.toDate(event.startDate);
        const end = this.toDate(event.endDate || event.startDate);

        if (this.isSeasonWrapperCalendarEvent(event, start, end)) {
            return null;
        }

        return {
            event,
            timeGroup: this.getCurrentCalendarGroup(event),
            relativeLabel: this.getCurrentCalendarRelativeLabel(event),
            dateLabel: this.formatDateRange(event.startDate, event.endDate),
            sortValue: this.toDate(event.startDate)?.getTime() || Number.MAX_SAFE_INTEGER,
            locationLabel: this.getCurrentCalendarLocationLabel(event.location, event.country),
            categoryLabel: this.getCurrentCalendarCategoryLabel(event),
            typeLabel: this.getCurrentCalendarTypeLabel(event.type, event.category) || '',
            importanceClass: this.getCurrentCalendarImportanceClass(event.importance),
            pictogramUrl:
                this.payload.getSportPictogramUrl({
                    sport,
                    parentSport,
                    includePlaceholderFallback: false,
                }) || null,
            disciplineId: this.resolveCurrentDisciplineId(sport, selectedSport),
            navigation: this.payload.getCalendarEventNavigation(event),
        };
    }

    private resolveCurrentDisciplineId(eventSport: Sport | null, selectedSport: Sport | null): string {
        if (!selectedSport) return 'all';

        const resolvedSport = this.resolveSportWithCatalog(eventSport || null);
        if (!resolvedSport?.id) return selectedSport.id;
        if (resolvedSport.id === selectedSport.id) return selectedSport.id;

        const parentId = this.getParentSportId(resolvedSport);
        if (parentId === selectedSport.id) {
            return resolvedSport.id;
        }

        return selectedSport.id;
    }

    private athleteMatchesDisciplineFilter(athlete: Athlete, selectedSport: Sport, disciplineId: string): boolean {
        const athleteMatches = (athlete.sports || [])
            .map(rawSport => this.resolveSportWithCatalog(rawSport || null))
            .some(sport => !!sport?.id && sport.id === disciplineId);

        if (athleteMatches) return true;

        return this.la28ContenderUnits().some(unit =>
            this.unitMatchesDisciplineFilter(unit, selectedSport, disciplineId) &&
            (unit.athletes || []).some(member => member?.id === athlete.id)
        );
    }

    private unitMatchesDisciplineFilter(unit: ContenderUnit, selectedSport: Sport, disciplineId: string): boolean {
        const resolvedSport = this.resolveSportWithCatalog(unit.sport || null);
        if (!resolvedSport?.id) return false;
        if (resolvedSport.id === disciplineId) return true;
        return this.getParentSportId(resolvedSport) === selectedSport.id && resolvedSport.id === disciplineId;
    }

    private getCurrentCalendarGroup(event: CalendarEvent): CurrentCalendarGroup {
        const now = new Date();
        const today = this.startOfDay(now);
        const start = this.toDate(event.startDate);
        const end = this.toDate(event.endDate || event.startDate);

        if (!start || !end) return 'later';
        if (this.isCompletedCalendarEvent(event, end, today)) return 'completed';
        if (this.isLiveCalendarEventWindow(event, start, end, now, today)) return 'live';

        const endOfToday = new Date(today);
        endOfToday.setDate(endOfToday.getDate() + 1);
        if (start >= today && start < endOfToday) return 'today';

        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        if (start < endOfWeek) return 'thisWeek';

        if (start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()) {
            return 'thisMonth';
        }

        return 'later';
    }

    private getCurrentCalendarRelativeLabel(event: CalendarEvent): string {
        const now = new Date();
        const today = this.startOfDay(now);
        const start = this.toDate(event.startDate);
        const end = this.toDate(event.endDate || event.startDate);

        if (!start || !end) return 'TBC';
        if (this.isCompletedCalendarEvent(event, end, today)) return 'Completed';
        if (this.isLiveCalendarEventWindow(event, start, end, now, today)) return 'LIVE';

        const daysAway = Math.ceil((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        if (daysAway <= 0) return 'Today';
        if (daysAway === 1) return 'Tomorrow';
        if (daysAway <= 7) return `In ${daysAway} days`;
        if (daysAway <= 30) {
            const weeks = Math.floor(daysAway / 7);
            return weeks <= 1 ? 'In 1 week' : `In ${weeks} weeks`;
        }

        const months = Math.floor(daysAway / 30);
        return months <= 1 ? 'Next month' : `In ${months} months`;
    }

    private getCurrentCalendarImportanceClass(importance?: string | null): string {
        switch (importance) {
            case 'core':
                return 'importance-core';
            case 'high':
                return 'importance-high';
            case 'watch':
                return 'importance-watch';
            default:
                return 'importance-context';
        }
    }

    private getCurrentCalendarGroupOrder(group: CurrentCalendarGroup): number {
        switch (group) {
            case 'live':
                return 0;
            case 'today':
                return 1;
            case 'thisWeek':
                return 2;
            case 'thisMonth':
                return 3;
            case 'later':
                return 4;
            case 'completed':
                return 5;
        }
    }

    private getCurrentCalendarTypeLabel(type?: string, category?: string): string {
        const normalizedType = this.normalizeCurrentCalendarTypeValue(type);

        switch (normalizedType) {
            case 'world championship':
            case 'world championships':
                return 'World';
            case 'continental':
                return 'Continental';
            case 'qualification':
            case 'qualifier':
            case 'qualifiers':
                return 'Qualification';
            case 'tour':
                return 'Tour';
            case 'major':
            case 'games':
                return 'Games';
            case 'super':
            case 'super series':
                return 'Super Series';
            case 'international':
                return 'International';
            case 'domestic':
                return 'Domestic';
        }

        const normalizedCategory = this.normalizeCurrentCalendarTypeValue(category);
        if (normalizedCategory.includes('world championship')) return 'World';
        if (normalizedCategory.includes('asian games') || normalizedCategory.includes('commonwealth games')) {
            return 'Games';
        }
        if (normalizedCategory.includes('qualifier')) return 'Qualification';

        return '';
    }

    private getCurrentCalendarCategoryLabel(event: CalendarEvent): string {
        const category = (event.category || '').trim();
        const qualificationContext = this.normalizeCurrentCalendarTypeValue(event.qualificationContext);

        if (qualificationContext === 'la 2028 qualifier') {
            if (!category) return 'LA28 Qualifier';
            if (this.normalizeCurrentCalendarTypeValue(category).includes('qualifier')) return category;
            return `${category} · LA28 Qualifier`;
        }

        return category;
    }

    private toCurrentCheckpointItem(card: CurrentCalendarCard, eyebrow: string): CurrentCheckpointItem {
        return {
            eyebrow,
            label: card.event.title,
            dateLabel: card.dateLabel,
            sortValue: card.sortValue,
            note: card.locationLabel || card.relativeLabel,
        };
    }

    private normalizeCurrentCalendarTypeValue(value?: string | null): string {
        return (value || '')
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private getCurrentCalendarLocationLabel(location?: string | null, country?: string | null): string {
        if (!location && !country) return '';
        if (!country || country === 'Multiple' || country === 'TBC') return location || country || '';
        if ((location || '').toLowerCase().includes(country.toLowerCase())) return location || '';
        return location ? `${location}, ${country}` : country;
    }

    private numberWordToValue(value: string): number | null {
        const lookup: Record<string, number> = {
            one: 1,
            two: 2,
            three: 3,
            four: 4,
            five: 5,
            six: 6,
            seven: 7,
            eight: 8,
            nine: 9,
            ten: 10,
            eleven: 11,
            twelve: 12,
        };

        return lookup[value] ?? null;
    }

    private athleteBelongsToSport(athlete: Athlete, selectedSport: Sport): boolean {
        return (athlete.sports || []).some(rawSport =>
            this.sportMatchesCurrentSport(this.resolveSportWithCatalog(rawSport || null), selectedSport)
        );
    }

    private sportMatchesCurrentSport(candidateSport: Sport | null, selectedSport: Sport): boolean {
        if (!candidateSport?.id) return false;
        if (candidateSport.id === selectedSport.id) return true;
        if (this.getChildDisciplineIdsForSport(selectedSport.id).has(candidateSport.id)) return true;

        const parentId = this.getParentSportId(candidateSport);
        return parentId === selectedSport.id;
    }

    private qualificationPathwayBelongsToSport(pathway: QualificationPathway, selectedSport: Sport): boolean {
        return this.sportMatchesCurrentSport(this.resolveSportWithCatalog(pathway.sport || null), selectedSport);
    }

    private calendarEventBelongsToSport(event: CalendarEvent, selectedSport: Sport): boolean {
        return this.sportMatchesCurrentSport(this.resolveSportWithCatalog(event.sport || null), selectedSport);
    }

    private contenderUnitBelongsToSport(unit: ContenderUnit, selectedSport: Sport): boolean {
        return this.sportMatchesCurrentSport(this.resolveSportWithCatalog(unit.sport || null), selectedSport);
    }

    private resolveSportLifecycle(sport: Partial<Sport> | null | undefined) {
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

    private resolveSportTier(sport: Partial<Sport> | null | undefined): IndiaTier | null {
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

    private getSportTierOrder(tier: IndiaTier | null | undefined): number {
        const resolvedTier = tier || 'history_only';
        const index = SPORT_SWITCH_TIER_ORDER.indexOf(resolvedTier);
        return index === -1 ? SPORT_SWITCH_TIER_ORDER.length : index;
    }

    private isLa28QualificationPathway(pathway: QualificationPathway): boolean {
        const editionSlug = (pathway.edition?.slug || '').toLowerCase();
        if (editionSlug === LA28_EDITION_SLUG) return true;
        return /la\s?2028/i.test(pathway.title || '');
    }

    private isLa28CalendarEventContext(event: CalendarEvent): boolean {
        const editionSlug = (event.edition?.slug || '').toLowerCase();
        if (editionSlug === LA28_EDITION_SLUG) return true;

        return /la\s?2028/i.test(
            `${event.summary || ''} ${event.qualificationContext || ''} ${event.notes || ''}`
        );
    }

    private extractRichTextParagraphs(content: any): string[] {
        const root = content?.root;
        if (!root || !Array.isArray(root.children)) return [];

        return root.children
            .map((node: any) => this.flattenRichTextNode(node).trim())
            .filter((text: string) => !!text);
    }

    private flattenRichTextNode(node: any): string {
        if (!node) return '';
        if (typeof node.text === 'string') return node.text;
        if (!Array.isArray(node.children)) return '';
        return node.children.map((child: any) => this.flattenRichTextNode(child)).join('');
    }

    private compactList(values: string[], maxItems: number): string {
        if (values.length <= maxItems) return values.join(', ');
        return `${values.slice(0, maxItems).join(', ')} +${values.length - maxItems}`;
    }

    private isLiveCalendarEvent(event: CalendarEvent): boolean {
        const now = new Date();
        const today = this.startOfDay(now);
        const start = this.toDate(event.startDate);
        const end = this.toDate(event.endDate || event.startDate);
        return this.isLiveCalendarEventWindow(event, start, end, now, today);
    }

    private isLiveCalendarEventWindow(
        event: CalendarEvent,
        start: Date | null,
        end: Date | null,
        now: Date,
        today: Date,
    ): boolean {
        if (!start || !end) return false;
        if (this.isSeasonWrapperCalendarEvent(event, start, end)) return false;

        const status = (event.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'postponed') {
            return false;
        }

        return start <= now && end >= today;
    }

    private isSeasonWrapperCalendarEvent(
        event: CalendarEvent,
        start?: Date | null,
        end?: Date | null,
    ): boolean {
        if (!start || !end) return false;

        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        if (durationDays < 45) return false;

        const location = (event.location || '').toLowerCase();
        const country = (event.country || '').toLowerCase();
        const isMultiVenue = location.includes('multiple') || location.includes('various') || country === 'multiple';

        return isMultiVenue && !event.externalUrl;
    }

    private isCompletedCalendarEvent(event: CalendarEvent, end?: Date | null, today?: Date): boolean {
        const effectiveEnd = end || this.toDate(event.endDate || event.startDate);
        const effectiveToday = today || this.startOfDay(new Date());
        if (!effectiveEnd) return false;
        return effectiveEnd < effectiveToday;
    }

    private getImportanceRank(importance?: string | null): number {
        switch (importance) {
            case 'core':
                return 0;
            case 'high':
                return 1;
            case 'watch':
                return 2;
            case 'context':
                return 3;
            default:
                return 4;
        }
    }

    private formatDateRange(start?: string | null, end?: string | null): string {
        const startLabel = this.formatSingleDate(start);
        const endLabel = this.formatSingleDate(end);

        if (!start && !end) return 'TBC';
        if (!end || startLabel === endLabel) return startLabel;
        return `${startLabel} - ${endLabel}`;
    }

    private formatSingleDate(value?: string | null): string {
        const parsed = this.toDate(value);
        if (!parsed) return 'TBC';

        return new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(parsed);
    }

    private toDate(value?: string | null): Date | null {
        const raw = String(value || '').trim();
        if (!raw) return null;

        const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
        const parsed = new Date(dateOnlyMatch ? `${dateOnlyMatch[1]}T12:00:00Z` : raw);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    private startOfDay(date: Date): Date {
        const next = new Date(date);
        next.setHours(0, 0, 0, 0);
        return next;
    }

}
