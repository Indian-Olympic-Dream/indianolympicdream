import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PayloadService, Sport, OlympicParticipation, Edition, Athlete, Event, GoldenMoment } from '../services/payload.service';
import { forkJoin } from 'rxjs';

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

@Component({
    selector: 'app-history-sport-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './history-sport-detail.component.html',
    styleUrls: ['./history-sport-detail.component.scss']
})
export class HistorySportDetailComponent implements OnInit {
    private payload = inject(PayloadService);
    private route = inject(ActivatedRoute);
    private location = inject(Location);
    private router = inject(Router);
    private sportsById = signal<Map<string, Sport>>(new Map());

    sport = signal<Sport | null>(null);
    participations = signal<OlympicParticipation[]>([]);
    goldenMoments = signal<GoldenMoment[]>([]);
    loading = signal(true);

    // Edition filter - when coming from an Edition page
    focusedEditionSlug = signal<string | null>(null);
    showFullHistory = signal(false);
    selectedDisciplineId = signal<string>('all');

    hasSubDisciplineView = computed(() => {
        const selectedSport = this.sport();
        if (!selectedSport) return false;
        if (this.getChildDisciplinesForSport(selectedSport.id).length > 0) return true;

        const disciplineIds = new Set<string>();
        this.editionGroups().forEach(group => {
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
                    pictogramUrl: this.payload.getMediaUrl(discipline.pictogram),
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
                        pictogramUrl: discipline.pictogramUrl,
                        athleteEntries: 0,
                        medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
                    });
                }

                const row = summary.get(discipline.id)!;
                if (!row.pictogramUrl && discipline.pictogramUrl) {
                    row.pictogramUrl = discipline.pictogramUrl;
                }
                row.athleteEntries += discipline.athletes.length;
                row.medalCount.gold += discipline.medalCount.gold;
                row.medalCount.silver += discipline.medalCount.silver;
                row.medalCount.bronze += discipline.medalCount.bronze;
                row.medalCount.total += discipline.medalCount.gold + discipline.medalCount.silver + discipline.medalCount.bronze;
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
        const exists = this.displayedDisciplineSummary().some(discipline => discipline.id === selected);
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
                athleteEntry = { name: athleteName, events: [], result: 'participated', gender };
                group.athletes.push(athleteEntry);

                // Add to gender specific list
                if (gender === 'men') group.menAthletes.push(athleteEntry);
                else if (gender === 'women') group.womenAthletes.push(athleteEntry);
                else group.mixedAthletes.push(athleteEntry);
            }
            athleteEntry.events.push(eventName);
            if (['gold', 'silver', 'bronze'].includes(result)) {
                athleteEntry.result = this.getBetterResult(athleteEntry.result, result);
            }

            // Add athlete to discipline group
            let disciplineAthlete = disciplineGroup.athletes.find(a => a.name === athleteName);
            if (!disciplineAthlete) {
                disciplineAthlete = { name: athleteName, events: [], result: 'participated', gender };
                disciplineGroup.athletes.push(disciplineAthlete);

                if (gender === 'men') disciplineGroup.menAthletes.push(disciplineAthlete);
                else if (gender === 'women') disciplineGroup.womenAthletes.push(disciplineAthlete);
                else disciplineGroup.mixedAthletes.push(disciplineAthlete);
            }
            disciplineAthlete.events.push(eventName);
            if (['gold', 'silver', 'bronze'].includes(result)) {
                disciplineAthlete.result = this.getBetterResult(disciplineAthlete.result, result);
            }

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
    baseDisplayedEditions = computed<EditionGroup[]>(() => {
        const all = this.editionGroups();
        const focusedSlug = this.focusedEditionSlug();

        // Show all if no focus or user toggled full history
        if (!focusedSlug || this.showFullHistory()) {
            return all;
        }

        // Show only the focused edition
        return all.filter(g => g.edition.slug === focusedSlug);
    });

    displayedEditions = computed<EditionGroup[]>(() => {
        const filteredByEdition = this.baseDisplayedEditions();
        const selectedDiscipline = this.activeDisciplineId();
        if (selectedDiscipline === 'all' || !this.hasSubDisciplineView()) {
            return filteredByEdition;
        }
        return filteredByEdition.filter(group => group.disciplines.some(discipline => discipline.id === selectedDiscipline));
    });

    sportTotalParticipations = computed(() => this.countParticipationEntries(this.baseDisplayedEditions(), 'all'));

    sportTotalAthletes = computed(() => {
        const editionIds = new Set(this.baseDisplayedEditions().map(group => group.edition.id));
        return this.countUniqueAthletes(editionIds, 'all');
    });

    displayedParticipationsCount = computed(() =>
        this.countParticipationEntries(this.displayedEditions(), this.activeDisciplineId())
    );

    displayedAthletesCount = computed(() => {
        const editionIds = new Set(this.displayedEditions().map(group => group.edition.id));
        return this.countUniqueAthletes(editionIds, this.activeDisciplineId());
    });

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

        const directUrl = this.payload.getMediaUrl(sport.pictogram);
        if (directUrl) return directUrl;

        if (sport.parentSport?.pictogram) {
            const parentUrl = this.payload.getMediaUrl(sport.parentSport.pictogram);
            if (parentUrl) return parentUrl;
        }

        // Fallback: use first available child/linked event sport pictogram from loaded participations.
        for (const participation of this.participations()) {
            if (typeof participation.event !== 'object' || !participation.event?.sport || typeof participation.event.sport !== 'object') {
                continue;
            }
            const eventSport = participation.event.sport as Sport;
            const parentSport = typeof eventSport.parentSport === 'object' ? eventSport.parentSport as Sport : null;
            const matchesCurrentSport = eventSport.id === sport.id || parentSport?.id === sport.id;
            if (!matchesCurrentSport) continue;

            const eventSportUrl = this.payload.getMediaUrl(eventSport.pictogram);
            if (eventSportUrl) return eventSportUrl;

            if (parentSport?.pictogram) {
                const parentSportUrl = this.payload.getMediaUrl(parentSport.pictogram);
                if (parentSportUrl) return parentSportUrl;
            }
        }

        return null;
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
    }

    getVisibleDisciplines(group: EditionGroup): DisciplineGroup[] {
        const activeDiscipline = this.activeDisciplineId();
        if (activeDiscipline === 'all' || !this.hasSubDisciplineView()) {
            return group.disciplines;
        }
        return group.disciplines.filter(discipline => discipline.id === activeDiscipline);
    }

    goBack() {
        if (globalThis.history?.length > 1) {
            this.location.back();
            return;
        }

        const focusedEdition = this.focusedEditionSlug();
        if (focusedEdition) {
            this.router.navigateByUrl(`/history/${focusedEdition}`);
            return;
        }

        this.router.navigateByUrl('/history');
    }

    ngOnInit() {
        const sportSlug = this.route.snapshot.paramMap.get('sportname');
        const editionSlug = this.route.snapshot.queryParamMap.get('edition');

        if (editionSlug) {
            this.focusedEditionSlug.set(editionSlug);
        }

        if (sportSlug) {
            this.loadSportHistory(sportSlug);
        }
    }

    loadSportHistory(sportSlug: string) {
        // First get the sport details
        this.payload.getSportBySlug(sportSlug).subscribe(sport => {
            this.sport.set(sport);
            if (sport) {
                this.loadSportGoldenMoments(sport);
                forkJoin({
                    sports: this.payload.getSports(),
                    participations: this.payload.getParticipations({ limit: 5000 }),
                }).subscribe(({ sports, participations }) => {
                    this.sportsById.set(new Map(sports.map(item => [item.id, item])));
                    const filtered = participations.filter(participation => this.participationBelongsToSport(participation, sport));
                    this.participations.set(filtered);
                    this.selectedDisciplineId.set('all');
                    this.loading.set(false);
                });
            } else {
                this.loading.set(false);
            }
        });
    }

    loadSportGoldenMoments(sport: Sport) {
        this.payload.getGoldenMoments().subscribe(moments => {
            const filtered = moments.filter(moment => this.isMomentForSport(moment, sport))
                .sort((a, b) => b.year - a.year);
            this.goldenMoments.set(filtered);
        });
    }

    private isMomentForSport(moment: GoldenMoment, sport: Sport): boolean {
        if (!moment.sport || typeof moment.sport !== 'object') return false;

        const momentSport = moment.sport as Sport;
        if (momentSport.id === sport.id) return true;

        if (momentSport.parentSport && typeof momentSport.parentSport === 'object') {
            return (momentSport.parentSport as Sport).id === sport.id;
        }

        return false;
    }

    private participationBelongsToSport(participation: OlympicParticipation, selectedSport: Sport): boolean {
        if (typeof participation.event !== 'object' || !participation.event?.sport || typeof participation.event.sport !== 'object') {
            return false;
        }

        const eventSportRaw = participation.event.sport as Sport;
        const eventSport = this.resolveSportWithCatalog(eventSportRaw);
        if (!eventSport?.id) return false;
        if (eventSport.id === selectedSport.id) return true;
        if (this.getChildDisciplineIdsForSport(selectedSport.id).has(eventSport.id)) return true;

        const parentId = this.getParentSportId(eventSport);
        return parentId === selectedSport.id;
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
                pictogramUrl: this.payload.getMediaUrl(selectedSport?.pictogram),
            };
        }

        const eventSportRaw = participation.event.sport as Sport;
        const eventSport = this.resolveSportWithCatalog(eventSportRaw);
        if (!eventSport) {
            return {
                id: selectedSport?.id || 'unknown-discipline',
                name: selectedSport?.name || 'Discipline',
                slug: selectedSport?.slug || '',
                pictogramUrl: this.payload.getMediaUrl(selectedSport?.pictogram),
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
                        this.payload.getMediaUrl(inferredDiscipline.pictogram) ||
                        this.payload.getMediaUrl(eventSport.pictogram) ||
                        this.payload.getMediaUrl(parentSport?.pictogram),
                };
            }

            return {
                id: `${UNMAPPED_DISCIPLINE_PREFIX}${selectedSport!.id}`,
                name: 'Needs Mapping',
                slug: `${selectedSport!.slug}-needs-mapping`,
                pictogramUrl: this.payload.getMediaUrl(selectedSport?.pictogram),
            };
        }

        const isChildOfSelected = !!selectedSport && parentId === selectedSport.id;
        const disciplineSport = isChildOfSelected ? eventSport : (selectedSport || eventSport);

        return {
            id: disciplineSport.id || selectedSport?.id || 'unknown-discipline',
            name: disciplineSport.name || selectedSport?.name || 'Discipline',
            slug: disciplineSport.slug || selectedSport?.slug || '',
            pictogramUrl:
                this.payload.getMediaUrl(disciplineSport.pictogram) ||
                this.payload.getMediaUrl(eventSport.pictogram) ||
                this.payload.getMediaUrl(parentSport?.pictogram),
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

    private countParticipationEntries(groups: EditionGroup[], disciplineId: string): number {
        return groups.reduce((total, group) => {
            if (!this.hasSubDisciplineView()) {
                return total + group.athletes.length;
            }
            if (disciplineId === 'all') {
                return total + group.disciplines.reduce((disciplineTotal, discipline) => disciplineTotal + discipline.athletes.length, 0);
            }
            const discipline = group.disciplines.find(item => item.id === disciplineId);
            return total + (discipline ? discipline.athletes.length : 0);
        }, 0);
    }

    private countUniqueAthletes(editionIds: Set<string>, disciplineId: string): number {
        const athleteKeys = new Set<string>();
        if (editionIds.size === 0) return 0;

        this.participations().forEach(participation => {
            const editionId = this.getEditionId(participation);
            if (!editionId || !editionIds.has(editionId)) return;

            if (disciplineId !== 'all') {
                const participationDisciplineId = this.resolveDisciplineForParticipation(participation).id;
                if (participationDisciplineId !== disciplineId) return;
            }

            const athleteKey = this.getAthleteKey(participation);
            if (athleteKey) {
                athleteKeys.add(athleteKey);
            }
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
        const order = { gold: 0, silver: 1, bronze: 2, participated: 3 };
        const currentRank = order[current as keyof typeof order] ?? 3;
        const incomingRank = order[incoming as keyof typeof order] ?? 3;
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

}
