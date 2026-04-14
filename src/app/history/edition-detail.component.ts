import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { PayloadService, Edition, OlympicParticipation, Athlete, Event, GoldenMoment, MomentType } from '../services/payload.service';
import { environment } from '../../environments/environment';

interface SportGroup {
  sport: string;
  pictogramUrl: string | null;
  athletes: { name: string; events: string[]; result: string }[];
  medalCount: { gold: number; silver: number; bronze: number; total: number };
}

interface GroupedMedal {
  event: string;
  result: string;
  athletes: string[];
  isTeam: boolean;
  sport: string;
}

// Sport pictogram mapping
// Sport pictogram mapping is now dynamic via getPictogramUrl

@Component({
  selector: 'app-edition-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
  ],
  templateUrl: './edition-detail.component.html',
  styleUrls: ['./edition-detail.component.scss']
})
export class EditionDetailComponent implements OnInit {
  private payload = inject(PayloadService);
  private route = inject(ActivatedRoute);

  edition = signal<Edition | null>(null);
  participations = signal<OlympicParticipation[]>([]);
  allEditions = signal<Edition[]>([]);
  goldenMoments = signal<GoldenMoment[]>([]);
  loading = signal(true);

  // Get sport slug for routing
  getSportSlug(sportName: string): string {
    return sportName.toLowerCase().replace(/ /g, '-');
  }


  // Computed: Medals only (raw)
  medals = computed(() =>
    this.participations().filter(p => ['gold', 'silver', 'bronze'].includes(p.result))
  );

  // Grouped medals: Team events show as single entry
  // Grouped medals: Use event.type validation for reliable team identification
  groupedMedals = computed(() => {
    const raw = this.medals();
    const grouped = new Map<string, GroupedMedal>();

    raw.forEach(p => {
      const eventName = this.getEventName(p);
      const result = p.result;
      const eventType = (p.event as Event)?.type || 'individual';

      const key = `${eventName}-${result}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          event: eventName,
          result: result,
          athletes: [],
          isTeam: ['team', 'doubles', 'relay', 'pairs'].includes(eventType.toLowerCase()),
          sport: this.getSportName(p)
        });
      }

      const group = grouped.get(key)!;
      group.athletes.push(this.getAthleteName(p));
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const order = { gold: 0, silver: 1, bronze: 2 };
      return (order[a.result as keyof typeof order] || 3) - (order[b.result as keyof typeof order] || 3);
    });
  });



  // Medal counts
  // Medal counts (based on grouped events, so Team Gold = 1 medal)
  goldCount = computed(() => this.groupedMedals().filter(m => m.result === 'gold').length);
  silverCount = computed(() => this.groupedMedals().filter(m => m.result === 'silver').length);
  bronzeCount = computed(() => this.groupedMedals().filter(m => m.result === 'bronze').length);

  // Edition nav items for the navigation rail
  editionNavItems = computed(() => {
    return this.allEditions()
      .filter(e => e.year && e.year < 2028)
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  });

  // Flat list of moments sorted by type: Gold -> Silver -> Bronze -> Heartbreak
  sortedMoments = computed(() => {
    const tierOrder: Record<MomentType, number> = {
      'gold': 0,
      'silver': 1,
      'bronze': 2,
      'heartbreak': 3
    };

    return [...this.goldenMoments()].sort((a, b) => {
      return (tierOrder[a.type || 'gold'] ?? 99) - (tierOrder[b.type || 'gold'] ?? 99);
    });
  });

  // Computed: Group by Sport
  // Group by Sport with Athlete De-duplication
  sportGroups = computed<SportGroup[]>(() => {
    const groups = new Map<string, {
      sport: string;
      pictogramUrl: string | null;
      medalCount: { gold: number; silver: number; bronze: number; total: number };
      countedMedals: Set<string>; // "eventName-result" dedup key
      // Map athleteName -> aggregated entry
      athleteMap: Map<string, { name: string; events: Set<string>; results: Set<string> }>;
    }>();

    this.participations().forEach(p => {
      const sportName = this.getSportName(p);
      const athleteName = this.getAthleteName(p);
      const eventName = this.getEventName(p);
      const result = p.result;

      if (!groups.has(sportName)) {
        groups.set(sportName, {
          sport: sportName,
          pictogramUrl: this.getPictogramFromParticipation(p),
          medalCount: { gold: 0, silver: 0, bronze: 0, total: 0 },
          countedMedals: new Set(),
          athleteMap: new Map()
        });
      }

      const group = groups.get(sportName)!;

      // Update pictogram if missing (in case first entry didn't have it)
      if (!group.pictogramUrl) {
        group.pictogramUrl = this.getPictogramFromParticipation(p);
      }

      // Handle Athlete De-duplication
      if (!group.athleteMap.has(athleteName)) {
        group.athleteMap.set(athleteName, {
          name: athleteName,
          events: new Set(),
          results: new Set()
        });
      }

      const athleteEntry = group.athleteMap.get(athleteName)!;
      athleteEntry.events.add(eventName);
      if (result && result !== 'participated') {
        athleteEntry.results.add(result);
      }

      // Count medals — deduplicate by event+result (team sports = 1 medal per event)
      if (['gold', 'silver', 'bronze'].includes(result)) {
        const medalKey = `${eventName}-${result}`;
        if (!group.countedMedals.has(medalKey)) {
          group.countedMedals.add(medalKey);
          if (result === 'gold') group.medalCount.gold++;
          else if (result === 'silver') group.medalCount.silver++;
          else if (result === 'bronze') group.medalCount.bronze++;
          group.medalCount.total++;
        }
      }
    });

    // Convert to array and sort
    return Array.from(groups.values()).map(g => ({
      sport: g.sport,
      pictogramUrl: g.pictogramUrl,
      medalCount: g.medalCount,
      athletes: Array.from(g.athleteMap.values()).map(a => ({
        name: a.name,
        events: Array.from(a.events), // unique events
        // Determine best result to display (e.g. if Gold & Silver, show Gold)
        result: this.getBestResult(Array.from(a.results)) || 'participated'
      }))
    })).sort((a, b) => {
      // Sort by medal hierarchy: gold > silver > bronze > none
      const tierA = a.medalCount.gold > 0 ? 0 : a.medalCount.silver > 0 ? 1 : a.medalCount.bronze > 0 ? 2 : 3;
      const tierB = b.medalCount.gold > 0 ? 0 : b.medalCount.silver > 0 ? 1 : b.medalCount.bronze > 0 ? 2 : 3;
      if (tierA !== tierB) return tierA - tierB;
      // Within same tier, sort by total medals desc
      if (a.medalCount.total !== b.medalCount.total) return b.medalCount.total - a.medalCount.total;
      return a.sport.localeCompare(b.sport);
    });
  });

  // Helper to determine best result from a set of results
  private getBestResult(results: string[]): string {
    if (results.includes('gold')) return 'gold';
    if (results.includes('silver')) return 'silver';
    if (results.includes('bronze')) return 'bronze';
    return '';
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadEdition(slug);
      }
    });

    // Load all editions for navigation rail
    this.payload.getEditions().subscribe(editions => {
      this.allEditions.set(editions);
    });
  }

  loadEdition(slug: string) {
    this.payload.getEditionBySlug(slug).subscribe(edition => {
      this.edition.set(edition);
      if (edition) {
        this.loadParticipations(edition.id);
        if (edition.year) {
          this.loadEditionMoments(edition.year);
        }
      } else {
        this.loading.set(false);
      }
    });
  }

  loadParticipations(editionId: string) {
    this.payload.getParticipations({ editionId }).subscribe(participations => {
      this.participations.set(participations);
      this.loading.set(false);
    });
  }

  loadEditionMoments(year: number) {
    this.payload.getGoldenMomentsByYear(year).subscribe(moments => {
      this.goldenMoments.set(moments);
    });
  }

  getLogoUrl(): string {
    const logo = this.edition()?.logo;
    if (logo?.url) {
      return this.payload.getMediaUrl(logo) || '';
    }
    return '';
  }

  getHeroImageUrl(): string {
    const heroImage = this.edition()?.heroImage;
    if (heroImage?.url) {
      return this.payload.getMediaUrl(heroImage) || '';
    }
    return '';
  }

  getEditionGradient(): string {
    const colors = this.edition()?.colors as any;
    if (colors?.primary && colors?.secondary) {
      return `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
    }
    return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
  }

  formatDateRange(start?: string, end?: string): string {
    if (!start) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const s = new Date(start);
    const sMonth = months[s.getMonth()];
    const sDay = s.getDate();
    const sYear = s.getFullYear();

    if (!end) return `${sMonth} ${sDay}, ${sYear}`;

    const e = new Date(end);
    const eMonth = months[e.getMonth()];
    const eDay = e.getDate();
    const eYear = e.getFullYear();

    if (sMonth === eMonth && sYear === eYear) {
      return `${sMonth} ${sDay} – ${eDay}, ${sYear}`;
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
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

  getSportName(p: OlympicParticipation): string {
    if (typeof p.event === 'object' && p.event) {
      const event = p.event as Event;
      // Try to get sport from event structure
      if (typeof event.sport === 'object' && event.sport?.name) {
        return event.sport.name;
      }
      // Fallback: Extract from event name (e.g., "Hockey - Men's Team")
      const name = event.name || '';
      if (name.includes(' - ')) return name.split(' - ')[0];
      if (name.includes(' ')) return name.split(' ')[0];
      return name || 'Other';
    }
    return 'Other';
  }

  // Helper to extract sport pictogram URL from participation
  getPictogramFromParticipation(p: OlympicParticipation): string | null {
    if (typeof p.event === 'object' && p.event?.sport) {
      const sport = p.event.sport as any; // Cast to access nested fields
      const url = this.payload.getSportPictogramUrl({
        sport,
        includePlaceholderFallback: false,
      });
      if (url) return url;
    }
    return null;
  }

  getMedalEmoji(result: string): string {
    switch (result) {
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      case 'bronze': return '🥉';
      default: return '';
    }
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
