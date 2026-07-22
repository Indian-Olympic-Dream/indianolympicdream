import { CommonModule } from "@angular/common";
import { Component, NgZone, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { RouterModule } from "@angular/router";
import { PayloadService, Sport } from "../services/payload.service";
import {
  CWG_2026_GAMES_KEY,
  CwgGamesParticipation,
  CwgScheduleData,
  CwgScheduleRow,
  getParticipationAthleteName,
  getParticipationSport,
  getParticipationSportName,
} from "./cwg-2026.types";

interface WatchGroup {
  groupKey: string;
  title: string;
  rank: number;
  rows: CwgGamesParticipation[];
}

interface ScheduleDateGroup {
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  sessionCount: number;
  goldCount: number;
  rows: CwgScheduleRow[];
}

export interface WatchStory {
  rank: number;
  title: string;
  sport: string;
  event: string;
  posterUrl?: string;
  shortStatus: "released" | "scheduled";
  shortLabel: string;
  shortUrl?: string;
  group: WatchGroup | null;
  nextSession: CwgScheduleRow | null;
  isToday: boolean;
}

const DEFAULT_POSTERS: Record<number, string> = {
  1: "assets/images/cwg/ten-to-watch/01-neeraj-chopra-rohit-yadav.png",
  2: "assets/images/cwg/ten-to-watch/02-sreeshankar-lokesh.png",
  3: "assets/images/cwg/ten-to-watch/03-sarvesh-kushare-tejaswin-shankar.png",
  4: "assets/images/cwg/ten-to-watch/04-mirabai-chanu.png",
  5: "assets/images/cwg/ten-to-watch/05-gulveer-singh.png",
  6: "assets/images/cwg/ten-to-watch/06-jaismine-lamboria.png",
  7: "assets/images/cwg/ten-to-watch/07-praveen-chithravel.png",
  8: "assets/images/cwg/ten-to-watch/08-parul-chaudhary.png",
  9: "assets/images/cwg/ten-to-watch/09-sakshi-chaudhary.png",
  10: "assets/images/cwg/ten-to-watch/10-gurindervir-singh.png",
};

@Component({
  selector: "app-cwg-2026-home",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./cwg-2026-home.component.html",
  styleUrl: "./cwg-2026-home.component.scss",
})
export class Cwg2026HomeComponent implements OnInit, OnDestroy {
  private readonly payload = inject(PayloadService);
  private readonly ngZone = inject(NgZone);
  private clockTimer?: ReturnType<typeof setInterval>;

  readonly medalIconUrl = "assets/images/cwg/glasgow-gold-medal.svg";
  readonly glasgowLogoUrl = "assets/images/cwg/glasgow-2026-logo-vertical.svg";
  readonly participations = signal<CwgGamesParticipation[]>([]);
  readonly scheduleData = signal<CwgScheduleData>({
    gamesDates: "23 July–2 August 2026",
    timezone: "IST",
    scheduleEdition: "Glasgow 2026 Schedule",
    rows: [],
  });
  readonly now = signal(new Date());
  readonly isRosterLoading = signal(true);
  readonly hasRosterError = signal(false);
  readonly isScheduleLoading = signal(true);
  readonly hasScheduleError = signal(false);

  readonly scheduleRows = computed(() =>
    [...this.scheduleData().rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
  );

  readonly summary = computed(() => {
    const roster = this.participations();
    const scheduleRows = this.scheduleRows();
    const ableRows = roster.filter((row) => row.competitionStream === "able-bodied");
    const paraRows = roster.filter((row) => row.competitionStream === "para");

    const goldsCount = new Set(scheduleRows.flatMap((row) => row.goldMedalEvents || [])).size;

    return {
      athletes: roster.length || 126,
      ableAthletes: ableRows.length || 97,
      paraAthletes: paraRows.length || 29,
      sports: new Set(roster.map((row) => getParticipationSportName(row))).size || 13,
      ableSports: new Set(ableRows.map((row) => getParticipationSportName(row))).size || 8,
      paraSports: new Set(paraRows.map((row) => getParticipationSportName(row))).size || 5,
      scheduleEntries: scheduleRows.length || 204,
      golds: goldsCount || 108,
    };
  });

  readonly watchGroups = computed(() => {
    const groups = new Map<string, WatchGroup>();

    this.participations()
      .filter((row) => row.watchList?.isTenToWatch)
      .forEach((row) => {
        const key = row.watchList?.groupKey || String(row.watchList?.rank || row.rosterOrder || row.id);
        const group = groups.get(key) || {
          groupKey: key,
          title: row.watchList?.groupTitle || getParticipationAthleteName(row),
          rank: row.watchList?.rank || 99,
          rows: [],
        };
        group.rows.push(row);
        groups.set(key, group);
      });

    return [...groups.values()].sort((a, b) => a.rank - b.rank);
  });

  readonly watchStories = computed<WatchStory[]>(() => {
    return this.watchGroups().map((group) => {
      const firstRow = group.rows[0];
      const rank = group.rank;
      const watchList = firstRow?.watchList;
      const shortStatus: "released" | "scheduled" = watchList?.shortStatus || (rank >= 5 ? "released" : "scheduled");
      const shortUrl = watchList?.shortUrl;
      const posterUrl = watchList?.posterUrl || DEFAULT_POSTERS[rank];
      const sport = firstRow ? getParticipationSportName(firstRow) : "Sport";
      const event = group.rows.map((r) => r.eventName || r.eventBucket).filter(Boolean).join(" & ");

      const nextSession = this.findNextSessionForGroup(group);

      return {
        rank,
        title: group.title,
        sport,
        event: event || "Event",
        posterUrl,
        shortStatus,
        shortLabel: shortStatus === "released" ? "Short out" : "Short soon",
        shortUrl,
        group,
        nextSession,
        isToday: nextSession ? this.isSameDay(this.getSessionStartMs(nextSession), this.now().getTime()) : false,
      };
    });
  });

  readonly releasedShortsCount = computed(() => this.watchStories().filter((s) => s.shortStatus === "released").length);
  readonly scheduledShortsCount = computed(() => this.watchStories().filter((s) => s.shortStatus === "scheduled").length);

  readonly watchRailStories = computed(() => {
    return this.watchStories().sort((a, b) => a.rank - b.rank);
  });

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
    const now = this.now().getTime();
    return this.scheduleRows()
      .filter((row) => this.getSessionStartMs(row) <= now && this.getSessionEndMs(row) >= now)
      .slice(0, 3);
  });

  readonly upcomingSessions = computed(() => {
    const now = this.now().getTime();
    const upcoming = this.scheduleRows().filter((row) => this.getSessionEndMs(row) >= now);
    return (upcoming.length ? upcoming : this.scheduleRows()).slice(0, 6);
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
    const rows = this.scheduleRows().filter((row) => this.getSessionEndMs(row) >= now);
    const effectiveRows = rows.length ? rows : this.scheduleRows();

    const groupsMap = new Map<string, ScheduleDateGroup>();

    for (const row of effectiveRows) {
      const key = `${row.dayLabel} ${row.dateLabel}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          dateKey: key,
          dateLabel: row.dateLabel,
          dayLabel: row.dayLabel,
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
    const groups = this.upcomingDateGroups();

    if (selectedKey === "all" || !selectedKey) {
      const now = this.now().getTime();
      const upcoming = this.scheduleRows().filter((row) => this.getSessionEndMs(row) >= now);
      return (upcoming.length ? upcoming : this.scheduleRows()).slice(0, 8);
    }

    const group = groups.find((g) => g.dateKey === selectedKey);
    return group ? group.rows : [];
  });

  readonly goldMedalSessions = computed(() => {
    const now = this.now().getTime();
    const rows = this.scheduleRows().filter(
      (row) => row.isMedalSession || (row.goldMedalEvents && row.goldMedalEvents.length > 0)
    );
    const upcoming = rows.filter((row) => this.getSessionEndMs(row) >= now);
    return (upcoming.length ? upcoming : rows).slice(0, 6);
  });

  setSelectedDateKey(key: string): void {
    this.selectedDateKey.set(key);
  }

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.ngZone.run(() => this.now.set(new Date())), 60 * 1000);
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

    this.isScheduleLoading.set(true);
    this.payload.getGamesHubSchedule<CwgScheduleData>(CWG_2026_GAMES_KEY).subscribe({
      next: (schedule) => {
        if (schedule?.rows?.length) {
          this.scheduleData.set(schedule);
        }
        this.isScheduleLoading.set(false);
        this.hasScheduleError.set(false);
      },
      error: () => {
        this.isScheduleLoading.set(false);
        this.hasScheduleError.set(true);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  trackByWatchGroup(_: number, group: WatchGroup): string {
    return group.groupKey;
  }

  trackByWatchStory(_: number, story: WatchStory): number {
    return story.rank;
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

  getSessionBadge(row: CwgScheduleRow): string {
    if (this.isSessionLive(row)) return "Live";

    // 1. Explicit CMS Badge Override (from Payload CMS)
    if (row.badgeOverride && row.badgeOverride !== "auto") {
      if (row.badgeOverride === "confirmed") return "Confirmed";
      if (row.badgeOverride === "qual-dependent") return "Qual. Dependent";
      if (row.badgeOverride === "draw-pending") return "Draw Pending";
      if (row.badgeOverride === "gold-medal") return "Gold Medal";
    }

    const eventName = (row.event || "").toLowerCase();
    const cert = (row.certainty || "").toLowerCase();

    // 1. Direct Stage Labels from Official PDF
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
      return "Gold Medal";
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
    if (badge === "Live") return "importance-live";
    if (badge === "Gold Medal") return "importance-core";
    if (badge === "Confirmed") return "importance-confirmed";
    if (badge === "Draw Pending") return "importance-pending";
    if (badge === "Qual. Dependent" || badge === "Conditional") return "importance-high";
    return "importance-context";
  }

  isSessionLive(row: CwgScheduleRow): boolean {
    const now = this.now().getTime();
    return this.getSessionStartMs(row) <= now && this.getSessionEndMs(row) >= now;
  }

  getSportName(participation: CwgGamesParticipation): string {
    return getParticipationSportName(participation);
  }

  getWatchTitle(story: WatchStory): string {
    return story.title;
  }

  getWatchMeta(story: WatchStory): string {
    return `${story.sport} · ${story.event}`;
  }

  getWatchTiming(story: WatchStory): string {
    const session = story.nextSession;
    if (!session) return "Schedule TBC";
    if (this.isSessionLive(session)) return `Live now · ${session.timeLabel}`;
    if (story.isToday) return `Today · ${session.timeLabel}`;
    return `${session.dayLabel} ${session.dateLabel} · ${session.timeLabel}`;
  }

  getWatchStatusClass(story: WatchStory): string {
    return story.shortStatus === "released" ? "short-released" : "short-scheduled";
  }

  getQuestionLabel(): string {
    return "Athlete in focus";
  }

  private getSessionStartMs(row: CwgScheduleRow): number {
    const timestamp = Date.parse(row.istStart || row.sortKey);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private getSessionEndMs(row: CwgScheduleRow): number {
    const timestamp = row.istEnd ? Date.parse(row.istEnd) : NaN;
    if (Number.isFinite(timestamp)) return timestamp;
    return this.getSessionStartMs(row) + 2 * 60 * 60 * 1000;
  }

  private normalizeSportKey(value?: string | null): string {
    return (value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private findNextSessionForGroup(group: WatchGroup): CwgScheduleRow | null {
    const now = this.now().getTime();
    const firstRow = group.rows[0];
    if (!firstRow) return null;

    // Build sport match: compare displayGroup/sport name against schedule sport
    const groupSport = this.normalizeSearchText(getParticipationSportName(firstRow));

    // Build event keywords from all participation eventName values in this group
    // e.g. "Men's 100m" → ["men s 100m", "100m"]
    // e.g. "Men's 5000m and 10,000m" → ["men s 5000m and 10 000m", "5000m", "10 000m", "10000m"]
    const eventKeywords = this.extractEventKeywords(group);

    const matches = this.scheduleRows()
      .filter((row) => {
        const rowSport = this.normalizeSearchText(row.sport);
        const rowEvent = this.normalizeSearchText(row.event);

        // Sport must match
        const sportMatch = rowSport.includes(groupSport) || groupSport.includes(rowSport);
        if (!sportMatch) return false;

        // Event keywords must match
        return eventKeywords.some((keyword) => rowEvent.includes(keyword));
      })
      .sort((a, b) => this.getSessionStartMs(a) - this.getSessionStartMs(b));

    return matches.find((row) => this.getSessionEndMs(row) >= now) || matches[0] || null;
  }

  /**
   * Extract meaningful event keywords from the participation rows in a watch group.
   * Handles compound events like "Men's 5000m and 10,000m" by splitting on 'and'/','
   * and extracting short tokens like "5000m", "javelin", "100m", "57kg", etc.
   */
  private extractEventKeywords(group: WatchGroup): string[] {
    const keywords: string[] = [];
    const seen = new Set<string>();

    for (const row of group.rows) {
      const raw = row.eventName || row.eventBucket || "";

      // Normalise and split compound event descriptions on common delimiters
      const parts = raw
        .replace(/,/g, " and ")
        .split(/\band\b|\+|&/i)
        .map((p) => p.trim())
        .filter(Boolean);

      for (const part of parts) {
        const normalized = this.normalizeSearchText(part);

        // Extract the core event token: the last meaningful word/phrase
        // e.g. "Men's javelin throw" → "javelin"
        // e.g. "Women's 3000m steeplechase" → "3000m steeplechase", "steeplechase", "3000m"
        // e.g. "Men's 100m" → "100m"
        // e.g. "Women's 57kg" → "57kg"
        const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);

        // Add full normalized part
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          keywords.push(normalized);
        }

        // Add individual meaningful tokens (skip gendered prefixes)
        const skipTokens = new Set(["men", "s", "women", "mixed", "men s", "women s"]);
        for (const token of tokens) {
          if (!skipTokens.has(token) && !seen.has(token) && token.length > 1) {
            // Only add tokens that look like event identifiers
            // (contain digits, or are sport-specific terms)
            const isEventToken =
              /\d/.test(token) || // "100m", "57kg", "5000m", "48kg"
              token.length >= 4;  // "javelin", "steeplechase", "triple", "long", "high", "decathlon"
            if (isEventToken) {
              seen.add(token);
              keywords.push(token);
            }
          }
        }
      }
    }

    return keywords;
  }

  private isSameDay(leftMs: number, rightMs: number): boolean {
    const left = new Date(leftMs);
    const right = new Date(rightMs);
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private normalizeSearchText(value?: string | null): string {
    return (value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
