import { CommonModule } from "@angular/common";
import { Component, HostListener, OnInit, computed, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { Athlete, PayloadService, Sport } from "../services/payload.service";
import {
  CWG_2026_GAMES_KEY,
  CwgGamesParticipation,
  CwgScheduleData,
  CwgScheduleRow,
  getBoxingDraw,
  getParticipationAthlete,
  getParticipationAthleteName,
  getParticipationSport,
  getParticipationSportName,
  getParticipationSportSlug,
  getRoadToMedalImageUrl as resolveRoadToMedalImageUrl,
  getScheduleResultBadge,
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
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: "./cwg-2026-athletes.component.html",
  styleUrl: "./cwg-2026-athletes.component.scss",
})
export class Cwg2026AthletesComponent implements OnInit {
  private readonly payload = inject(PayloadService);

  readonly glasgowLogoUrl = "assets/images/cwg/glasgow-2026-logo-vertical.svg";

  readonly participations = signal<CwgGamesParticipation[]>([]);
  readonly scheduleRows = signal<CwgScheduleRow[]>([]);
  readonly activeSport = signal("all");
  readonly searchTerm = signal("");
  readonly isLoading = signal(true);
  readonly hasLoadError = signal(false);
  readonly selectedRoadToMedalRow = signal<CwgScheduleRow | null>(null);
  readonly isRoadToMedalImageLoaded = signal(false);
  readonly closedTooltipIds = signal<Set<string>>(new Set());

  readonly toggleTooltip = (id: string, event?: Event): void => {
    if (event && typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
    const current = new Set(this.closedTooltipIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.closedTooltipIds.set(current);
  };

  readonly isTooltipOpen = (id: string): boolean => {
    return !this.closedTooltipIds().has(id);
  };

  readonly orderedRows = computed(() => {
    return [...this.participations()].sort((a, b) => {
      // 1. Disqualified / Rejected / Withdrawn athletes in exact order:
      // Tejas Shirse (1) -> Arun Kumar (2) -> Dilbag Singh (3) -> Tulika Maan (4)
      const priorityA = this.getDisqualificationPriority(a);
      const priorityB = this.getDisqualificationPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;

      // 2. IOD Watch athletes always come next, sorted by their rank
      const aIsWatch = !!a.watchList?.isTenToWatch;
      const bIsWatch = !!b.watchList?.isTenToWatch;
      if (aIsWatch !== bIsWatch) return aIsWatch ? -1 : 1;
      if (aIsWatch && bIsWatch) {
        const rankA = a.watchList?.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.watchList?.rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
      }

      // 3. Then sort remaining by rosterOrder, then name
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
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
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

  readonly roadToMedalRowsByAthlete = computed(() => {
    const rows = new Map<string, CwgScheduleRow>();

    this.scheduleRows().forEach((row) => {
      const draw = getBoxingDraw(row);
      if (!draw || !resolveRoadToMedalImageUrl(row)) return;

      const names = [
        draw.indiaName,
        row.athletes,
        ...(row.athleteNames || []),
      ];

      names.flatMap((name) => this.getNameLookupKeys(name)).forEach((key) => {
        if (!rows.has(key)) rows.set(key, row);
      });
    });

    return rows;
  });

  readonly scheduleRowsByAthlete = computed(() => {
    const map = new Map<string, CwgScheduleRow[]>();

    this.scheduleRows().forEach((row) => {
      const names = [
        row.athletes,
        ...(row.athleteNames || []),
      ].filter(Boolean);

      const keys = names.flatMap((name) => this.getNameLookupKeys(name!));
      keys.forEach((key) => {
        const list = map.get(key) || [];
        list.push(row);
        map.set(key, list);
      });
    });

    return map;
  });

  getCountryFlag(code?: string): string {
    if (!code) return "🥊";
    const c = code.toUpperCase().trim();
    const map: Record<string, string> = {
      SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
      ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
      NIR: "🇬🇧",
      AUS: "🇦🇺",
      CAN: "🇨🇦",
      NZL: "🇳🇿",
      RSA: "🇿🇦",
      NGR: "🇳🇬",
      KEN: "🇰🇪",
      UGA: "🇺🇬",
      GHA: "🇬🇭",
      IND: "🇮🇳",
      PAK: "🇵🇰",
      SRI: "🇱🇰",
      BAN: "🇧🇩",
      MAS: "🇲🇾",
      SGP: "🇸🇬",
      FIJ: "🇫🇯",
      SAM: "🇼🇸",
    };
    return map[c] || "🥊";
  }

  getAthleteScheduleTimings(row: CwgGamesParticipation): {
    items: {
      id: string;
      displayLabel: string;
      opponentInfo?: string;
      dateLabel: string;
      timeLabel: string;
      isMedalSession: boolean;
      resultLabel?: string;
      status?: string;
    }[];
    totalCount: number;
  } {
    if (this.isDisqualified(row)) return { items: [], totalCount: 0 };

    const lookup = this.scheduleRowsByAthlete();
    const athlete = getParticipationAthlete(row);
    const names = [
      getParticipationAthleteName(row),
      row.sourceName,
      athlete?.fullName,
    ].filter(Boolean);

    let matches: CwgScheduleRow[] = [];

    for (const name of names) {
      for (const key of this.getNameLookupKeys(name!)) {
        const found = lookup.get(key);
        if (found?.length) {
          matches = found;
          break;
        }
      }
      if (matches.length) break;
    }

    // Deduplicate identical schedule rows by date, time, event, stage
    const seen = new Set<string>();
    const uniqueMatches: CwgScheduleRow[] = [];

    for (const sch of matches) {
      const date = sch.dateLabel || "";
      const time = sch.timeLabel || sch.indiaTimeLabel || "";
      const eventStr = sch.event || sch.eventName || sch.name || "";
      const stageStr = sch.stage || sch.phase || "";
      const key = `${date}|${time}|${eventStr}|${stageStr}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(sch);
      }
    }

    // Sort chronologically by sortKey / start time
    uniqueMatches.sort((a, b) => (a.sortKey || a.istStart || "").localeCompare(b.sortKey || b.istStart || ""));

    const totalCount = uniqueMatches.length;

    const items = uniqueMatches.slice(0, 4).map((sch, idx) => {
      const date = sch.dateLabel || "";
      const time = sch.timeLabel || sch.indiaTimeLabel || "";
      const isMedal = !!sch.isMedalSession;
      const resultBadge = getScheduleResultBadge(sch);

      let cleanResult = resultBadge?.label;
      if (cleanResult) {
        cleanResult = cleanResult
          .replace(/\s*\(Q\)/i, "")
          .replace(/\s*FINAL/i, "")
          .trim();
      }

      // Check Boxing draw / Opponent info
      const boxingDraw = getBoxingDraw(sch);
      let opponentInfo: string | undefined;
      let displayLabel = "";

      if (boxingDraw) {
        const roundName = boxingDraw.roundName || sch.stage || sch.phase || "";
        const rLower = roundName.toLowerCase();
        if (rLower.includes("32")) displayLabel = "R32";
        else if (rLower.includes("16")) displayLabel = "R16";
        else if (rLower.includes("quarter")) displayLabel = "Quarter-Final";
        else if (rLower.includes("semi")) displayLabel = "Semi-Final";
        else if (rLower.includes("final") || isMedal) displayLabel = "Final";
        else displayLabel = roundName || "Bout";

        const opponent = boxingDraw.confirmedOpponent;
        if (opponent?.displayName || opponent?.printName || opponent?.shortName) {
          const name = opponent.displayName || opponent.printName || opponent.shortName;
          const flag = this.getCountryFlag(opponent.countryCode);
          opponentInfo = `vs ${flag} ${name}`;
        } else if (boxingDraw.opponentStatus) {
          opponentInfo = `vs TBD (${boxingDraw.opponentStatus})`;
        }
      }

      if (!displayLabel) {
        const rawEvent = (sch.event || sch.eventName || sch.name || "").toLowerCase();
        const rawStage = (sch.stage || sch.phase || "").toLowerCase();
        const isMedal = !!sch.isMedalSession;

        if (rawEvent.includes("decathlon")) {
          if (rawEvent.includes("100m") || rawEvent.includes("long jump") || rawEvent.includes("shot put")) {
            displayLabel = "100m, LJ, SP";
          } else if (rawEvent.includes("high jump") || rawEvent.includes("400m")) {
            displayLabel = "HJ & 400m";
          } else if (rawEvent.includes("hurdles") || rawEvent.includes("discus") || rawEvent.includes("pole vault")) {
            displayLabel = "110mH, DT, PV";
          } else if (rawEvent.includes("javelin") || rawEvent.includes("1500m")) {
            displayLabel = "Javelin & 1500m";
          } else {
            displayLabel = isMedal ? "Decathlon Final" : "Decathlon";
          }
        } else {
          let eventPrefix = "";
          if (rawEvent.includes("100m hurdles") || rawEvent.includes("100mh")) eventPrefix = "100mH";
          else if (rawEvent.includes("110m hurdles") || rawEvent.includes("110mh")) eventPrefix = "110mH";
          else if (rawEvent.includes("400m hurdles") || rawEvent.includes("400mh")) eventPrefix = "400mH";
          else if (rawEvent.includes("100m")) eventPrefix = "100m";
          else if (rawEvent.includes("200m")) eventPrefix = "200m";
          else if (rawEvent.includes("400m")) eventPrefix = "400m";
          else if (rawEvent.includes("800m")) eventPrefix = "800m";
          else if (rawEvent.includes("1500m")) eventPrefix = "1500m";
          else if (rawEvent.includes("steeplechase") || rawEvent.includes("3000m")) eventPrefix = "3000m ST";
          else if (rawEvent.includes("5000m") || rawEvent.includes("5,000m")) eventPrefix = "5000m";
          else if (rawEvent.includes("10000m") || rawEvent.includes("10,000m")) eventPrefix = "10000m";
          else if (rawEvent.includes("high jump")) eventPrefix = "High Jump";
          else if (rawEvent.includes("long jump")) eventPrefix = "Long Jump";
          else if (rawEvent.includes("triple jump")) eventPrefix = "Triple Jump";
          else if (rawEvent.includes("pole vault")) eventPrefix = "Pole Vault";
          else if (rawEvent.includes("shot put")) eventPrefix = "Shot Put";
          else if (rawEvent.includes("javelin")) eventPrefix = "Javelin";
          else if (rawEvent.includes("discus")) eventPrefix = "Discus";
          else if (rawEvent.includes("hammer")) eventPrefix = "Hammer";
          else if (rawEvent.includes("singles")) eventPrefix = "Singles";
          else if (rawEvent.includes("doubles")) eventPrefix = "Doubles";
          else if (rawEvent.includes("pairs")) eventPrefix = "Pairs";

          let stageSuffix = "";
          if (rawStage.includes("heat") || rawStage.includes("round 1") || rawEvent.includes("heat")) {
            stageSuffix = "Heats";
          } else if (rawStage.includes("semi") || rawEvent.includes("semi")) {
            stageSuffix = "Semis";
          } else if (rawStage.includes("quarter") || rawEvent.includes("quarter")) {
            stageSuffix = "QF";
          } else if (rawStage.includes("sectional")) {
            stageSuffix = "Sectional";
          } else if (rawStage.includes("qualif") || rawEvent.includes("qualif")) {
            stageSuffix = "Q";
          } else if (rawStage.includes("final") || isMedal) {
            stageSuffix = "Final";
          } else {
            stageSuffix = sch.stage || "Session";
          }

          if (eventPrefix && stageSuffix) {
            displayLabel = `${eventPrefix} ${stageSuffix}`;
          } else if (eventPrefix) {
            displayLabel = eventPrefix;
          } else {
            displayLabel = stageSuffix;
          }
        }
      }

      return {
        id: sch.id || `sch-${idx}`,
        displayLabel,
        opponentInfo,
        dateLabel: date,
        timeLabel: time,
        isMedalSession: isMedal,
        resultLabel: cleanResult || undefined,
        status: sch.status || "scheduled",
      };
    });

    return { items, totalCount };
  }

  getAthleteScheduleTiming(row: CwgGamesParticipation): string | null {
    const res = this.getAthleteScheduleTimings(row);
    if (!res.items.length) return null;
    const first = res.items[0];
    const date = first.dateLabel;
    const time = first.timeLabel;
    return `${date}${date && time ? " • " : ""}${time}`.trim();
  }

  ngOnInit(): void {
    this.payload.getGamesHubSchedule<CwgScheduleData>(CWG_2026_GAMES_KEY).subscribe({
      next: (schedule) => this.scheduleRows.set(schedule?.rows || []),
      error: () => this.scheduleRows.set([]),
    });

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

  getRoadToMedalRow(row: CwgGamesParticipation): CwgScheduleRow | null {
    const lookup = this.roadToMedalRowsByAthlete();
    const athlete = getParticipationAthlete(row);
    const names = [
      getParticipationAthleteName(row),
      row.sourceName,
      athlete?.fullName,
    ];

    for (const key of names.flatMap((name) => this.getNameLookupKeys(name))) {
      const drawRow = lookup.get(key);
      if (drawRow) return drawRow;
    }

    return null;
  }

  getRoadToMedalImageUrl(row: CwgScheduleRow): string {
    return resolveRoadToMedalImageUrl(row);
  }

  getRoadToMedalTitle(row: CwgScheduleRow): string {
    return getBoxingDraw(row)?.eventDescription || row.event || "Road To Medal";
  }

  getAthleteEvent(row: CwgGamesParticipation): string {
    const rawEvent = row.eventName || row.eventBucket;
    const genericNames = [
      "Athletics", "Boxing", "Track Cycling", "Judo", "Lawn Bowls",
      "Swimming", "Weightlifting", "Para Athletics", "Wheelchair Basketball",
      "Para Powerlifting", "Para Swimming", "Para Track Cycling", "Artistic Gymnastics", "Gymnastics"
    ];
    if (rawEvent && !genericNames.includes(rawEvent.trim())) {
      return rawEvent.trim();
    }
    const athEvents = (row.athlete as any)?.meta?.cwg2026?.events;
    if (Array.isArray(athEvents) && athEvents[0] && !genericNames.includes(athEvents[0].trim())) {
      return athEvents[0].trim();
    }
    return rawEvent || getParticipationSportName(row);
  }

  getDisqualificationPriority(row: CwgGamesParticipation): number {
    const name = getParticipationAthleteName(row).toLowerCase();
    if (name.includes("tejas shirse") || name.includes("shirse tejas")) return 1;
    if (name.includes("arun kumar")) return 2;
    if (name.includes("dilbag singh") || name.includes("dilbagh singh")) return 3;
    if (name.includes("tulika maan")) return 4;
    if (this.isDisqualified(row)) return 5;
    return 999;
  }

  isDisqualified(row: CwgGamesParticipation): boolean {
    const status = (row.status || "").toLowerCase();
    const note = (row.publicNote || row.internalNotes || row.suspensionNote || "").toLowerCase();
    const name = getParticipationAthleteName(row).toLowerCase();
    return (
      status === "disqualified" ||
      status === "suspended" ||
      status === "rejected" ||
      status === "withdrawn" ||
      status === "dns" ||
      note.includes("anti-doping") ||
      note.includes("suspended") ||
      note.includes("rejected") ||
      name.includes("tejas shirse") ||
      name.includes("arun kumar") ||
      name.includes("dilbag singh") ||
      name.includes("dilbagh singh") ||
      name.includes("tulika maan") ||
      name.includes("chaitanya vishwas kulkarni") ||
      name.includes("chaitanya kulkarni")
    );
  }

  getDisqualificationBadgeLabel(row: CwgGamesParticipation): string {
    const name = getParticipationAthleteName(row).toLowerCase();
    if (name.includes("chaitanya")) return "DNS";
    if (name.includes("tejas shirse") || name.includes("shirse tejas")) return "REJECTED";
    if (name.includes("dilbag singh") || name.includes("dilbagh singh")) return "WITHDRAWN";
    return "DQed";
  }

  getDisqualificationNote(row: CwgGamesParticipation): string {
    const name = getParticipationAthleteName(row).toLowerCase();
    if (name.includes("chaitanya")) {
      return "Did Not Start (DNS) - Absent from official start list for scheduled competition event.";
    }
    if (name.includes("tejas shirse") || name.includes("shirse tejas")) {
      return "Entry rejected by CWG Organising Committee (OC) due to event quota allocation restrictions.";
    }
    if (name.includes("arun kumar")) {
      return "Provisionally suspended by NADA following an Adverse Analytical Finding (AAF) for Anabolic Steroids (Stanozolol).";
    }
    if (name.includes("dilbag singh") || name.includes("dilbagh singh")) {
      return "Withdrawn from CWG contingent following Indian weightlifting team quota reduction due to NADA anti-doping violations.";
    }
    if (name.includes("tulika maan")) {
      return "Provisionally suspended by NADA due to 3 Whereabouts Failures (missed tests/filing failures) within a 12-month period.";
    }
    if (row.publicNote?.trim()) return row.publicNote.trim();
    if (row.suspensionNote?.trim()) return row.suspensionNote.trim();
    return "Provisionally suspended from competition.";
  }

  openRoadToMedal(row: CwgScheduleRow): void {
    if (!this.getRoadToMedalImageUrl(row)) return;
    this.isRoadToMedalImageLoaded.set(false);
    this.selectedRoadToMedalRow.set(row);
  }

  readonly closeRoadToMedal = (): void => {
    if (this.selectedRoadToMedalRow) {
      this.selectedRoadToMedalRow.set(null);
    }
    if (this.isRoadToMedalImageLoaded) {
      this.isRoadToMedalImageLoaded.set(false);
    }
  };

  markRoadToMedalImageLoaded(): void {
    if (this.isRoadToMedalImageLoaded) {
      this.isRoadToMedalImageLoaded.set(true);
    }
  }

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (typeof this.closeRoadToMedal === "function") {
      this.closeRoadToMedal();
    }
  }

  getInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  private getNameLookupKeys(value?: string | null): string[] {
    const raw = String(value || "").toLowerCase();
    const normalized = raw.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

    if (!normalized || normalized === "india") return [];

    const keys = new Set([normalized]);
    const parts = normalized.split(" ").filter(Boolean);

    if (parts.length > 0) {
      if (parts[0].length >= 4 && !["women", "mens", "india", "team"].includes(parts[0])) {
        keys.add(parts[0]);
      }
      if (parts[parts.length - 1].length >= 4 && !["women", "mens", "india", "team"].includes(parts[parts.length - 1])) {
        keys.add(parts[parts.length - 1]);
      }
      if (parts.length > 2) {
        keys.add(`${parts[0]} ${parts[parts.length - 1]}`);
      }
    }

    const ALIAS_MAP: Record<string, string[]> = {
      'aadarsh ram': ['aadarsh ram jothi shankar', 'aadarsh ram'],
      'aadarsh ram jothi shankar': ['aadarsh ram jothi shankar', 'aadarsh ram'],
      'aditya pratap singh': ['aditya pratap yadav', 'aditya pratap singh'],
      'aditya pratap yadav': ['aditya pratap yadav', 'aditya pratap singh'],
      'aneesh s gowda': ['aneesh sunil kumar gowda', 'aneesh s gowda'],
      'aneesh sunil kumar gowda': ['aneesh sunil kumar gowda', 'aneesh s gowda'],
      'ashok kumar malik': ['ashok', 'ashok kumar malik'],
      'ashok': ['ashok kumar malik', 'ashok'],
      'bindyarani devi': ['bindyarani devi sorokhaibam', 'bindyarani devi'],
      'bindyarani devi sorokhaibam': ['bindyarani devi sorokhaibam', 'bindyarani devi'],
      'dev meena': ['dev kumar meena', 'dev meena'],
      'dev kumar meena': ['dev kumar meena', 'dev meena'],
      'eshitaa rewale': ['eshitaa sunil rewale', 'eshitaa rewale'],
      'eshitaa sunil rewale': ['eshitaa sunil rewale', 'eshitaa rewale'],
      'harshveer singh sekhon': ['sekhon harshveer singh', 'harshveer singh sekhon'],
      'sekhon harshveer singh': ['sekhon harshveer singh', 'harshveer singh sekhon'],
      'jadumani singh': ['jadumani singh mandengbam', 'jadumani singh'],
      'jadumani singh mandengbam': ['jadumani singh mandengbam', 'jadumani singh'],
      'k p swathish': ['kaitheri puthalath swathish', 'k p swathish'],
      'kaitheri puthalath swathish': ['kaitheri puthalath swathish', 'k p swathish'],
      'laxmi rayappa rayannavar': ['rayannavar laxmi rayappa', 'laxmi rayappa rayannavar'],
      'rayannavar laxmi rayappa': ['rayannavar laxmi rayappa', 'laxmi rayappa rayannavar'],
      'martina devi': ['martina devi maibam', 'martina devi'],
      'martina devi maibam': ['martina devi maibam', 'martina devi'],
      'minakshi jadhav': ['jadhav minakshi harichandra', 'minakshi jadhav'],
      'jadhav minakshi harichandra': ['jadhav minakshi harichandra', 'minakshi jadhav'],
      'mohammed basil m': ['mohammed basil morssinganakathi', 'mohammed basil m'],
      'mohammed basil morssinganakathi': ['mohammed basil morssinganakathi', 'mohammed basil m'],
      'narender berwal': ['narender', 'narender berwal'],
      'narender': ['narender berwal', 'narender'],
      'pinki singh': ['pinki', 'pinki singh'],
      'pinki': ['pinki singh', 'pinki'],
      'pooja singh': ['pooja', 'pooja singh'],
      'pooja': ['pooja singh', 'pooja'],
      'priya ghanghas': ['priya', 'priya ghanghas'],
      'priya': ['priya ghanghas', 'priya'],
      'ravina gaikwad': ['ravina', 'ravina gaikwad'],
      'ravina': ['ravina gaikwad', 'ravina'],
      'reena gupta': ['gupta reena rameshchandra', 'reena gupta'],
      'gupta reena rameshchandra': ['gupta reena rameshchandra', 'reena gupta'],
      'sachin siwach': ['sachin', 'sachin siwach'],
      'sachin': ['sachin siwach', 'sachin'],
      'sakshi choudhary': ['sakshi chaudhary', 'sakshi choudhary'],
      'sakshi chaudhary': ['sakshi chaudhary', 'sakshi choudhary'],
      'santhosh kumar': ['santhosh kumar t', 'santhosh kumar'],
      'santhosh kumar t': ['santhosh kumar t', 'santhosh kumar'],
      'selva prabhu': ['selva prabhu thirumaran', 'selva prabhu'],
      'selva prabhu thirumaran': ['selva prabhu thirumaran', 'selva prabhu'],
      'sharmila dhankar': ['sharmila', 'sharmila dhankar'],
      'sharmila': ['sharmila dhankar', 'sharmila'],
      'shilpa k shyla': ['shilpa kanchugarakoppalu shyla', 'shilpa k shyla'],
      'shilpa kanchugarakoppalu shyla': ['shilpa kanchugarakoppalu shyla', 'shilpa k shyla'],
      'shraddha chopade': ['shraddha kadubal chopade', 'shraddha chopade'],
      'shraddha kadubal chopade': ['shraddha kadubal chopade', 'shraddha chopade'],
      'soumen banerjee': ['dinesh kumar', 'soumen banerjee'],
      'dinesh kumar': ['dinesh kumar', 'soumen banerjee'],
      'sumit kundu': ['sumit', 'sumit kundu'],
      'sumit': ['sumit kundu', 'sumit'],
      'sunil bahadur': ['navneet singh', 'sunil bahadur'],
      'navneet singh': ['navneet singh', 'sunil bahadur'],
      'tapeswaranath das': ['das tapeswaranath', 'tapeswaranath das'],
      'das tapeswaranath': ['das tapeswaranath', 'tapeswaranath das'],
      'tejas shirse': ['tejas ashok shirse', 'tejas shirse'],
      'tejas ashok shirse': ['tejas ashok shirse', 'tejas shirse'],
      'vishal t k': ['vishal thennarasu kayalvizhi', 'vishal t k'],
      'vishal thennarasu kayalvizhi': ['vishal thennarasu kayalvizhi', 'vishal t k'],
      'yash ghanghas': ['yash ghangas', 'yash ghanghas'],
      'yash ghangas': ['yash ghangas', 'yash ghanghas'],
      'chaitanya vishwas kulkarni': ['chaitanya vishwas kulkarni', 'chaitanya kulkarni', 'chaitanya'],
      'chaitanya kulkarni': ['chaitanya vishwas kulkarni', 'chaitanya kulkarni', 'chaitanya'],
      'seram nirupama devi': ['nirupama devi', 'seram nirupama devi', 'nirupama'],
      'nirupama devi': ['nirupama devi', 'seram nirupama devi', 'nirupama'],
      'lovepreet singh': ['lovepreet singh', 'lovepreet'],
      'lovepreet': ['lovepreet singh', 'lovepreet'],
      'gulveer singh': ['gulveer singh', 'gulveer'],
      'gulveer': ['gulveer singh', 'gulveer'],
      'sanjana': ['sanjana', 'sanjan'],
      'sanjan': ['sanjana', 'sanjan'],
      'valluri ajaya babu': ['valluri ajaya babu', 'ajaya babu', 'valluri ajaya'],
      'kasthuri rajamani': ['kasthuri rajamani', 'kasthuri'],
      'parmjeet kumar': ['parmjeet kumar', 'parmjeet'],
      'jhandu kumar': ['jhandu kumar', 'jhandu'],
    };

    if (ALIAS_MAP[normalized]) {
      ALIAS_MAP[normalized].forEach((a) => keys.add(a));
    }

    return [...keys];
  }
}
