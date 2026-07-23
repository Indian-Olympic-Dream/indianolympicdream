import { CommonModule } from "@angular/common";
import { Component, HostListener, OnInit, computed, inject, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { PayloadService, Sport } from "../services/payload.service";
import { RouterLink, RouterLinkActive } from "@angular/router";
import {
  CWG_2026_GAMES_KEY,
  CwgCompetitionStream,
  CwgScheduleData,
  CwgScheduleRow,
  getBoxingCompetitorName,
  getBoxingDraw,
  getBoxingEventTitle,
  getBoxingOpponentLabel as resolveBoxingOpponentLabel,
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
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: "./cwg-2026-hub.component.html",
  styleUrl: "./cwg-2026-hub.component.scss",
})
export class Cwg2026HubComponent implements OnInit {
  private readonly payload = inject(PayloadService);

  readonly glasgowLogoUrl = "assets/images/cwg/glasgow-2026-logo-vertical.svg";
  readonly medalIconUrl = "assets/images/cwg/glasgow-gold-medal.svg";
  readonly activeStream = signal<CompetitionStream>("all");
  readonly selectedCellKey = signal<string | null>(null);
  readonly selectedRoadToMedalRow = signal<CwgScheduleRow | null>(null);
  readonly sportPictograms = signal<Record<string, string>>({});
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

  readonly dateColumns = computed(() => this.buildDateColumns(this.scheduleRows()));

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

  readonly visibleRows = computed(() => this.rowsForStream(this.activeStream()));

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
    this.payload.getSports().subscribe({
      next: (sports) => this.sportPictograms.set(this.buildSportPictogramIndex(sports)),
      error: () => this.sportPictograms.set({}),
    });

    this.payload.getGamesHubSchedule<CwgScheduleData>(CWG_2026_GAMES_KEY).subscribe({
      next: (schedule) => {
        if (schedule?.rows?.length) {
          this.scheduleData.set(schedule);
          this.selectedCellKey.set(null);
        }
      },
      error: () => undefined,
    });
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

  getCellLabel(cell: ScheduleCell): string {
    if (!cell.sessionCount) return "";
    if (cell.goldMedalsOnOffer > 0) return String(cell.goldMedalsOnOffer);
    return "•";
  }

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
    const draw = getBoxingDraw(row);
    if (!draw || !this.shouldShowRoadToMedal(row)) return "";

    const eventSlug = draw.eventSlug;
    return eventSlug ? `assets/images/cwg/boxing-draws/road-to-medal/${eventSlug}.png` : "";
  }

  getRoadToMedalTitle(row: CwgScheduleRow): string {
    return getBoxingDraw(row)?.eventDescription || row.event || "Road To Medal";
  }

  openRoadToMedal(row: CwgScheduleRow): void {
    if (!this.getRoadToMedalImageUrl(row)) return;
    this.selectedRoadToMedalRow.set(row);
  }

  closeRoadToMedal(): void {
    this.selectedRoadToMedalRow.set(null);
  }

  private shouldShowRoadToMedal(row: CwgScheduleRow): boolean {
    const draw = getBoxingDraw(row);
    if (!draw) return false;
    if (typeof draw.roadToMedalEnabled === "boolean") return draw.roadToMedalEnabled;
    if (row.isConditional === false) return true;

    const badge = (row.badgeOverride || "").toLowerCase();
    if (badge === "confirmed" || badge === "draw-pending") return true;

    const certainty = (row.certainty || "").toLowerCase();
    return certainty === "confirmed draw" || certainty === "opponent pending from draw path";
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
    const rows = this.scheduleRows();
    if (stream === "all") return rows;
    return rows.filter((row) => this.getScheduleStream(row) === stream);
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
          const cellRows = [...(sport.cells.get(date.key) || [])].sort((a, b) =>
            a.sortKey.localeCompare(b.sortKey),
          );
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
    return sports.reduce<Record<string, string>>((index, sport) => {
      const url = this.payload.getSportPictogramUrl({
        sport,
        parentSport: sport.parentSport,
        includePlaceholderFallback: false,
      });
      if (!url) return index;

      [sport.slug, this.toSlug(sport.name), sport.parentSport?.slug, sport.parentSport?.name ? this.toSlug(sport.parentSport.name) : null]
        .filter((key): key is string => !!key)
        .forEach((key) => {
          if (!index[key]) index[key] = url;
        });
      return index;
    }, {});
  }

  private getSportPictogramSlugs(row: CwgScheduleRow, sportName: string): string[] {
    const slugs = [row.sportSlug, this.toSlug(sportName)];
    if (row.sportSlug === "bowls") slugs.push("lawn-bowls");
    if (row.sportSlug === "gymnastics") slugs.push("artistic-gymnastics");
    if (row.sportSlug === "track-cycling" || row.sportSlug === "para-track-cycling") slugs.push("cycling");
    if (row.sportSlug === "para-powerlifting") slugs.push("powerlifting", "weightlifting");
    if (row.sportSlug === "wheelchair-basketball") slugs.push("basketball");
    if (sportName.startsWith("Para ")) slugs.push(this.toSlug(sportName.replace(/^Para\s+/i, "")));
    return [...new Set(slugs)];
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
    if (row.badgeOverride && row.badgeOverride !== "auto") {
      if (row.badgeOverride === "confirmed") return "Confirmed";
      if (row.badgeOverride === "qual-dependent") return "Qual. Dependent";
      if (row.badgeOverride === "draw-pending") return "Draw Pending";
      if (row.badgeOverride === "gold-medal") return "Gold Medal";
    }

    const eventName = (row.event || "").toLowerCase();
    const cert = (row.certainty || "").toLowerCase();

    if (eventName.includes("round of 32") || eventName.includes("round of 16")) {
      return cert.includes("confirmed") ? "Confirmed" : "Draw Pending";
    }

    if (eventName.includes("quarter-final") || eventName.includes("semi-final")) {
      if (eventName.includes("& final") || eventName.includes("and final")) return "Gold Medal";
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
      return "Gold Medal";
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
      return "Gold Medal";
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
    if (badge === "Gold Medal") {
      return "Gold Medal: Direct medal decision final";
    }
    return row.certainty ? `Status: ${row.certainty}` : "Scheduled session";
  }

  getSessionImportanceClass(row: CwgScheduleRow): string {
    const badge = this.getSessionBadge(row);
    if (badge === "Gold Medal") return "importance-core";
    if (badge === "Confirmed") return "importance-confirmed";
    if (badge === "Draw Pending") return "importance-pending";
    if (badge === "Qual. Dependent" || badge === "Conditional") return "importance-high";
    return "importance-context";
  }
}
