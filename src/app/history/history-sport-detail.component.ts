import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PayloadService, Sport, OlympicParticipation, Edition, Athlete, Event } from '../services/payload.service';
import { forkJoin } from 'rxjs';

interface AthleteEntry {
    name: string;
    events: string[];
    result: string;
    gender: 'men' | 'women' | 'mixed';
}

interface EditionGroup {
    edition: Edition;
    athletes: AthleteEntry[];
    menAthletes: AthleteEntry[];
    womenAthletes: AthleteEntry[];
    mixedAthletes: AthleteEntry[];
    medalCount: { gold: number; silver: number; bronze: number };
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

    sport = signal<Sport | null>(null);
    participations = signal<OlympicParticipation[]>([]);
    loading = signal(true);

    // Edition filter - when coming from an Edition page
    focusedEditionSlug = signal<string | null>(null);
    showFullHistory = signal(false);

    // Computed: Group participations by Edition
    editionGroups = computed<EditionGroup[]>(() => {
        const groups = new Map<string, EditionGroup>();

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
                    medalCount: { gold: 0, silver: 0, bronze: 0 }
                });
            }

            const group = groups.get(edition.id)!;
            const athleteName = this.getAthleteName(p);
            const eventName = this.getEventName(p);
            const result = p.result;
            const gender = this.getGenderFromEvent(eventName);

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

            // Count medals
            if (result === 'gold') group.medalCount.gold++;
            else if (result === 'silver') group.medalCount.silver++;
            else if (result === 'bronze') group.medalCount.bronze++;
        });

        // Sort by year descending
        return Array.from(groups.values()).sort((a, b) => b.edition.year - a.edition.year);
    });

    // Computed: Editions to display (filtered or all)
    displayedEditions = computed<EditionGroup[]>(() => {
        const all = this.editionGroups();
        const focusedSlug = this.focusedEditionSlug();

        // Show all if no focus or user toggled full history
        if (!focusedSlug || this.showFullHistory()) {
            return all;
        }

        // Show only the focused edition
        return all.filter(g => g.edition.slug === focusedSlug);
    });

    // Computed: Total stats (for displayed editions)
    totalMedals = computed(() => {
        let gold = 0, silver = 0, bronze = 0;
        this.displayedEditions().forEach(g => {
            gold += g.medalCount.gold;
            silver += g.medalCount.silver;
            bronze += g.medalCount.bronze;
        });
        return { gold, silver, bronze, total: gold + silver + bronze };
    });

    // Toggle full history view
    toggleFullHistory() {
        this.showFullHistory.set(!this.showFullHistory());
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
                // Fetch all participations and filter client-side by event's sport
                this.payload.getParticipations({ limit: 2000 }).subscribe(allParticipations => {
                    // Filter participations where event.sport matches the current sport
                    const filtered = allParticipations.filter(p => {
                        const event = p.event as Event;
                        if (!event?.sport) return false;
                        // event.sport can be an ID string or a Sport object
                        const sportId = typeof event.sport === 'object' ? (event.sport as Sport).id : event.sport;
                        return sportId === sport.id;
                    });
                    this.participations.set(filtered);
                    this.loading.set(false);
                });
            } else {
                this.loading.set(false);
            }
        });
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

    getPictogramUrl(): string | null {
        const sport = this.sport();
        if (!sport) return null;

        // Try sport pictogram
        const url = this.payload.getMediaUrl(sport.pictogram);
        if (url) return url;

        // Try parent sport pictogram (fallback)
        if (sport.parentSport?.pictogram) {
            return this.payload.getMediaUrl(sport.parentSport.pictogram);
        }

        return null; // Fallback to emoji in template
    }
}
