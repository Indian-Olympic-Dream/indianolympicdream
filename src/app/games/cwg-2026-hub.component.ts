import { CommonModule } from "@angular/common";
import { Component, HostListener, NgZone, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { PayloadService, Sport } from "../services/payload.service";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import { Cwg2026ResultDetailComponent } from "./cwg-2026-result-detail.component";
import {
  CWG_2026_GAMES_KEY,
  CwgCompetitionStream,
  CwgScheduleData,
  CwgScheduleRow,
  getBoxingCompetitorName,
  getBoxingDraw,
  getBoxingEventTitle,
  getBoxingOpponentLabel as resolveBoxingOpponentLabel,
  getRoadToMedalImageUrl as resolveRoadToMedalImageUrl,
  getScheduleResultBadge,
  getScheduleResultSummary,
  isScheduleRowLiveNow,
  parseCwgScheduleTimestamp,
} from "./cwg-2026.types";

type CompetitionStream = CwgCompetitionStream;
type StreamKey = Exclude<CompetitionStream, "all">;

interface StreamOption {
  key: CompetitionStream;
  label: string;
  athletes: number;
}

interface DateColumn {
  key: string;
  dayLabel: string;
  dateLabel: string;
}

interface ScheduleCell {
  key: string;
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  sportKey: string;
  sportName: string;
  stream: StreamKey;
  pictogramSlugs: string[];
  rows: CwgScheduleRow[];
  sessionCount: number;
  goldMedalsOnOffer: number;
  conditionalCount: number;
  hasDeclaredResult: boolean;
  hasLiveNow: boolean;
  firstSortKey: string;
  firstTimeLabel: string;
}

interface SportMatrixRow {
  key: string;
  name: string;
  stream: StreamKey;
  pictogramSlugs: string[];
  cells: ScheduleCell[];
  totalRows: number;
  goldMedalsOnOffer: number;
  firstSortKey: string;
}

@Component({
  selector: "app-cwg-2026-hub",
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, Cwg2026ResultDetailComponent],
  templateUrl: "./cwg-2026-hub.component.html",
  styleUrl: "./cwg-2026-hub.component.scss",
})
export class Cwg2026HubComponent implements OnInit, OnDestroy {
  private readonly payload = inject(PayloadService);
  private readonly route = inject(ActivatedRoute);
  private readonly ngZone = inject(NgZone);
  private clockTimer?: ReturnType<typeof setInterval>;
  private scheduleRefreshTimer?: ReturnType<typeof setInterval>;
  private scheduleRequestInFlight = false;

  readonly glasgowLogoUrl = "assets/images/cwg/glasgow-2026-logo-vertical.svg";
  readonly medalIconUrl = "assets/images/cwg/glasgow-gold-medal.svg";
  readonly bronzeMedalIconUrl = "assets/images/cwg/glasgow-bronze-medal.svg";
  readonly activeStream = signal<CompetitionStream>("all");
  readonly showDeclaredResultsOnly = signal(true);
  readonly selectedCellKey = signal<string | null>(null);
  readonly selectedRoadToMedalRow = signal<CwgScheduleRow | null>(null);
  readonly isRoadToMedalImageLoaded = signal(false);
  readonly sportPictograms = signal<Record<string, string>>({});
  readonly isScheduleLoading = signal(true);
  readonly hasScheduleError = signal(false);
  readonly now = signal(new Date());
  readonly scheduleData = signal<CwgScheduleData>({
    gamesDates: "23 July–2 August 2026",
    timezone: "IST",
    scheduleEdition: "Glasgow 2026 Schedule",
    rows: [],
  });

  readonly scheduleRows = computed(() =>
    [...this.scheduleData().rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
  );

  readonly streamOptions: StreamOption[] = [
    { key: "all", label: "All India", athletes: 126 },
    { key: "able-bodied", label: "Able-bodied", athletes: 97 },
    { key: "para", label: "Para India", athletes: 29 },
  ];

  readonly dateColumns = computed(() => this.buildDateColumns(this.visibleRows()));

  readonly streamTabs = computed(() =>
    this.streamOptions.map((stream) => {
      const rows = this.rowsForStream(stream.key);
      return {
        ...stream,
        rows: rows.length,
        sports: new Set(rows.map((row) => `${this.getScheduleStream(row)}:${this.getDisplaySport(row)}`)).size,
        goldMedalsOnOffer: this.countGoldMedalEvents(rows),
      };
    }),
  );

  readonly visibleRows = computed(() => {
    return this.rowsForCurrentMode(this.activeStream());
  });

  readonly declaredResultsCount = computed(
    () => this.scheduleRows().filter((row) => !row.isEliminated && this.isDeclaredResultRow(row)).length,
  );

  getResultMedalSortRank(row: CwgScheduleRow): number {
    const medals = row.result?.medals || [];
    if (medals.some((medal) => medal.type === "gold")) return 1;
    if (medals.some((medal) => medal.type === "silver")) return 2;
    if (medals.some((medal) => medal.type === "bronze")) return 3;
    const summary = (row.result?.summaryLabel || row.result?.resultLabel || "").toUpperCase();

    if (summary.includes("GOLD") || summary.includes("1ST")) return 1;
    if (summary.includes("SILVER") || summary.includes("2ND")) return 2;
    if (summary.includes("BRONZE") || summary.includes("3RD")) return 3;

    const match = summary.match(/(\d+)(ST|ND|RD|TH)/);
    if (match) {
      const rankNum = parseInt(match[1], 10);
      if (!isNaN(rankNum)) return 3 + rankNum;
    }

    if (summary.includes("QUALIFIED") || summary.includes(" Q")) return 100;
    if (summary.includes("DNF") || summary.includes("NO MARK")) return 500;

    return 200;
  }

  private rowsForCurrentMode(stream: CompetitionStream): CwgScheduleRow[] {
    const rows = this.rowsForStream(stream);
    if (this.showDeclaredResultsOnly()) {
      return rows
        .filter((row) => this.isDeclaredResultRow(row))
        .sort((a, b) => {
          const rankA = this.getResultMedalSortRank(a);
          const rankB = this.getResultMedalSortRank(b);
          if (rankA !== rankB) return rankA - rankB;
          return this.getSessionStartMs(a) - this.getSessionStartMs(b);
        });
    }
    const now = this.now().getTime();
    return rows
      .filter((row) => this.isOperationalMatrixRow(row, now))
      .sort((a, b) => this.getSessionStartMs(a) - this.getSessionStartMs(b));
  }

  readonly matrixRows = computed(() => this.buildMatrixRows(this.visibleRows()));

  readonly overview = computed(() => {
    const rows = this.visibleRows();
    return {
      rows: rows.length,
      sports: this.matrixRows().length,
      goldMedalsOnOffer: this.countGoldMedalEvents(rows),
      dates: new Set(rows.map((row) => this.getDateKey(row))).size,
    };
  });

  readonly activeStreamInfo = computed(
    () => this.streamOptions.find((stream) => stream.key === this.activeStream()) || this.streamOptions[0],
  );

  readonly selectedCell = computed(() => {
    const key = this.selectedCellKey();
    if (!key) return null;

    for (const row of this.matrixRows()) {
      const cell = row.cells.find((candidate) => candidate.key === key);
      if (cell?.sessionCount) return cell;
    }

    return null;
  });

  readonly gamesDates = computed(() => this.scheduleData().gamesDates);
  readonly timezoneNote = computed(() => this.scheduleData().timezone);
  readonly scheduleEdition = computed(() => this.scheduleData().scheduleEdition);


  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.ngZone.run(() => this.now.set(new Date())), 60 * 1000);
      this.scheduleRefreshTimer = setInterval(
        () => this.ngZone.run(() => this.loadSchedule(false)),
        60 * 1000,
      );
    });

    this.route.queryParamMap.subscribe((params) => {
      this.setDeclaredResultsOnly(params.get("view") === "results");
    });

    this.payload.getSports().subscribe({
      next: (sports) => this.sportPictograms.set(this.buildSportPictogramIndex(sports)),
      error: () => this.sportPictograms.set({}),
    });

    this.loadSchedule(true);
  }

  private loadSchedule(resetSelection: boolean): void {
    if (this.scheduleRequestInFlight) return;
    this.scheduleRequestInFlight = true;
    if (resetSelection && !this.scheduleRows().length) {
      this.isScheduleLoading.set(true);
    }

    this.payload.getGamesHubSchedule<CwgScheduleData>(CWG_2026_GAMES_KEY).subscribe({
      next: (schedule) => {
        if (Array.isArray(schedule?.rows)) {
          this.scheduleData.set(schedule);
          if (resetSelection) this.selectedCellKey.set(null);
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

  setActiveStream(stream: CompetitionStream): void {
    this.activeStream.set(stream);
    this.selectedCellKey.set(null);
  }

  selectCell(cell: ScheduleCell): void {
    if (!cell.sessionCount) return;
    this.selectedCellKey.set(cell.key);
  }

  closeCellDialog(): void {
    this.selectedCellKey.set(null);
    this.selectedRoadToMedalRow.set(null);
  }

  @HostListener("document:keydown.escape")
  closeCellDialogOnEscape(): void {
    if (this.selectedRoadToMedalRow()) {
      this.closeRoadToMedal();
      return;
    }
    this.closeCellDialog();
  }

  trackByStream(_: number, stream: StreamOption & { rows: number }): CompetitionStream {
    return stream.key;
  }

  trackByDate(_: number, date: DateColumn): string {
    return date.key;
  }

  trackBySport(_: number, row: SportMatrixRow): string {
    return row.key;
  }

  trackByCell(_: number, cell: ScheduleCell): string {
    return cell.key;
  }

  trackByScheduleRow(_: number, row: CwgScheduleRow): string {
    return row.id;
  }

  getCellLabel = (cell: ScheduleCell): string => {
    if (!cell || !cell.sessionCount) return "";
    if (cell.hasLiveNow) return "LIVE";
    if (this.showDeclaredResultsOnly()) return cell.hasDeclaredResult ? "✓" : String(cell.sessionCount);
    if (cell.hasDeclaredResult) return "✓";
    return String(cell.sessionCount);
  };

  isMedalWonRow(row: CwgScheduleRow): boolean {
    if (row.result?.medals?.length) return true;
    const summary = (row.result?.summaryLabel || row.result?.resultLabel || "").toUpperCase();
    return summary.includes("GOLD") || summary.includes("SILVER") || summary.includes("BRONZE") ||
      summary.includes("🥇") || summary.includes("🥈") || summary.includes("🥉");
  }

  shouldShowMedalIndicator(cell: ScheduleCell): boolean {
    if (!cell || !cell.sessionCount) return false;
    return cell.goldMedalsOnOffer > 0 || Boolean((cell as any).hasMedalWon);
  }

  shouldShowResultMedalIcon = (cell: ScheduleCell): boolean => {
    if (!cell || !cell.sessionCount) return false;

    if (this.showDeclaredResultsOnly()) {
      const isParaPowerlifting = (cell.sportName || "").toLowerCase().includes("powerlifting") ||
        (cell.sportKey || "").toLowerCase().includes("powerlifting") ||
        (cell.sportName || "").toLowerCase().includes("weightlifting");
      const isJuly24 = cell.dateKey === "2026-07-24" || (cell.dateLabel || "").includes("24");

      return (isParaPowerlifting && isJuly24) || Boolean((cell as any).hasMedalWon);
    }

    return cell.goldMedalsOnOffer > 0;
  };

  getCellMedalIconUrl = (cell: ScheduleCell): string => {
    if (!cell) return this.medalIconUrl;
    if (this.showDeclaredResultsOnly() || (cell as any).hasMedalWon) {
      const summary = (cell.rows?.map(r => r.result?.summaryLabel || r.result?.resultLabel || '').join(' ') || '').toUpperCase();
      if (summary.includes("BRONZE")) return this.bronzeMedalIconUrl;
    }
    return this.medalIconUrl;
  };

  getCellMedalCountText = (cell: ScheduleCell): string => {
    if (!cell) return "1";
    if (this.showDeclaredResultsOnly()) {
      const structuredCount = cell.rows.reduce(
        (count, row) => count + (row.result?.medals?.length || 0),
        0,
      );
      if (structuredCount > 0) return String(structuredCount);
      return String(cell.rows.filter((row) => this.isMedalWonRow(row)).length || 1);
    }
    return String(cell.goldMedalsOnOffer || 1);
  };

  getCellTooltip = (cell: ScheduleCell): string => {
    if (!cell || !cell.sessionCount) return `${cell?.sportName || ''} on ${cell?.dateLabel || ''}: No scheduled India events`;
    const parts = [`${cell.sportName} on ${cell.dateLabel}`];
    parts.push(`${cell.sessionCount} ${cell.sessionCount === 1 ? 'session' : 'sessions'}`);
    if (cell.goldMedalsOnOffer > 0) parts.push(`Medal session (${cell.goldMedalsOnOffer} gold events)`);
    if ((cell as any).hasMedalWon) parts.push(`Medal won! 🥇`);
    if (cell.hasDeclaredResult) parts.push(`Result declared`);
    return parts.join(" · ");
  };

  getSportPictogramUrl(sport: SportMatrixRow): string | null {
    return this.getPictogramUrl(sport.pictogramSlugs);
  }

  getCellPictogramUrl(cell: ScheduleCell): string | null {
    return this.getPictogramUrl(cell.pictogramSlugs);
  }

  getScheduleEventTitle(row: CwgScheduleRow): string {
    return getBoxingEventTitle(row);
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

  getRoadToMedalImageUrl(row: CwgScheduleRow): string {
    return resolveRoadToMedalImageUrl(row);
  }

  getRoadToMedalTitle(row: CwgScheduleRow): string {
    return getBoxingDraw(row)?.eventDescription || row.event || "Road To Medal";
  }

  openRoadToMedal(row: CwgScheduleRow): void {
    if (!this.getRoadToMedalImageUrl(row)) return;
    this.isRoadToMedalImageLoaded.set(false);
    this.selectedRoadToMedalRow.set(row);
  }

  closeRoadToMedal(): void {
    this.selectedRoadToMedalRow.set(null);
    this.isRoadToMedalImageLoaded.set(false);
  }

  markRoadToMedalImageLoaded(): void {
    this.isRoadToMedalImageLoaded.set(true);
  }

  private getPictogramUrl(slugs: string[]): string | null {
    const index = this.sportPictograms();
    for (const slug of slugs) {
      const url = index[slug];
      if (url) return url;
    }
    return null;
  }

  getSportInitials(name: string): string {
    return name
      .replace(/^Para\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  private rowsForStream(stream: CompetitionStream): CwgScheduleRow[] {
    const rows = this.scheduleRows().filter((row) => !row.isEliminated);
    if (stream === "all") return rows;
    return rows.filter((row) => this.getScheduleStream(row) === stream);
  }

  private isDeclaredResultRow(row: CwgScheduleRow): boolean {
    return row.status === "completed" || Boolean(getScheduleResultSummary(row));
  }

  private isOperationalMatrixRow(row: CwgScheduleRow, now: number): boolean {
    if (row.isEliminated || this.isDeclaredResultRow(row)) return false;
    return isScheduleRowLiveNow(row, new Date(now)) || this.getSessionEndMs(row) >= now;
  }

  private getSessionStartMs(row: CwgScheduleRow): number {
    const timestamp = parseCwgScheduleTimestamp(row.istStart || row.sortKey);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private getSessionEndMs(row: CwgScheduleRow): number {
    const timestamp = parseCwgScheduleTimestamp(row.istEnd);
    if (Number.isFinite(timestamp)) return timestamp;
    return this.getSessionStartMs(row) + 2 * 60 * 60 * 1000;
  }

  private countGoldMedalEvents(rows: CwgScheduleRow[]): number {
    return this.getGoldMedalEventSet(rows).size;
  }

  private getGoldMedalEventSet(rows: CwgScheduleRow[]): Set<string> {
    return new Set(rows.flatMap((row) => row.goldMedalEvents || []));
  }

  private buildDateColumns(rows: CwgScheduleRow[]): DateColumn[] {
    const dates = new Map<string, DateColumn>();
    rows.forEach((row) => {
      const key = this.getDateKey(row);
      if (!dates.has(key)) {
        dates.set(key, {
          key,
          dayLabel: row.dayLabel,
          dateLabel: row.dateLabel,
        });
      }
    });
    return [...dates.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  private buildMatrixRows(rows: CwgScheduleRow[]): SportMatrixRow[] {
    const sports = new Map<string, {
      name: string;
      stream: StreamKey;
      pictogramSlugs: string[];
      firstSortKey: string;
      rows: CwgScheduleRow[];
      cells: Map<string, CwgScheduleRow[]>;
    }>();

    rows.forEach((row) => {
      const stream = this.getScheduleStream(row);
      const name = this.getDisplaySport(row);
      const key = `${stream}:${name}`;
      const sport = sports.get(key) || {
        name,
        stream,
        pictogramSlugs: this.getSportPictogramSlugs(row, name),
        firstSortKey: row.sortKey,
        rows: [],
        cells: new Map<string, CwgScheduleRow[]>(),
      };

      sport.rows.push(row);
      if (row.sortKey.localeCompare(sport.firstSortKey) < 0) sport.firstSortKey = row.sortKey;

      const dateKey = this.getDateKey(row);
      const cellRows = sport.cells.get(dateKey) || [];
      cellRows.push(row);
      sport.cells.set(dateKey, cellRows);
      sports.set(key, sport);
    });

    return [...sports.entries()]
      .map(([key, sport]) => {
        const cells = this.dateColumns().map((date) => {
          const cellRows = [...(sport.cells.get(date.key) || [])].sort((a, b) => {
            if (this.showDeclaredResultsOnly()) {
              const rankA = this.getResultMedalSortRank(a);
              const rankB = this.getResultMedalSortRank(b);
              if (rankA !== rankB) return rankA - rankB;
            }
            return a.sortKey.localeCompare(b.sortKey);
          });
          const firstRow = cellRows[0];
          return {
            key: `${key}:${date.key}`,
            dateKey: date.key,
            dateLabel: date.dateLabel,
            dayLabel: date.dayLabel,
            sportKey: key,
            sportName: sport.name,
            stream: sport.stream,
            pictogramSlugs: sport.pictogramSlugs,
            rows: cellRows,
            sessionCount: cellRows.length,
            goldMedalsOnOffer: this.getGoldMedalEventSet(cellRows).size,
            conditionalCount: cellRows.filter((row) => row.isConditional).length,
            hasDeclaredResult: cellRows.some((row) => this.isDeclaredResultRow(row)),
            hasMedalWon: cellRows.some((row) => this.isMedalWonRow(row)),
            hasLiveNow: cellRows.some((row) => isScheduleRowLiveNow(row, this.now())),
            firstSortKey: firstRow?.sortKey || date.key,
            firstTimeLabel: firstRow?.timeLabel || "",
          };
        });

        return {
          key,
          name: sport.name,
          stream: sport.stream,
          pictogramSlugs: sport.pictogramSlugs,
          cells,
          totalRows: sport.rows.length,
          goldMedalsOnOffer: this.countGoldMedalEvents(sport.rows),
          activeDays: cells.filter((cell) => cell.sessionCount > 0).length,
          firstSortKey: sport.firstSortKey,
        };
      })
      .sort((a, b) => {
        if (a.stream !== b.stream) return a.stream === "able-bodied" ? -1 : 1;
        return a.firstSortKey.localeCompare(b.firstSortKey);
      });
  }

  private getDateKey(row: CwgScheduleRow): string {
    return row.sortKey.slice(0, 10);
  }

  private buildSportPictogramIndex(sports: Sport[]): Record<string, string> {
    const index: Record<string, string> = {};

    // 1. First pass: Register exact sport slug matches so 'athletics' gets athletics and 'para-athletics' gets para-athletics
    sports.forEach((sport) => {
      const url = this.payload.getSportPictogramUrl({
        sport,
        parentSport: sport.parentSport,
        includePlaceholderFallback: false,
      });
      if (url && sport.slug) {
        index[sport.slug] = url;
        index[this.toSlug(sport.name)] = url;
      }
    });

    // 2. Second pass: Parent sport fallbacks IF not set by an exact match
    sports.forEach((sport) => {
      const url = this.payload.getSportPictogramUrl({
        sport,
        parentSport: sport.parentSport,
        includePlaceholderFallback: false,
      });
      if (!url) return;

      const parentSlug = sport.parentSport?.slug;
      if (parentSlug && !index[parentSlug] && !sport.slug.startsWith("para-")) {
        index[parentSlug] = url;
      }
    });

    return index;
  }

  private getSportPictogramSlugs(row: CwgScheduleRow, sportName: string): string[] {
    const stream = this.getScheduleStream(row);
    const slugs: string[] = [];

    if (stream === "able-bodied") {
      if (row.sportSlug === "athletics") slugs.push("athletics");
      else if (row.sportSlug === "swimming") slugs.push("swimming");
      else slugs.push(row.sportSlug, this.toSlug(sportName));
    } else {
      if (row.sportSlug === "athletics") slugs.push("para-athletics", "athletics");
      else if (row.sportSlug === "swimming") slugs.push("para-swimming", "swimming");
      else slugs.push(row.sportSlug, this.toSlug(sportName));
    }

    if (row.sportSlug === "bowls") slugs.push("lawn-bowls");
    if (row.sportSlug === "gymnastics") slugs.push("artistic-gymnastics");
    if (row.sportSlug === "track-cycling" || row.sportSlug === "para-track-cycling") slugs.push("cycling");
    if (row.sportSlug === "para-powerlifting") slugs.push("powerlifting", "weightlifting");
    if (row.sportSlug === "wheelchair-basketball") slugs.push("basketball");

    return [...new Set(slugs.filter(Boolean))];
  }

  private getScheduleStream(row: CwgScheduleRow): StreamKey {
    if (row.sportSlug.includes("para") || row.sportSlug.includes("wheelchair")) return "para";
    if (row.sportSlug === "athletics" && /\b(?:T|F)\d{2}|para/i.test(row.event)) return "para";
    if (row.sportSlug === "swimming" && /\bS\d{1,2}\b/i.test(row.event)) return "para";
    return "able-bodied";
  }

  private getDisplaySport(row: CwgScheduleRow): string {
    const stream = this.getScheduleStream(row);
    if (stream === "para") {
      if (row.sportSlug === "athletics") return "Para Athletics";
      if (row.sportSlug === "swimming") return "Para Swimming";
    }

    return row.sport
      .split("/")
      .map((part) => part.trim())
      .find((part) => stream === "para" ? part.toLowerCase().includes("para") : !part.toLowerCase().includes("para")) ||
      row.sport;
  }

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  getSessionBadge(row: CwgScheduleRow): string {
    if (this.isLiveRow(row)) return "Live";
    if (this.isDeclaredResultRow(row)) return getScheduleResultBadge(row)?.label || "Completed";

    if (row.badgeOverride && row.badgeOverride !== "auto") {
      if (row.badgeOverride === "confirmed") return "Confirmed";
      if (row.badgeOverride === "qual-dependent") return "Qual. Dependent";
      if (row.badgeOverride === "draw-pending") return "Draw Pending";
      if (row.badgeOverride === "gold-medal") return "Medal session";
      if (row.badgeOverride === "eliminated") return "Eliminated";
    }

    const eventName = (row.event || "").toLowerCase();
    const cert = (row.certainty || "").toLowerCase();

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

  toggleDeclaredResults(): void {
    this.setDeclaredResultsOnly(!this.showDeclaredResultsOnly());
  }

  setDeclaredResultsOnly(value: boolean): void {
    if (value) this.activeStream.set("all");
    this.showDeclaredResultsOnly.set(value);
    this.selectedCellKey.set(null);
  }

  isLiveRow(row: CwgScheduleRow): boolean {
    return isScheduleRowLiveNow(row, this.now());
  }

  getResultSummary(row: CwgScheduleRow): string | null {
    return getScheduleResultSummary(row);
  }

  getResultBadge(row: CwgScheduleRow): { label: string; isWon: boolean } | null {
    return getScheduleResultBadge(row);
  }
}
