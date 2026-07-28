import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import {
  CwgOfficialResultEntry,
  CwgResultCompetitor,
  CwgScheduleRow,
  getBoxingEventTitle,
  getCountryFlagEmoji,
} from "./cwg-2026.types";

@Component({
  selector: "app-cwg-2026-result-detail",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./cwg-2026-result-detail.component.html",
  styleUrl: "./cwg-2026-result-detail.component.scss",
})
export class Cwg2026ResultDetailComponent {
  @Input({ required: true }) row!: CwgScheduleRow;

  private sanitizer = inject(DomSanitizer);

  getCompetitorFlag(competitor: CwgResultCompetitor): { isSvg: boolean; safeSvg?: SafeHtml; textEmoji?: string } {
    const code = (competitor?.countryCode || competitor?.countryName || "").toUpperCase();

    if (code === "WAL" || code === "WALES") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="24" height="16" style="border-radius:2px;display:block;box-shadow:0 0 2px rgba(0,0,0,0.4);"><rect width="600" height="200" fill="#ffffff"/><rect y="200" width="600" height="200" fill="#00b140"/><path fill="#d42e12" d="M 280,120 Q 250,90 230,120 Q 210,150 240,180 Q 270,210 310,240 Q 340,200 370,170 Q 340,140 310,160 Z"/><circle cx="270" cy="140" r="10" fill="#ffffff"/></svg>`;
      return { isSvg: true, safeSvg: this.sanitizer ? this.sanitizer.bypassSecurityTrustHtml(svg) : undefined };
    }

    if (code === "SCO" || code === "SCOTLAND") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3" width="24" height="16" style="border-radius:2px;display:block;box-shadow:0 0 2px rgba(0,0,0,0.4);"><rect width="5" height="3" fill="#005eb8"/><path stroke="#ffffff" stroke-width="0.6" d="M0,0 L5,3 M0,3 L5,0"/></svg>`;
      return { isSvg: true, safeSvg: this.sanitizer ? this.sanitizer.bypassSecurityTrustHtml(svg) : undefined };
    }

    if (code === "ENG" || code === "ENGLAND") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3" width="24" height="16" style="border-radius:2px;display:block;box-shadow:0 0 2px rgba(0,0,0,0.4);"><rect width="5" height="3" fill="#ffffff"/><rect x="2" width="1" height="3" fill="#ce1124"/><rect y="1" width="5" height="1" fill="#ce1124"/></svg>`;
      return { isSvg: true, safeSvg: this.sanitizer ? this.sanitizer.bypassSecurityTrustHtml(svg) : undefined };
    }

    return {
      isSvg: false,
      textEmoji: competitor?.flagEmoji || getCountryFlagEmoji(code),
    };
  }

  get eventTitle(): string {
    if (!this.row) return "";
    return getBoxingEventTitle(this.row);
  }

  get sportDisplayName(): string {
    return this.row?.sportName || this.row?.sport || "";
  }

  get displayTime(): string {
    return this.row?.timeLabel || this.row?.indiaTimeLabel || "";
  }

  get isParaPowerlifting(): boolean {
    const slug = (this.row?.sportSlug || this.row?.sportName || this.row?.sport || "").toLowerCase();
    return slug.includes("powerlifting") || slug.includes("pwl");
  }

  get medalType(): 'gold' | 'silver' | 'bronze' | null {
    const summary = (this.row?.result?.summaryLabel || this.row?.result?.resultLabel || "").toUpperCase();
    if (summary.includes("GOLD") || summary.includes("🥇")) return 'gold';
    if (summary.includes("SILVER") || summary.includes("🥈")) return 'silver';
    if (summary.includes("BRONZE") || summary.includes("🥉")) return 'bronze';
    return null;
  }

  get summaryLabelText(): string {
    const raw = this.row?.result?.summaryLabel || this.row?.result?.resultLabel || 'Completed';
    return raw.replace(/[🥇🥈🥉]/g, '').trim();
  }

  getCwgMedalSvg(type: 'gold' | 'silver' | 'bronze', width: number = 20, height: number = 26): SafeHtml | undefined {
    if (!this.sanitizer) return undefined;

    let glowColor = '#f59e0b';
    let stop1 = '#fef08a', stop2 = '#f59e0b', stop3 = '#b45309';

    if (type === 'silver') {
      glowColor = '#94a3b8';
      stop1 = '#ffffff'; stop2 = '#94a3b8'; stop3 = '#475569';
    } else if (type === 'bronze') {
      glowColor = '#ea580c';
      stop1 = '#ffedd5'; stop2 = '#ea580c'; stop3 = '#7c2d12';
    }

    const gradId = `cwgMedalGrad_${type}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 135" width="${width}" height="${height}" style="display:inline-block;vertical-align:middle;filter:drop-shadow(0 2px 4px ${glowColor}66);">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${stop1}"/>
          <stop offset="50%" stop-color="${stop2}"/>
          <stop offset="100%" stop-color="${stop3}"/>
        </linearGradient>
        <linearGradient id="cwgMedalRibbonGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#312e81"/>
        </linearGradient>
      </defs>
      <!-- Dark Blue Ribbon -->
      <path d="M 38,0 L 62,0 L 65,30 L 35,30 Z" fill="url(#cwgMedalRibbonGrad)"/>
      <path d="M 44,10 L 50,20 L 56,10 M 41,6 L 50,18 L 59,6" stroke="#818cf8" stroke-width="1.8" fill="none" stroke-linecap="round"/>

      <!-- Glasgow Shield Medal Body -->
      <path d="M 35,30 Q 50,26 65,30 C 88,46 98,80 50,130 C 2,80 12,46 35,30 Z" fill="url(#${gradId})" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>

      <!-- Finnieston Crane Grid Framework -->
      <path d="M 22,43 C 32,68 38,93 48,123" stroke="rgba(0,0,0,0.35)" stroke-width="2.2" fill="none"/>
      <path d="M 22,43 C 32,68 38,93 48,123" stroke="rgba(255,255,255,0.3)" stroke-width="1" fill="none"/>
      <path d="M 23,46 L 35,49 M 26,60 L 38,64 M 29,74 L 41,79 M 33,88 L 44,94 M 37,103 L 46,109" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/>

      <!-- CWG Crown Logo -->
      <g transform="translate(64, 50) scale(0.26)">
        <path fill="rgba(255,255,255,0.92)" d="M0,0 L12,28 L24,0 L18,0 L12,18 L6,0 Z M30,0 L42,28 L54,0 L48,0 L42,18 L36,0 Z M-30,0 L-18,28 L-6,0 L-12,0 L-18,18 L-24,0 Z"/>
      </g>
      <!-- CWG 2026 -->
      <text x="64" y="73" font-size="7" font-family="'Geist Mono', sans-serif" font-weight="900" fill="rgba(255,255,255,0.95)" text-anchor="middle" letter-spacing="0.5">CWG</text>
      <text x="64" y="82" font-size="5.5" font-family="'Geist Mono', sans-serif" font-weight="800" fill="rgba(255,255,255,0.85)" text-anchor="middle">2026</text>
    </svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  get isWonResult(): boolean {
    const summary = (this.row?.result?.summaryLabel || this.row?.result?.resultLabel || "").toUpperCase();
    return (
      summary.includes("WON") ||
      summary.includes("GOLD") ||
      summary.includes("SILVER") ||
      summary.includes("BRONZE") ||
      summary.includes("QUALIFIED") ||
      summary.includes(" Q") ||
      summary.endsWith("Q")
    );
  }

  get isLostResult(): boolean {
    if (this.isWonResult) return false;
    const summary = (this.row?.result?.summaryLabel || this.row?.result?.resultLabel || "").toUpperCase();
    if (summary.includes("QUALIFIED") || summary.includes(" Q") || summary.endsWith("Q")) {
      return false;
    }
    const match = this.row?.result?.match;
    if (match?.winner && match.winner !== 'India' && !match.winner.includes('India')) {
      return true;
    }
    return summary.includes("LOST") || summary.includes("DEFEAT") || summary.includes("15 - 21") || summary.includes("1 - 16");
  }

  get competitors(): CwgResultCompetitor[] {
    const match = this.row?.result?.match;
    return [match?.competitor1, match?.competitor2].filter(
      (competitor): competitor is CwgResultCompetitor => Boolean(competitor?.name),
    );
  }

  get rawOfficialIndiaEntries(): CwgOfficialResultEntry[] {
    return this.row?.result?.officialEventResult?.india || [];
  }

  get isGymnasticsAllAround(): boolean {
    return (
      /gymnastics/i.test(this.sportDisplayName) &&
      /all-around/i.test(this.eventTitle)
    );
  }

  get officialIndiaEntries(): CwgOfficialResultEntry[] {
    if (!this.isGymnasticsAllAround) return this.rawOfficialIndiaEntries;
    const overallEntries = this.rawOfficialIndiaEntries.filter(
      (entry) => entry.bucket === "overall",
    );
    return overallEntries.length ? overallEntries : this.rawOfficialIndiaEntries;
  }

  get hasDetailedResult(): boolean {
    return Boolean(
      this.row?.result &&
        (this.competitors.length ||
          this.row.result.leaderboard?.length ||
          this.officialIndiaEntries.length ||
          this.row.result.summary ||
          this.row.result.summaryLabel),
    );
  }

  get officialSourceUrl(): string {
    const sourceUrl =
      this.row?.result?.officialSourceUrl ||
      this.row?.result?.officialEventResult?.detailUrl ||
      "";

    if (!sourceUrl) return "";

    try {
      const url = new URL(sourceUrl);
      const isMachineEndpoint =
        url.hostname.includes("api.commonwealthsport.com") ||
        url.hostname.includes("crs-cg2026-api.glasgow2026.com") ||
        url.pathname.includes("/api/");
      return isMachineEndpoint
        ? "https://www.glasgow2026.com/results/detailed/"
        : sourceUrl;
    } catch {
      return sourceUrl;
    }
  }

  getCountryFlag(country?: string | null): string {
    return getCountryFlagEmoji(country);
  }

  getCompetitorScore(competitor: CwgResultCompetitor): string {
    if (competitor.totalScore !== undefined && competitor.totalScore !== null) {
      return String(competitor.totalScore);
    }
    return competitor.scores?.map(String).join(" · ") || "";
  }

  getCompetitorScoreParts(competitor: CwgResultCompetitor): { scoreText: string; rankBadge: string | null } {
    const raw = this.getCompetitorScore(competitor);
    if (!raw) return { scoreText: "", rankBadge: null };

    const match = raw.match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
    if (match && match[2]) {
      return {
        scoreText: match[1].trim(),
        rankBadge: match[2].trim(),
      };
    }

    return { scoreText: raw, rankBadge: null };
  }

  getOfficialEntryName(entry: CwgOfficialResultEntry): string {
    return entry.names?.filter(Boolean).join(", ") || entry.organisationCode || "India";
  }
}
