import { CommonModule } from "@angular/common";
import { Component, NgZone, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { PayloadService, Sport } from "../services/payload.service";
import { Cwg2026ResultDetailComponent } from "./cwg-2026-result-detail.component";
import {
  CWG_2026_GAMES_KEY,
  CwgCompetitionStream,
  CwgGamesParticipation,
  CwgScheduleData,
  CwgScheduleRow,
  getBoxingCompetitorName,
  getBoxingDraw,
  getBoxingEventTitle,
  getBoxingOpponentLabel as resolveBoxingOpponentLabel,
  getParticipationAthleteName,
  getParticipationSport,
  getParticipationSportName,
  getScheduleResultBadge,
  getScheduleResultSummary,
  isScheduleRowLiveNow,
  getCountryFlagEmoji,
  parseCwgScheduleTimestamp,
  cleanCwgEventTitle,
} from "./cwg-2026.types";

interface ScheduleDateGroup {
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  sessionCount: number;
  goldCount: number;
  rows: CwgScheduleRow[];
}

interface TimelineGroup {
  id: string;
  startMs: number;
  endMs: number;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  rows: CwgScheduleRow[];
  isLive: boolean;
  hasMedal: boolean;
}

interface MedalTally {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

interface MedalWinner {
  id: string;
  type: "gold" | "silver" | "bronze";
  athleteName: string;
  result?: string;
  sport: string;
  event: string;
  row: CwgScheduleRow;
}

type SportResultView = "all" | "medals" | "wins" | "gold" | "silver" | "bronze";
type SportDivisionFilter = "all" | "men" | "women" | "mixed";

@Component({
  selector: "app-cwg-2026-home",
  standalone: true,
  imports: [CommonModule, RouterModule, Cwg2026ResultDetailComponent],
  templateUrl: "./cwg-2026-home.component.html",
  styleUrl: "./cwg-2026-home.component.scss",
})
export class Cwg2026HomeComponent implements OnInit, OnDestroy {
  private readonly payload = inject(PayloadService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private clockTimer?: ReturnType<typeof setInterval>;
  private scheduleRefreshTimer?: ReturnType<typeof setInterval>;
  private scheduleRequestInFlight = false;

  readonly medalIconUrl = "assets/images/cwg/glasgow-gold-medal.svg";
  readonly silverMedalIconUrl = "assets/images/cwg/glasgow-silver-medal.svg";
  readonly bronzeMedalIconUrl = "assets/images/cwg/glasgow-bronze-medal.svg";
  readonly glasgowLogoUrl = "assets/images/cwg/glasgow-2026-logo-vertical.svg";
  readonly participations = signal<CwgGamesParticipation[]>([]);
  readonly scheduleData = signal<CwgScheduleData>({
    gamesDates: "23 July–2 August 2026",
    timezone: "IST",
    scheduleEdition: "Glasgow 2026 Schedule",
    rows: [],
  });
  readonly now = signal(new Date());
  readonly selectedSessionRow = signal<CwgScheduleRow | null>(null);
  readonly isLiveSessionsDialogOpen = signal(false);
  readonly isRosterLoading = signal(true);
  readonly hasRosterError = signal(false);
  readonly isScheduleLoading = signal(true);
  readonly hasScheduleError = signal(false);
  readonly selectedMedalStream = signal<CwgCompetitionStream>("all");
  readonly selectedMedalSport = signal<string>("all");
  readonly selectedReportTab = signal<"sports" | "road-ahead">("sports");
  readonly selectedSportFilter = signal<string>("all");
  readonly selectedSportDivision = signal<SportDivisionFilter>("all");
  readonly selectedSportResultView = signal<SportResultView>("all");
  readonly sportResultSearch = signal("");
  readonly isSportResultsDialogOpen = signal(false);
  readonly indiaRank = signal<number | null>(null);
  readonly isMedalWinnersDialogOpen = signal(false);
  readonly resultOpenedFromMedalWinners = signal(false);
  readonly medalStreamFilters: ReadonlyArray<{ key: CwgCompetitionStream; label: string }> = [
    { key: "all", label: "All" },
    { key: "able-bodied", label: "Able-bodied" },
    { key: "para", label: "Para" },
  ];

  readonly sportReportCards = [
    { sport: "Boxing", roster: 14, g: 7, s: 3, b: 0, total: 10, productivity: 71.4, tier: "Medal engine", tierClass: "engine", signal: "Outstanding conversion: 7 titles from 10 finals. Asian/World fields add absent elite powers." },
    { sport: "Para Athletics", roster: 11, g: 3, s: 2, b: 1, total: 6, productivity: 54.5, tier: "Medal engine", tierClass: "engine", signal: "Strongest gold conversion outside Boxing; retain classification-specific benchmarks." },
    { sport: "Weightlifting", roster: 12, g: 1, s: 6, b: 1, total: 8, productivity: 66.7, tier: "Productive, ceiling gap", tierClass: "productive", signal: "Broad podium depth (8 medals), but 6 silvers highlight first-place conversion gap." },
    { sport: "Athletics", roster: 32, g: 0, s: 5, b: 5, total: 10, productivity: 31.3, tier: "Productive, ceiling gap", tierClass: "productive", signal: "10 medals without gold; credible depth in jumps/throws, insufficient winning conversion." },
    { sport: "Judo", roster: 14, g: 2, s: 1, b: 1, total: 4, productivity: 28.6, tier: "Selective strength", tierClass: "selective", signal: "High top-end quality (2 golds), but only 4 medals across a large roster." },
    { sport: "Para Powerlifting", roster: 7, g: 0, s: 0, b: 1, total: 1, productivity: 14.3, tier: "Isolated podium", tierClass: "isolated", signal: "A foothold podium (1 bronze) rather than a repeatable medal pipeline." },
    { sport: "Artistic Gymnastics", roster: 8, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Finalist pathway", tierClass: "finalist", signal: "Finals exposure gained, but no podium conversion in a Commonwealth field." },
    { sport: "Lawn Bowls", roster: 6, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Development gap", tierClass: "gap", signal: "No knockout-to-medal conversion despite direct CWG relevance." },
    { sport: "Swimming", roster: 5, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Development gap", tierClass: "gap", signal: "No medal in a field led by globally deep Australia, England and Canada." },
    { sport: "Para Swimming", roster: 6, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Development gap", tierClass: "gap", signal: "Entry, classification and progression reliability require structural attention." },
    { sport: "Track Cycling", roster: 6, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Development gap", tierClass: "gap", signal: "No medal-round conversion; timed-event gap remains visible." },
    { sport: "Para Track Cycling", roster: 1, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Finalist pathway", tierClass: "finalist", signal: "Lisha Das placed 6th in C4-C5 1000m TT (25.649s behind gold)." },
    { sport: "Wheelchair Basketball", roster: 4, g: 0, s: 0, b: 0, total: 0, productivity: 0.0, tier: "Development gap", tierClass: "gap", signal: "Small roster gained exposure but did not create a medal path." }
  ];

  readonly roadAhead = [
    { id: "bwf", title: "BWF World Championships", date: "2026", sport: "Badminton", copy: "Badminton World Federation flagship global event. Track world rankings, head-to-head records, draw seeds, and round-by-round match scores for India's shuttlers.", cwgContext: "BWF World Championship baseline" },
    { id: "world-boxing", title: "World Boxing Championships", date: "2026", sport: "Boxing", copy: "India's 7 CWG boxing golds face the global test. Reuse draw progression, opponent quality tracking, and round-by-round bout scores from the CWG hub. Key champions: Jaismine Lamboria (57kg), Sachin (60kg), Ankush (80kg).", cwgContext: "7 golds, 10 medals, 71.4% productivity" },
    { id: "asian-wl", title: "Asian Games — Weightlifting", date: "2027", sport: "Weightlifting", copy: "6 silvers and 1 gold from Glasgow show India consistently reached the podium but not the top step. Asian Games add China, Japan, and South Korea—calibrate expectations. Need attempt-by-attempt lift data, bodyweight categories, and real-time projected totals.", cwgContext: "1 gold, 6 silvers — clear ceiling gap" },
    { id: "asian-ath", title: "Asian Games — Athletics & Para Athletics", date: "2027", sport: "Athletics", copy: "Combined 16 medals at CWG (3 Para golds). Neeraj Chopra (Silver, 85.83m javelin) and Gulveer Singh (Silver 10,000m + Bronze 5,000m) lead the charge. Track personal bests vs world/Asian championship standards. Para Athletics (54.5% productivity) is India's most efficient medal converter.", cwgContext: "16 combined medals, 0 able-bodied golds" },
    { id: "la2028", title: "LA 2028 Olympic Qualification", date: "2028", sport: "Multi-sport", copy: "Long-horizon qualification tracking for all sports. Swimming, Cycling, and Gymnastics remain world-gap sports (0 medals from 26 roster places). Track PB rates, gap-to-medal, and qualification standards before making medal predictions.", cwgContext: "7 sports with 0 medals at CWG" },
  ];

  setReportTab(tab: "sports" | "road-ahead"): void {
    this.selectedReportTab.set(tab);
  }

  openSportResults(sport: string): void {
    this.selectedSportFilter.set(sport);
    this.selectedSportResultView.set("all");
    this.sportResultSearch.set("");
    this.isSportResultsDialogOpen.set(true);
  }

  closeSportResults(): void {
    this.isSportResultsDialogOpen.set(false);
  }

  closeSportResultsDialog(): void {
    this.closeSportResults();
  }

  setSportDivision(division: SportDivisionFilter): void {
    this.selectedSportDivision.set(division);
  }

  setSportResultView(view: SportResultView): void {
    this.selectedSportResultView.set(view);
  }

  readonly activeSignalSport = signal<string | null>(null);

  toggleSignalTooltip(sport: string, event: Event): void {
    event.stopPropagation();
    if (this.activeSignalSport() === sport) {
      this.activeSignalSport.set(null);
    } else {
      this.activeSignalSport.set(sport);
    }
  }

  setSportResultSearch(value: string): void {
    this.sportResultSearch.set(value);
  }

  readonly scheduleRows = computed(() =>
    [...this.scheduleData().rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
  );

  readonly activeScheduleRows = computed(() => this.scheduleRows().filter((row) => !row.isEliminated));

  readonly medalTally = computed<MedalTally>(() => {
    const selectedStream = this.selectedMedalStream();
    const medalTypes = this.scheduleRows()
      .filter((row) =>
        selectedStream === "all"
          ? true
          : this.getScheduleCompetitionStream(row) === selectedStream,
      )
      .flatMap((row) => this.getResultMedalTypes(row));
    const gold = medalTypes.filter((type) => type === "gold").length;
    const silver = medalTypes.filter((type) => type === "silver").length;
    const bronze = medalTypes.filter((type) => type === "bronze").length;

    return {
      gold,
      silver,
      bronze,
      total: gold + silver + bronze,
    };
  });

  readonly medalStreamLabel = computed(() => {
    if (this.selectedMedalStream() === "able-bodied") return "Able-bodied";
    if (this.selectedMedalStream() === "para") return "Para";
    return "All events";
  });

  readonly medalWinners = computed<MedalWinner[]>(() => {
    const selectedStream = this.selectedMedalStream();
    const medalOrder = { gold: 0, silver: 1, bronze: 2 };

    return this.scheduleRows()
      .filter((row) => row.status === "completed" && Boolean(row.result))
      .filter((row) =>
        selectedStream === "all"
          ? true
          : this.getScheduleCompetitionStream(row) === selectedStream,
      )
      .flatMap((row) => {
        const structuredMedals = row.result?.medals || [];
        if (structuredMedals.length) {
          return structuredMedals.map((medal, index) => ({
            id: `${row.id}:${medal.type}:${medal.athleteName || index}`,
            type: medal.type,
            athleteName: medal.athleteName || row.athletes || "India",
            result: medal.result,
            sport: row.sport,
            event: row.event,
            row,
          }));
        }

        const competitor = row.result?.match?.competitor1;
        return this.getResultMedalTypes(row).map((type, index) => ({
          id: `${row.id}:${type}:legacy-${index}`,
          type,
          athleteName: competitor?.name || row.athletes || "India",
          result: competitor?.totalScore != null ? String(competitor.totalScore) : undefined,
          sport: row.sport,
          event: row.event,
          row,
        }));
      })
      .sort(
        (a, b) =>
          medalOrder[a.type] - medalOrder[b.type] ||
          b.row.sortKey.localeCompare(a.row.sortKey) ||
          a.athleteName.localeCompare(b.athleteName),
      );
  });

  readonly selectedMedalType = signal<"all" | "gold" | "silver" | "bronze">("all");

  readonly medalTypeTitleLabel = computed(() => {
    const type = this.selectedMedalType();
    if (type === "gold") return "India’s Gold Medal Winners";
    if (type === "silver") return "India’s Silver Medal Winners";
    if (type === "bronze") return "India’s Bronze Medal Winners";
    return "India’s Medal Winners";
  });

  readonly medalSportFilters = computed(() => {
    const selectedType = this.selectedMedalType();
    const filteredTypeWinners = selectedType === "all"
      ? this.medalWinners()
      : this.medalWinners().filter((w) => w.type === selectedType);

    const counts = new Map<string, number>();
    filteredTypeWinners.forEach((winner) => {
      counts.set(winner.sport, (counts.get(winner.sport) || 0) + 1);
    });

    return [
      { key: "all", label: "All sports", count: filteredTypeWinners.length },
      ...[...counts.entries()]
        .sort(([leftSport, leftCount], [rightSport, rightCount]) =>
          rightCount - leftCount || leftSport.localeCompare(rightSport),
        )
        .map(([sport, count]) => ({ key: sport, label: sport, count })),
    ];
  });

  readonly visibleMedalWinners = computed(() => {
    const selectedSport = this.selectedMedalSport();
    const selectedType = this.selectedMedalType();
    let winners = this.medalWinners();
    if (selectedSport !== "all") {
      winners = winners.filter((w) => w.sport === selectedSport);
    }
    if (selectedType !== "all") {
      winners = winners.filter((w) => w.type === selectedType);
    }
    return winners;
  });

  readonly declaredResults = computed(() =>
    this.activeScheduleRows()
      .filter((row) => this.isDeclaredResultRow(row))
      .sort((a, b) => this.getSessionStartMs(b) - this.getSessionStartMs(a))
      .map((row) => ({
        row,
        summary: getScheduleResultSummary(row),
        badge: getScheduleResultBadge(row),
      })),
  );

  readonly availableSportDivisions = computed(() => {
    const filter = this.selectedSportFilter();
    const normalizedFilter = filter.toLowerCase();
    const rows = this.declaredResults().filter(
      (item) => filter === "all" || item.row.sport.toLowerCase() === normalizedFilter,
    );

    const hasMen = rows.some((item) => {
      const ev = (item.row.event || "").toLowerCase();
      return ev.includes("men") && !ev.includes("women");
    });
    const hasWomen = rows.some((item) => (item.row.event || "").toLowerCase().includes("women"));
    const hasMixed = rows.some((item) => (item.row.event || "").toLowerCase().includes("mixed"));

    return { hasMen, hasWomen, hasMixed };
  });

  hasMedalColor(item: any, color: "gold" | "silver" | "bronze"): boolean {
    if (!item) return false;
    const target = color.toUpperCase();
    const label = (item.badge?.label || "").toUpperCase();
    const summary = (item.summary || "").toUpperCase();
    if (label.includes(target) || summary.includes(target)) return true;

    if (item.row) {
      const medalTypes = this.getResultMedalTypes(item.row);
      if (medalTypes.includes(color)) return true;
      if (item.row.result?.medals?.some((m: any) => m.type === color)) return true;
    }
    return false;
  }

  readonly availableSportMedalViews = computed(() => {
    const filter = this.selectedSportFilter();
    const normalizedFilter = filter.toLowerCase();
    const rows = this.declaredResults().filter(
      (item) => filter === "all" || item.row.sport.toLowerCase() === normalizedFilter,
    );

    const hasGold = rows.some((item) => this.hasMedalColor(item, "gold"));
    const hasSilver = rows.some((item) => this.hasMedalColor(item, "silver"));
    const hasBronze = rows.some((item) => this.hasMedalColor(item, "bronze"));

    return { hasGold, hasSilver, hasBronze };
  });

  getItemMedalIconType(item: any): 'gold' | 'silver' | 'bronze' | 'pictogram' {
    if (!item) return 'pictogram';
    const label = (item.badge?.label || '').toUpperCase();
    const summary = (item.summary || '').toUpperCase();
    const medalTypes = item.row ? this.getResultMedalTypes(item.row) : [];

    if (label.includes('GOLD') || summary.includes('GOLD') || medalTypes.includes('gold')) return 'gold';
    if (label.includes('SILVER') || summary.includes('SILVER') || medalTypes.includes('silver')) return 'silver';
    if (label.includes('BRONZE') || summary.includes('BRONZE') || medalTypes.includes('bronze')) return 'bronze';

    if (item.row?.result?.medals && item.row.result.medals.length > 0) {
      const firstType = item.row.result.medals[0]?.type;
      if (firstType === 'gold' || firstType === 'silver' || firstType === 'bronze') return firstType;
    }

    return 'pictogram';
  }

  isMedalResultItem(item: any): boolean {
    const type = this.getItemMedalIconType(item);
    if (type === 'gold' || type === 'silver' || type === 'bronze') return true;
    return this.isMedalRow(item.row);
  }

  readonly filteredDeclaredResults = computed(() => {
    const filter = this.selectedSportFilter();
    const normalizedFilter = filter.toLowerCase();
    const division = this.selectedSportDivision();
    const view = this.selectedSportResultView();
    const search = this.sportResultSearch().trim().toLowerCase();

    return this.declaredResults().filter((item) => {
      if (filter !== "all" && item.row.sport.toLowerCase() !== normalizedFilter) {
        return false;
      }

      if (division !== "all") {
        const ev = (item.row.event || "").toLowerCase();
        if (division === "men" && (!ev.includes("men") || ev.includes("women"))) return false;
        if (division === "women" && !ev.includes("women")) return false;
        if (division === "mixed" && !ev.includes("mixed")) return false;
      }

      if (view === "medals" && !this.isMedalResultItem(item)) return false;
      if (view === "wins" && !item.badge?.isWon) return false;
      if (view === "gold" && !this.hasMedalColor(item, "gold")) return false;
      if (view === "silver" && !this.hasMedalColor(item, "silver")) return false;
      if (view === "bronze" && !this.hasMedalColor(item, "bronze")) return false;

      if (search) {
        const text = `${item.row.event} ${item.row.athletes} ${item.summary || ""}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });
  });

  getCanonicalEventCategory(rawEvent: string): string {
    if (!rawEvent) return "General Event";
    const cleaned = cleanCwgEventTitle(rawEvent);
    const lower = cleaned.toLowerCase();

    // 1. Track Cycling
    if (
      lower.includes("track cycling") ||
      lower.includes("cycling") ||
      lower.includes("points race") ||
      lower.includes("scratch race") ||
      lower.includes("keirin") ||
      lower.includes("team pursuit") ||
      lower.includes("team sprint") ||
      lower.includes("time trial")
    ) {
      const isWomen = lower.includes("women");
      const isPara = lower.includes("para");
      const prefix = isPara ? "Para Track Cycling " : (isWomen ? "Women's " : "Men's ");

      if (lower.includes("points race")) return prefix + "Points Race";
      if (lower.includes("scratch race")) return prefix + "Scratch Race";
      if (lower.includes("keirin")) return prefix + "Keirin";
      if (lower.includes("team pursuit")) return prefix + "Team Pursuit";
      if (lower.includes("team sprint")) return prefix + "Team Sprint";
      if (lower.includes("time trial")) return prefix + "Time Trial";
      if (lower.includes("individual pursuit")) return prefix + "Individual Pursuit";
      if (lower.includes("sprint")) return prefix + "Sprint";
    }

    // 2. Decathlon sub-events
    if (lower.includes("decathlon")) return "Men's Decathlon";

    // 3. Exact match rules for Athletics canonical list
    if (lower.includes("triple jump")) return lower.includes("women") ? "Women's Triple Jump" : "Men's Triple Jump";
    if (lower.includes("javelin")) return lower.includes("women") ? "Women's Javelin Throw" : "Men's Javelin Throw";
    if (lower.includes("discus")) return lower.includes("women") ? "Women's Discus Throw" : "Men's Discus Throw";
    if (lower.includes("shot put")) return lower.includes("women") ? "Women's Shot Put" : "Men's Shot Put";
    if (lower.includes("long jump")) return lower.includes("women") ? "Women's Long Jump" : "Men's Long Jump";
    if (lower.includes("high jump")) return lower.includes("women") ? "Women's High Jump" : "Men's High Jump";
    if (lower.includes("pole vault")) return lower.includes("women") ? "Women's Pole Vault" : "Men's Pole Vault";

    if (lower.includes("steeplechase")) return lower.includes("men") && !lower.includes("women") ? "Men's 3000m Steeplechase" : "Women's 3000m Steeplechase";
    if (lower.includes("race walk") || lower.includes("racewalk")) return lower.includes("men") && !lower.includes("women") ? "Men's 10,000m Race Walk" : "Women's 10,000m Race Walk";
    if (lower.includes("relay") || lower.includes("4x400") || lower.includes("4 * 400")) return "Mixed 4 x 400m Relay";

    if (lower.includes("110m hurdles")) return "Men's 110m Hurdles";
    if (lower.includes("400m hurdles")) return lower.includes("women") ? "Women's 400m Hurdles" : "Men's 400m Hurdles";
    if (lower.includes("100m hurdles")) return "Women's 100m Hurdles";

    if (lower.includes("10,000m") || lower.includes("10000m")) return lower.includes("women") ? "Women's 10,000m" : "Men's 10,000m";
    if (lower.includes("5000m") || lower.includes("5,000m")) return lower.includes("women") ? "Women's 5000m" : "Men's 5000m";

    if (lower.includes("400m") && !lower.includes("hurdles") && !lower.includes("relay")) return lower.includes("women") ? "Women's 400m" : "Men's 400m";
    if (lower.includes("200m") && !lower.includes("hurdles")) return lower.includes("women") ? "Women's 200m" : "Men's 200m";
    if (lower.includes("100m") && !lower.includes("hurdles")) return lower.includes("women") ? "Women's 100m" : "Men's 100m";

    // 4. Judo weight categories
    if (lower.includes("judo") || lower.includes("kg")) {
      const isWomen = lower.includes("women");
      const prefix = isWomen ? "Women's " : "Men's ";

      if (lower.includes("+100") || lower.includes("100+")) return prefix + "+100kg";
      if (lower.includes("-100") || lower.includes("100kg")) return prefix + "-100kg";
      if (lower.includes("-90") || lower.includes("90kg")) return prefix + "-90kg";
      if (lower.includes("-81") || lower.includes("81kg")) return prefix + "-81kg";
      if (lower.includes("-78") || lower.includes("78kg")) return prefix + "-78kg";
      if (lower.includes("-70") || lower.includes("70kg")) return prefix + "-70kg";
      if (lower.includes("-66") || lower.includes("66kg")) return prefix + "-66kg";
      if (lower.includes("-63") || lower.includes("63kg")) return prefix + "-63kg";
      if (lower.includes("-60") || lower.includes("60kg")) return prefix + "-60kg";
      if (lower.includes("-57") || lower.includes("57kg")) return prefix + "-57kg";
      if (lower.includes("-52") || lower.includes("52kg")) return prefix + "-52kg";
      if (lower.includes("-48") || lower.includes("48kg")) return prefix + "-48kg";
    }

    // General fallback: strip stage suffixes & clean title
    return (
      cleaned
        .replace(/\s*-\s*(Final|Semi-final|Quarter-final|Round of \d+|Group Stage|Qualification|Preliminary Round|Heat \d+).*/gi, "")
        .replace(/\s+(Final|Semi-final|Quarter-final|Qualification|Heat \d+).*/gi, "")
        .trim() || cleaned
    );
  }

  getScheduleEventTitle(row: CwgScheduleRow): string {
    const raw = row.event || row.eventName || row.name || "";
    return cleanCwgEventTitle(raw) || getBoxingEventTitle(row);
  }

  readonly eventGroupedDeclaredResults = computed(() => {
    const results = this.filteredDeclaredResults();
    const groupMap = new Map<string, typeof results>();

    results.forEach((item) => {
      const rawEvent = item.row.event || "General Event";
      const categoryName = this.getCanonicalEventCategory(rawEvent);

      if (!groupMap.has(categoryName)) {
        groupMap.set(categoryName, []);
      }
      groupMap.get(categoryName)!.push(item);
    });

    return [...groupMap.entries()].map(([eventName, items]) => ({
      eventName,
      items,
      hasMedal: items.some((i) => this.isMedalResultItem(i)),
    }));
  });

  readonly sportDialogResults = computed(() => this.filteredDeclaredResults());

  readonly liveCount = computed(() => this.liveSessions().length);
  readonly latestDeclaredResult = computed(() => this.declaredResults()[0] || null);
  readonly latestTwoResults = computed(() =>
    this.declaredResults()
      .filter((item) => Boolean(item && item.row && item.row.id))
      .slice(0, 2),
  );




  readonly sportIconLookup = computed(() => {
    const lookup = new Map<string, string>();

    this.participations().forEach((row) => {
      const sport = getParticipationSport(row);
      if (!sport) return;

      const url = this.payload.getSportPictogramUrl({ sport: sport as Sport, includePlaceholderFallback: false });
      if (!url) return;

      lookup.set(this.normalizeSportKey(sport.slug), url);
      lookup.set(this.normalizeSportKey(sport.name), url);
      lookup.set(this.normalizeSportKey(getParticipationSportName(row)), url);
    });

    return lookup;
  });

  readonly liveSessions = computed(() => {
    return this.activeScheduleRows()
      .filter((row) => isScheduleRowLiveNow(row, this.now()))
      .sort((a, b) => this.getSessionStartMs(a) - this.getSessionStartMs(b));
  });

  readonly upcomingSessions = computed(() => {
    const now = this.now().getTime();
    const upcoming = this.activeScheduleRows()
      .filter((row) => this.isOperationalUpcomingRow(row, now))
      .sort((a, b) => this.compareTimelineRows(a, b));
    return (upcoming.length ? upcoming : this.activeScheduleRows()).slice(0, 6);
  });

  readonly headlineSessions = computed(() => {
    const live = this.liveSessions();
    return live.length ? live : this.upcomingSessions().slice(0, 4);
  });

  readonly nextIndiaSession = computed(() => this.headlineSessions()[0] || null);
  readonly nextIndiaQueue = computed(() => this.headlineSessions().slice(1, 4));

  readonly selectedDateKey = signal<string>("all");

  readonly upcomingDateGroups = computed<ScheduleDateGroup[]>(() => {
    const now = this.now().getTime();
    const rows = this.activeScheduleRows()
      .filter((row) => this.isOperationalUpcomingRow(row, now))
      .sort((a, b) => this.compareTimelineRows(a, b));
    const groupsMap = new Map<string, ScheduleDateGroup>();

    for (const row of rows) {
      const date = this.getIstDateParts(this.getSessionStartMs(row));
      const key = date.dateKey;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          dateKey: key,
          dateLabel: date.dateLabel,
          dayLabel: date.dayLabel,
          sessionCount: 0,
          goldCount: 0,
          rows: [],
        });
      }
      const group = groupsMap.get(key)!;
      group.sessionCount++;
      if (row.isMedalSession || (row.goldMedalEvents && row.goldMedalEvents.length > 0)) {
        group.goldCount++;
      }
      group.rows.push(row);
    }

    return Array.from(groupsMap.values());
  });

  readonly filteredUpcomingSessions = computed(() => {
    const selectedKey = this.selectedDateKey();

    if (selectedKey === "results") {
      return this.declaredResults().map((item) => item.row).slice(0, 16);
    }

    if (selectedKey === "medals") {
      return this.upcomingMedalSessions();
    }

    if (selectedKey === "all" || !selectedKey) {
      const now = this.now().getTime();
      const next24Hours = now + 24 * 60 * 60 * 1000;
      const upcoming = this.activeScheduleRows()
        .filter((row) => this.isOperationalUpcomingRow(row, now))
        .sort((a, b) => this.compareTimelineRows(a, b));
      const nextDayRows = upcoming.filter((row) => this.getSessionStartMs(row) < next24Hours);
      return nextDayRows.length ? nextDayRows : upcoming;
    }

    const groups = this.upcomingDateGroups();
    const group = groups.find((g) => g.dateKey === selectedKey);
    return group ? group.rows : [];
  });

  readonly timelineGroups = computed<TimelineGroup[]>(() => this.buildTimelineGroups(this.filteredUpcomingSessions()));

  readonly upcomingMedalSessions = computed(() => {
    const now = this.now().getTime();
    return this.activeScheduleRows()
      .filter((row) => this.isMedalRow(row))
      .filter((row) => this.isOperationalUpcomingRow(row, now))
      .sort((a, b) => this.compareTimelineRows(a, b));
  });

  setSelectedDateKey(key: string): void {
    this.selectedDateKey.set(key);
  }

  setMedalStream(stream: CwgCompetitionStream): void {
    this.selectedMedalStream.set(stream);
    this.selectedMedalSport.set("all");
  }

  setMedalSport(sport: string): void {
    this.selectedMedalSport.set(sport);
  }

  getMedalIconUrl(type: "gold" | "silver" | "bronze"): string {
    if (type === "silver") return this.silverMedalIconUrl;
    if (type === "bronze") return this.bronzeMedalIconUrl;
    return this.medalIconUrl;
  }

  getMedalLabel(type: "gold" | "silver" | "bronze"): string {
    return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  }

  openMedalWinnersDialog(): void {
    this.selectedMedalType.set("all");
    this.isMedalWinnersDialogOpen.set(true);
  }

  openMedalWinnersType(type: "all" | "gold" | "silver" | "bronze"): void {
    this.selectedMedalType.set(type);
    this.selectedMedalSport.set("all");
    this.isMedalWinnersDialogOpen.set(true);
  }

  setMedalTypeFilter(type: "all" | "gold" | "silver" | "bronze"): void {
    this.selectedMedalType.set(type);
  }

  closeMedalWinnersDialog(): void {
    this.isMedalWinnersDialogOpen.set(false);
  }

  readonly selectedMedalWinner = signal<MedalWinner | null>(null);

  readonly athleteProgressionHistory = computed(() => {
    const winner = this.selectedMedalWinner();
    const row = this.selectedSessionRow();

    const targetSport = winner?.sport || row?.sport;
    const targetAthlete = winner?.athleteName || row?.athletes;
    const targetEvent = winner?.event || row?.event;

    if (!targetSport) return [];

    const matchedRows = this.scheduleRows().filter((r) => {
      if (r.sport !== targetSport) return false;
      if (!r.result) return false;

      const eventClean = (targetEvent || "").toLowerCase().replace(/^(men's|women's|mixed)\s*/i, '').trim();
      const rowEventClean = (r.event || "").toLowerCase().replace(/^(men's|women's|mixed)\s*/i, '').trim();

      const eventMatch = Boolean(eventClean && rowEventClean.includes(eventClean));
      const athleteMatch = Boolean(
        targetAthlete && targetAthlete !== 'India' && (
          (r.athletes && r.athletes.toLowerCase().includes(targetAthlete.toLowerCase())) ||
          (JSON.stringify(r.result).toLowerCase().includes(targetAthlete.toLowerCase()))
        )
      );

      return eventMatch || athleteMatch;
    });

    const uniqueMap = new Map<string, CwgScheduleRow>();
    matchedRows.forEach((r) => uniqueMap.set(r.id, r));

    return [...uniqueMap.values()]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((r) => {
        const resultSummary = getScheduleResultSummary(r);
        const stageName = r.stage || r.phase || (r.isMedalSession ? 'Medal Match' : 'Round Match');
        const opponent = this.getBoxingOpponentLabel(r) || r.result?.match?.competitor2?.name || r.athletes || 'Opponent';
        const isWon = Boolean(
          r.result?.summaryLabel?.toUpperCase().includes('WON') ||
          r.result?.resultLabel?.toUpperCase().includes('WON') ||
          (r.result?.medals && r.result.medals.length > 0)
        );
        const medalType = r.result?.summaryLabel?.includes('GOLD') ? 'gold' : r.result?.summaryLabel?.includes('SILVER') ? 'silver' : r.result?.summaryLabel?.includes('BRONZE') ? 'bronze' : null;

        return {
          id: r.id,
          stage: stageName,
          dateLabel: `${r.dayLabel || ''} ${r.dateLabel || ''}`.trim(),
          timeLabel: r.timeLabel,
          title: this.getScheduleEventTitle(r),
          opponent,
          resultText: resultSummary || r.result?.match?.scoreText || r.result?.resultLabel || 'Completed',
          isWon,
          medalType,
          row: r,
        };
      });
  });

  openMedalWinnerDetails(winner: MedalWinner): void {
    this.selectedMedalWinner.set(winner);
    this.resultOpenedFromMedalWinners.set(true);
    this.selectedSessionRow.set(winner.row);
  }

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.ngZone.run(() => this.now.set(new Date())), 60 * 1000);
      this.scheduleRefreshTimer = setInterval(
        () => this.ngZone.run(() => this.loadSchedule(false)),
        60 * 1000,
      );
    });

    this.payload.getGamesParticipations(CWG_2026_GAMES_KEY).subscribe({
      next: (response) => {
        this.participations.set(response.docs || []);
        this.isRosterLoading.set(false);
        this.hasRosterError.set(false);
      },
      error: () => {
        this.participations.set([]);
        this.isRosterLoading.set(false);
        this.hasRosterError.set(true);
      },
    });

    this.payload.getEditionBySlug("glasgow-2026").subscribe({
      next: (edition) => {
        const rank = edition?.globalStats?.indiaRank;
        if (typeof rank === "number" && rank > 0) this.indiaRank.set(rank);
      },
    });

    this.loadSchedule(true);
  }

  private loadSchedule(showLoading: boolean): void {
    if (this.scheduleRequestInFlight) return;
    this.scheduleRequestInFlight = true;
    if (showLoading) this.isScheduleLoading.set(true);

    this.payload.getGamesHubSchedule<CwgScheduleData>(CWG_2026_GAMES_KEY).subscribe({
      next: (schedule) => {
        if (schedule?.rows?.length) {
          this.scheduleData.set(schedule);
        }
        this.scheduleRequestInFlight = false;
        this.isScheduleLoading.set(false);
        this.hasScheduleError.set(false);
      },
      error: () => {
        this.scheduleRequestInFlight = false;
        this.isScheduleLoading.set(false);
        this.hasScheduleError.set(true);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.scheduleRefreshTimer) clearInterval(this.scheduleRefreshTimer);
  }

  trackBySession(_: number, row: { id: string }): string {
    return row.id;
  }

  getSchedulePictogramUrl(row: CwgScheduleRow): string | null {
    const lookup = this.sportIconLookup();
    const sportSlug = this.normalizeSportKey(row.sportSlug);
    const sportName = this.normalizeSportKey(row.sport);

    return (
      lookup.get(sportSlug) ||
      lookup.get(sportName) ||
      [...lookup.entries()].find(([key]) => sportName.includes(key) || key.includes(sportName))?.[1] ||
      null
    );
  }

  getReportSportPictogramUrl(sportName: string): string | null {
    const lookup = this.sportIconLookup();
    const normalizedName = this.normalizeSportKey(sportName);

    return (
      lookup.get(normalizedName) ||
      [...lookup.entries()].find(([key]) => normalizedName.includes(key) || key.includes(normalizedName))?.[1] ||
      null
    );
  }

  hasBoxingDraw(row: CwgScheduleRow): boolean {
    return Boolean(getBoxingDraw(row));
  }

  getBoxingIndiaLabel(row: CwgScheduleRow): string {
    const draw = getBoxingDraw(row);
    if (!draw) return "";

    const athleteName = row.athletes?.split(";")[0]?.trim();
    if (athleteName && athleteName !== "India") return athleteName;

    return getBoxingCompetitorName({
      displayName: draw.indiaName,
      countryCode: draw.indiaCountryCode,
    });
  }

  getBoxingOpponentLabel(row: CwgScheduleRow): string {
    return resolveBoxingOpponentLabel(row);
  }

  getBoxingBoutMeta(row: CwgScheduleRow): string {
    const draw = getBoxingDraw(row);
    if (!draw) return "";

    const parts = [
      draw.boutNumber ? `Bout ${draw.boutNumber}` : "",
      draw.opponentStatus === "confirmed"
        ? "Opponent confirmed"
        : draw.opponentStatus
          ? "Opponent from draw path"
          : "",
    ].filter(Boolean);

    return parts.join(" · ");
  }

  getSessionBadge(row: CwgScheduleRow): string {
    if (this.isSessionLive(row)) return "Live";
    if (this.isDeclaredResultRow(row)) return getScheduleResultBadge(row)?.label || "Completed";

    // 1. Explicit CMS Badge Override (from Payload CMS)
    if (row.badgeOverride && row.badgeOverride !== "auto") {
      if (row.badgeOverride === "confirmed") return "Confirmed";
      if (row.badgeOverride === "qual-dependent") return "Qual. Dependent";
      if (row.badgeOverride === "draw-pending") return "Draw Pending";
      if (row.badgeOverride === "gold-medal") return "Medal session";
      if (row.badgeOverride === "eliminated") return "Eliminated";
    }

    const eventName = (row.event || "").toLowerCase();
    const cert = (row.certainty || "").toLowerCase();

    // 1. Direct Stage Labels from Official PDF
    if (eventName.includes("round of 32") || eventName.includes("round of 16")) {
      return cert.includes("confirmed") ? "Confirmed" : "Draw Pending";
    }

    if (eventName.includes("quarter-final") || eventName.includes("semi-final")) {
      if (eventName.includes("& final") || eventName.includes("and final")) return "Medal session";
      return "Qual. Dependent";
    }

    if (eventName.includes("qualifying") || eventName.includes("heats") || eventName.includes("preliminary") || eventName.includes("sectional")) {
      if (cert.includes("draw") || cert.includes("pending")) return "Draw Pending";
      return "Confirmed";
    }

    // 2. Direct Finals in Athletics, Weightlifting, Distance & Para Events
    const isDirectFinal =
      eventName.includes("5000m") ||
      eventName.includes("10,000m") ||
      eventName.includes("10000m") ||
      eventName.includes("3000m steeplechase") ||
      eventName.includes("race walk") ||
      eventName.includes("decathlon") ||
      eventName.includes("heptathlon") ||
      eventName.includes("weightlifting") ||
      eventName.includes("48kg") ||
      eventName.includes("53kg") ||
      eventName.includes("69kg") ||
      eventName.includes("75kg") ||
      eventName.includes("87kg") ||
      eventName.includes("+87kg") ||
      eventName.includes("singles final") ||
      eventName.includes("pairs final") ||
      eventName.includes("f57") ||
      eventName.includes("t47") ||
      eventName.includes("t54") ||
      eventName.includes("f42");

    if (isDirectFinal && (eventName.includes("final") || row.isMedalSession)) {
      return "Medal session";
    }

    // 3. Finals requiring qualification (e.g. 100m final, 400m final, Boxing gold medal final)
    if (eventName.includes("gold medal final") || eventName.includes("final") || row.isMedalSession) {
      if (
        !isDirectFinal &&
        (row.isConditional ||
          cert.includes("conditional") ||
          cert.includes("progression") ||
          cert.includes("qualification") ||
          cert.includes("pool") ||
          cert.includes("qual."))
      ) {
        return "Qual. Dependent";
      }
      return "Medal session";
    }

    if (cert.includes("draw") || cert.includes("pending")) return "Draw Pending";
    if (cert.includes("confirmed")) return "Confirmed";
    if (row.isConditional || cert.includes("conditional")) return "Conditional";
    return "Scheduled";
  }

  getSessionCertaintyTooltip(row: CwgScheduleRow): string {
    const badge = this.getSessionBadge(row);
    if (badge === "Qual. Dependent") {
      return "Qual. Dependent: Requires qualification from earlier heats/semi-finals";
    }
    if (badge === "Confirmed") {
      return "Confirmed: Entry confirmed for this round";
    }
    if (badge === "Medal session") {
      return "Medal session: Medals will be decided in this event";
    }
    return row.certainty ? `Status: ${row.certainty}` : "Scheduled session";
  }

  getSessionImportanceClass(row: CwgScheduleRow): string {
    const badge = this.getSessionBadge(row);
    if (badge === "Live") return "importance-live";
    if (this.isDeclaredResultRow(row)) return getScheduleResultBadge(row)?.isWon ? "importance-confirmed" : "importance-context";
    if (badge === "Medal session") return "importance-core";
    if (badge === "Confirmed") return "importance-confirmed";
    if (badge === "Draw Pending") return "importance-pending";
    if (badge === "Qual. Dependent" || badge === "Conditional") return "importance-high";
    return "importance-context";
  }

  isSessionLive(row: CwgScheduleRow): boolean {
    return isScheduleRowLiveNow(row, this.now());
  }

  getHeroCountdownLabel(row: CwgScheduleRow): string {
    if (this.isSessionLive(row)) return "LIVE";

    const diffMs = this.getSessionStartMs(row) - this.now().getTime();
    if (diffMs <= 0) return "SOON";

    const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `T-${days}d ${hours}h`;
    if (hours > 0) return `T-${hours}h ${minutes}m`;
    return `T-${minutes}m`;
  }

  trackByTimelineGroup(_index: number, group: TimelineGroup): string {
    return group.id;
  }

  getTimelineOverlapLabel(_row: CwgScheduleRow, _rowIndex: number): string | null {
    return null;
  }

  getSportName(participation: CwgGamesParticipation): string {
    return getParticipationSportName(participation);
  }

  getQuestionLabel(): string {
    return "Athlete in focus";
  }

  private getSessionStartMs(row: CwgScheduleRow): number {
    const timestamp = parseCwgScheduleTimestamp(row.istStart || row.sortKey);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private getSessionEndMs(row: CwgScheduleRow): number {
    const start = this.getSessionStartMs(row);
    const timestamp = parseCwgScheduleTimestamp(row.istEnd);
    if (Number.isFinite(timestamp) && timestamp > start) return timestamp;
    return start + 2 * 60 * 60 * 1000;
  }

  private isDeclaredResultRow(row: CwgScheduleRow): boolean {
    return row.status === "completed" || Boolean(getScheduleResultSummary(row));
  }

  private isOperationalUpcomingRow(row: CwgScheduleRow, now: number): boolean {
    if (row.isEliminated || this.isDeclaredResultRow(row)) return false;
    return isScheduleRowLiveNow(row, new Date(now)) || this.getSessionEndMs(row) >= now;
  }

  private buildTimelineGroups(rows: CwgScheduleRow[]): TimelineGroup[] {
    const sortedRows = [...rows].sort((a, b) => this.compareTimelineRows(a, b));
    const groups: TimelineGroup[] = [];
    const maxGroupRows = 6;
    const startCounts = new Map<number, number>();

    for (const row of sortedRows) {
      const startMs = this.getSessionStartMs(row);
      startCounts.set(startMs, (startCounts.get(startMs) || 0) + 1);
    }

    for (const row of sortedRows) {
      const startMs = this.getSessionStartMs(row);
      const endMs = this.getSessionEndMs(row);
      const activeEndMs = endMs > startMs ? endMs : startMs;
      const currentGroup = groups[groups.length - 1];
      const sameStartOverflow = (startCounts.get(startMs) || 0) > maxGroupRows;
      const groupedWindowEndMs = currentGroup ? Math.max(currentGroup.endMs, activeEndMs) : activeEndMs;
      const sameClockStart = Boolean(currentGroup && startMs === currentGroup.startMs);
      const canJoinCurrentGroup = Boolean(
        currentGroup &&
        !sameStartOverflow &&
        currentGroup.rows.length < maxGroupRows &&
        sameClockStart
      );

      if (canJoinCurrentGroup && currentGroup) {
        currentGroup.rows.push(row);
        currentGroup.rows.sort((a, b) => this.compareTimelineRows(a, b));
        currentGroup.endMs = groupedWindowEndMs;
        currentGroup.id = currentGroup.rows.map((item) => item.id).join("|");
        currentGroup.timeLabel = this.formatTimelineGroupTime(currentGroup.startMs, currentGroup.endMs);
        currentGroup.isLive = currentGroup.rows.some((item) => this.isSessionLive(item));
        currentGroup.hasMedal = currentGroup.rows.some((item) => this.isMedalRow(item));
        continue;
      }

      const date = this.getIstDateParts(startMs);
      groups.push({
        id: row.id,
        startMs,
        endMs: activeEndMs,
        dayLabel: date.dayLabel,
        dateLabel: date.dateLabel,
        timeLabel: row.timeLabel,
        rows: [row],
        isLive: this.isSessionLive(row),
        hasMedal: this.isMedalRow(row),
      });
    }

    return groups;
  }

  private formatTimelineGroupTime(startMs: number, endMs: number): string {
    const start = this.formatIstClock(startMs);
    const end = this.formatIstClock(endMs);
    return `${start}-${end} IST`;
  }

  private formatIstClock(timestamp: number): string {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date(timestamp));
  }

  private getIstDateParts(timestamp: number): {
    dateKey: string;
    dayLabel: string;
    dateLabel: string;
  } {
    const date = new Date(timestamp);
    const keyedParts = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Kolkata",
    }).formatToParts(date);
    const keyed = Object.fromEntries(keyedParts.map((part) => [part.type, part.value]));

    return {
      dateKey: `${keyed["year"]}-${keyed["month"]}-${keyed["day"]}`,
      dayLabel: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }).format(date),
      dateLabel: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(date),
    };
  }

  private compareTimelineRows(a: CwgScheduleRow, b: CwgScheduleRow): number {
    const startDelta = this.getSessionStartMs(a) - this.getSessionStartMs(b);
    if (startDelta !== 0) return startDelta;

    const liveDelta = Number(this.isSessionLive(b)) - Number(this.isSessionLive(a));
    if (liveDelta !== 0) return liveDelta;

    const medalDelta = Number(this.isMedalRow(b)) - Number(this.isMedalRow(a));
    if (medalDelta !== 0) return medalDelta;

    return `${a.sport}:${a.event}`.localeCompare(`${b.sport}:${b.event}`);
  }

  private isMedalRow(row: CwgScheduleRow): boolean {
    return row.isMedalSession || Boolean(row.goldMedalEvents?.length);
  }

  private getScheduleCompetitionStream(row: CwgScheduleRow): Exclude<CwgCompetitionStream, "all"> {
    if (row.competitionStream) return row.competitionStream;

    const sportLabel = `${row.sport || ""} ${row.sportSlug || ""}`.toLowerCase();
    return sportLabel.includes("para") || sportLabel.includes("wheelchair")
      ? "para"
      : "able-bodied";
  }

  private getResultMedalTypes(row: CwgScheduleRow): Array<"gold" | "silver" | "bronze"> {
    if (row.status !== "completed" || !row.result) return [];

    const structuredMedals = (row.result.medals || [])
      .map((medal) => medal.type)
      .filter(
        (type): type is "gold" | "silver" | "bronze" =>
          type === "gold" || type === "silver" || type === "bronze",
      );
    if (structuredMedals.length) return structuredMedals;

    const resultLabels = [
      row.result.summaryLabel,
      row.result.resultLabel,
      row.result.summary,
      row.result.outcome,
    ]
      .filter(Boolean)
      .map((label) => String(label).trim().toLowerCase());

    return (["gold", "silver", "bronze"] as const).filter((type) =>
      resultLabels.some(
        (label) =>
          label === type ||
          label === `${type} medal` ||
          label.startsWith(`${type} ·`) ||
          label.startsWith(`${type} (`) ||
          label.startsWith(`${type} medal ·`) ||
          label === `won ${type}` ||
          label.startsWith(`won ${type} ·`),
      ),
    );
  }

  private normalizeSportKey(value?: string | null): string {
    return (value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private isSameDay(leftMs: number, rightMs: number): boolean {
    return this.getIstDateParts(leftMs).dateKey === this.getIstDateParts(rightMs).dateKey;
  }

  private normalizeSearchText(value?: string | null): string {
    return (value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  openSessionDialog(row: CwgScheduleRow): void {
    this.resultOpenedFromMedalWinners.set(false);
    this.selectedSessionRow.set(row);
  }

  closeSessionDialog(): void {
    this.selectedSessionRow.set(null);
    this.resultOpenedFromMedalWinners.set(false);
  }

  backToMedalWinners(): void {
    this.selectedSessionRow.set(null);
    this.resultOpenedFromMedalWinners.set(false);
  }

  openHeaderLivePanel(): void {
    if (!this.liveCount()) {
      this.navigateToResults();
      return;
    }
    this.isLiveSessionsDialogOpen.set(true);
  }

  closeLiveSessionsDialog(): void {
    this.isLiveSessionsDialogOpen.set(false);
  }

  openLiveSessionDetails(row: CwgScheduleRow): void {
    this.closeLiveSessionsDialog();
    this.openSessionDialog(row);
  }

  getResultSummary(row: CwgScheduleRow): string | null {
    return getScheduleResultSummary(row);
  }

  getResultBadge(row: CwgScheduleRow): { label: string; isWon: boolean } | null {
    return getScheduleResultBadge(row);
  }

  navigateToResults(): void {
    this.router.navigate(["/cwg-2026/schedule"], { queryParams: { view: "results" } });
  }

  getFlag(country: string | undefined | null): string {
    return getCountryFlagEmoji(country);
  }
}
