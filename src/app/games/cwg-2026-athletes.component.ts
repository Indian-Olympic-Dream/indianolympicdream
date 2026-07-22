import { CommonModule } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { Athlete, PayloadService, Sport } from "../services/payload.service";
import {
  CWG_2026_GAMES_KEY,
  CwgGamesParticipation,
  getParticipationAthlete,
  getParticipationAthleteName,
  getParticipationSport,
  getParticipationSportName,
  getParticipationSportSlug,
} from "./cwg-2026.types";

interface SportNavItem {
  key: string;
  label: string;
  count: number;
  pictogramUrl: string | null;
  isPara: boolean;
}

interface SportNavAccumulator extends SportNavItem {
  firstOrder: number;
}

@Component({
  selector: "app-cwg-2026-athletes",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: "./cwg-2026-athletes.component.html",
  styleUrl: "./cwg-2026-athletes.component.scss",
})
export class Cwg2026AthletesComponent implements OnInit {
  private readonly payload = inject(PayloadService);

  readonly glasgowLogoUrl = "assets/images/cwg/glasgow-2026-logo-vertical.svg";

  readonly participations = signal<CwgGamesParticipation[]>([]);
  readonly activeSport = signal("all");
  readonly searchTerm = signal("");
  readonly isLoading = signal(true);
  readonly hasLoadError = signal(false);

  readonly orderedRows = computed(() => {
    return [...this.participations()].sort((a, b) => {
      // IOD Watch athletes always come first, sorted by their rank
      const aIsWatch = !!a.watchList?.isTenToWatch;
      const bIsWatch = !!b.watchList?.isTenToWatch;
      if (aIsWatch !== bIsWatch) return aIsWatch ? -1 : 1;
      if (aIsWatch && bIsWatch) {
        const rankA = a.watchList?.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.watchList?.rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
      }
      // Then sort remaining by rosterOrder, then name
      const orderA = a.rosterOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.rosterOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return getParticipationAthleteName(a).localeCompare(getParticipationAthleteName(b));
    });
  });

  readonly sportNavItems = computed<SportNavItem[]>(() => {
    const counts = new Map<string, SportNavAccumulator>();

    this.orderedRows().forEach((row) => {
      const sport = getParticipationSport(row);
      const key = getParticipationSportSlug(row);
      const label = getParticipationSportName(row);
      const current = counts.get(key);
      const firstOrder = row.rosterOrder ?? Number.MAX_SAFE_INTEGER;
      const pictogramUrl = sport
        ? this.payload.getSportPictogramUrl({ sport: sport as Sport, includePlaceholderFallback: false })
        : null;

      if (current) {
        current.count += 1;
        current.isPara = current.isPara || row.competitionStream === "para" || !!row.isPara;
        current.firstOrder = Math.min(current.firstOrder, firstOrder);
        if (!current.pictogramUrl && pictogramUrl) {
          current.pictogramUrl = pictogramUrl;
        }
        return;
      }

      counts.set(key, {
        key,
        label,
        count: 1,
        pictogramUrl,
        isPara: row.competitionStream === "para" || !!row.isPara,
        firstOrder,
      });
    });

    const sports = [...counts.values()]
      .sort((a, b) => a.firstOrder - b.firstOrder || a.label.localeCompare(b.label))
      .map(({ key, label, count, pictogramUrl, isPara }) => ({ key, label, count, pictogramUrl, isPara }));

    return [
      {
        key: "all",
        label: "All",
        count: this.orderedRows().length,
        pictogramUrl: null,
        isPara: false,
      },
      ...sports,
    ];
  });

  readonly filteredRows = computed(() => {
    const sport = this.activeSport();
    const search = this.searchTerm().trim().toLowerCase();

    return this.orderedRows().filter((row) => {
      const sportKey = getParticipationSportSlug(row);
      const matchesSport = sport === "all" || sportKey === sport;
      const haystack = [
        getParticipationAthleteName(row),
        row.sourceName,
        row.eventName,
        getParticipationSportName(row),
        row.watchList?.groupTitle,
      ].join(" ").toLowerCase();
      return matchesSport && (!search || haystack.includes(search));
    });
  });

  readonly overview = computed(() => {
    const rows = this.participations();
    return {
      total: rows.length,
      able: rows.filter((row) => row.competitionStream === "able-bodied").length,
      para: rows.filter((row) => row.competitionStream === "para").length,
      watch: rows.filter((row) => row.watchList?.isTenToWatch).length,
    };
  });

  ngOnInit(): void {
    this.payload.getGamesParticipations(CWG_2026_GAMES_KEY).subscribe({
      next: (response) => {
        this.participations.set(response.docs || []);
        this.isLoading.set(false);
        this.hasLoadError.set(false);
      },
      error: () => {
        this.participations.set([]);
        this.isLoading.set(false);
        this.hasLoadError.set(true);
      },
    });
  }

  setActiveSport(value: string): void {
    this.activeSport.set(value || "all");
  }

  setSearch(value: string): void {
    this.searchTerm.set(value);
  }

  trackBySport(_: number, sport: SportNavItem): string {
    return sport.key;
  }

  trackByParticipation(_: number, participation: CwgGamesParticipation): string {
    return participation.id;
  }

  getAthleteName(row: CwgGamesParticipation): string {
    return getParticipationAthleteName(row);
  }

  getSportName(row: CwgGamesParticipation): string {
    return getParticipationSportName(row);
  }

  getAthleteImageUrl(row: CwgGamesParticipation): string | null {
    const athlete = getParticipationAthlete(row);
    return athlete?.photo ? this.payload.getAthleteImageUrl(athlete as Athlete) : null;
  }

  getSportPictogramUrl(row: CwgGamesParticipation): string | null {
    const sport = getParticipationSport(row);
    return sport ? this.payload.getSportPictogramUrl({ sport: sport as Sport, includePlaceholderFallback: false }) : null;
  }

  getCompetitionContext(row: CwgGamesParticipation): string {
    return row.competitionStream === "para" || row.isPara ? "Para India" : "India";
  }

  getInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }
}
