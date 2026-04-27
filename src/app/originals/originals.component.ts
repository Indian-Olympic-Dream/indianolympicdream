import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { forkJoin } from "rxjs";
import { map } from "rxjs/operators";
import { FormatDurationPipe } from "../shared/pipes/format-duration.pipe";
import { SafeResourceUrlPipe } from "../shared/pipes/safe-resource-url.pipe";
import { OriginalsService, Video } from "./originals.service";

type OriginalsTab = "ground" | "podcast" | "interview" | "short" | "clip";
type OriginalsTypeFilter = "all" | OriginalsTab;

interface OriginalsSportFilterOption {
  slug: string;
  name: string;
  pictogramUrl: string | null;
  count: number;
}

interface OriginalsVideoView extends Video {
  resolvedYoutubeId: string | null;
  thumbnailUrl: string;
  thumbnailFallbacks: string[];
  playable: boolean;
  publishedLabel: string;
}

interface TabVideoCache {
  ground: OriginalsVideoView[];
  podcast: OriginalsVideoView[];
  short: OriginalsVideoView[];
  interview: OriginalsVideoView[];
  clip: OriginalsVideoView[];
}

@Component({
  selector: "app-originals",
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormatDurationPipe,
    SafeResourceUrlPipe,
  ],
  templateUrl: "./originals.component.html",
  styleUrls: ["./originals.page.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OriginalsComponent implements OnInit {
  private originalsService = inject(OriginalsService);
  private thumbnailFallbackIndex = new Map<string, number>();

  loading = signal(true);
  loadError = signal<string | null>(null);

  activeTypeFilter = signal<OriginalsTypeFilter>("all");
  activeSportFilter = signal<string>("all");

  // Video player state
  playingVideoId = signal<string | null>(null);
  loadingVideoId = signal<string | null>(null);

  readonly typeFilters: { id: OriginalsTypeFilter; label: string; icon: string }[] = [
    { id: "all", label: "All", icon: "apps" },
    { id: "ground", label: "IOD On Ground", icon: "videocam" },
    { id: "podcast", label: "Podcasts", icon: "podcasts" },
    { id: "interview", label: "Interviews", icon: "mic" },
    { id: "clip", label: "Clips", icon: "play_circle" },
    { id: "short", label: "Shorts", icon: "short_text" },
  ];

  private tabVideos = signal<TabVideoCache>({
    ground: [],
    podcast: [],
    short: [],
    interview: [],
    clip: [],
  });

  sportFilters = computed<OriginalsSportFilterOption[]>(() => {
    const sportMap = new Map<string, OriginalsSportFilterOption>();

    this.getAllUniqueVideos().forEach((video) => {
      video.sports.forEach((sport) => {
        const existing = sportMap.get(sport.slug);
        if (existing) {
          existing.count += 1;
          if (!existing.pictogramUrl && sport.pictogramUrl) {
            existing.pictogramUrl = sport.pictogramUrl;
          }
          return;
        }

        sportMap.set(sport.slug, {
          slug: sport.slug,
          name: sport.name,
          pictogramUrl: sport.pictogramUrl || null,
          count: 1,
        });
      });
    });

    return [...sportMap.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  });

  visibleTypeFilters = computed(() => {
    const order = new Map(this.typeFilters.map((filter, index) => [filter.id, index]));
    const visible = this.typeFilters.filter((filter) => filter.id === "all" || this.getTypeCount(filter.id) > 0);

    const allFilter = visible.find((filter) => filter.id === "all") || null;
    const sortable = visible
      .filter((filter) => filter.id !== "all")
      .sort((a, b) => {
        const countDelta = this.getTypeCount(b.id) - this.getTypeCount(a.id);
        if (countDelta !== 0) return countDelta;
        return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
      });

    return allFilter ? [allFilter, ...sortable] : sortable;
  });

  currentTypeVideos = computed(() => {
    const type = this.activeTypeFilter();
    const baseVideos = type === "all" ? this.getAllUniqueVideos() : this.tabVideos()[type];
    return this.filterVideosBySport(baseVideos);
  });

  isShortDisplayMode = computed(() => this.activeTypeFilter() === "short");

  displayVideos = computed(() => this.currentTypeVideos());

  ngOnInit(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.preloadAllTabs().subscribe({
      next: (tabs) => {
        this.tabVideos.set(tabs);
        this.resetThumbnailFallbacks();
        this.ensureActiveTypeFilterIsVisible();
        this.syncPlayback();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set("Unable to load Originals right now.");
        this.loading.set(false);
      },
    });
  }

  setTypeFilter(filterId: OriginalsTypeFilter): void {
    if (this.activeTypeFilter() === filterId) return;
    this.activeTypeFilter.set(filterId);
    this.syncPlayback();
  }

  setSportFilter(slug: string): void {
    this.activeSportFilter.set(slug);
    this.ensureActiveTypeFilterIsVisible();
    this.syncPlayback();
  }

  getTypeCountLabel(filter: OriginalsTypeFilter): string {
    return String(this.getTypeCount(filter));
  }

  trackSportFilter(_: number, sport: OriginalsSportFilterOption): string {
    return sport.slug;
  }

  onSportFilterImageError(sport: OriginalsSportFilterOption): void {
    sport.pictogramUrl = null;
  }

  getActiveSportName(): string {
    if (this.activeSportFilter() === "all") return "";
    return this.sportFilters().find((sport) => sport.slug === this.activeSportFilter())?.name || "";
  }

  getActiveTypeLabel(): string {
    const labels: Record<OriginalsTypeFilter, string> = {
      all: "Videos",
      ground: "On Ground",
      podcast: "Podcasts",
      clip: "Clips",
      short: "Shorts",
      interview: "Interviews",
    };
    return labels[this.activeTypeFilter()];
  }

  getEmbedUrl(youtubeId?: string | null): string {
    if (!youtubeId) return "";
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&enablejsapi=1&rel=0`;
  }

  getVideoEmbedUrl(video: OriginalsVideoView): string {
    return this.getEmbedUrl(video.resolvedYoutubeId);
  }

  isPlaying(video: OriginalsVideoView): boolean {
    return this.playingVideoId() === video.id;
  }

  playVideo(video: OriginalsVideoView): void {
    if (!video.playable || !video.resolvedYoutubeId) return;
    if (this.playingVideoId() === video.id) return;
    if (this.loadingVideoId() === video.id) return;

    this.loadingVideoId.set(video.id);
    this.playingVideoId.set(video.id);
  }

  stopVideo(event?: Event): void {
    event?.stopPropagation();
    this.loadingVideoId.set(null);
    this.playingVideoId.set(null);
  }

  onVideoLoad(videoId: string): void {
    if (this.loadingVideoId() === videoId) {
      this.loadingVideoId.set(null);
    }
  }

  openOnYouTube(video: OriginalsVideoView, event?: Event): void {
    event?.stopPropagation();
    if (!video.resolvedYoutubeId) return;
    window.open(`https://www.youtube.com/watch?v=${video.resolvedYoutubeId}`, "_blank", "noopener");
  }

  onThumbnailError(video: OriginalsVideoView, event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;

    const nextIndex = this.thumbnailFallbackIndex.get(video.id) ?? 0;
    const nextFallback = video.thumbnailFallbacks[nextIndex];

    if (nextFallback) {
      this.thumbnailFallbackIndex.set(video.id, nextIndex + 1);
      img.src = nextFallback;
      return;
    }

    img.src = "assets/images/placeholder.svg";
  }

  trackByVideo(_: number, video: OriginalsVideoView): string {
    return video.id;
  }

  private preloadAllTabs() {
    const limit = 140;
    return forkJoin({
      podcast: this.originalsService.getVideosByType("podcast", limit),
      documentary: this.originalsService.getVideosByType("documentary", limit),
      interview: this.originalsService.getVideosByType("interview", limit),
      mixedZone: this.originalsService.getVideosByType("mixedZone", limit),
      highlight: this.originalsService.getVideosByType("highlight", limit),
      clip: this.originalsService.getVideosByType("clip", limit),
      short: this.originalsService.getVideosByType("short", limit),
    }).pipe(
      map((source) => ({
        ground: this.normalizeTabVideos([
          ...source.mixedZone,
          ...source.highlight,
          ...source.podcast,
        ], "ground"),
        podcast: this.normalizeTabVideos([
          ...source.podcast,
          ...source.documentary,
        ], "podcast"),
        interview: this.normalizeTabVideos(source.interview, "interview"),
        clip: this.normalizeTabVideos(source.clip, "clip"),
        short: this.normalizeTabVideos([
          ...source.short,
          ...source.highlight,
        ], "short"),
      })),
    );
  }

  private isInterviewFamilyVideo(video: Video): boolean {
    return video.type === "interview";
  }

  private isOnGroundFamilyVideo(video: Video): boolean {
    if (video.type === "mixedZone") return true;
    if (this.isShortFormVideo(video)) return false;
    if (video.type === "highlight") return true;
    return video.type === "podcast" && this.isOnGroundTitle(video.title);
  }

  private isPodcastFamilyVideo(video: Video): boolean {
    if (video.type === "documentary") return true;
    if (video.type !== "podcast") return false;
    if (this.isOnGroundTitle(video.title)) return false;
    return !this.isClipLikeTitle(video.title);
  }

  private isClipFamilyVideo(video: Video): boolean {
    return video.type === "clip";
  }

  private isShortFamilyVideo(video: Video): boolean {
    if (video.type === "short") return true;
    return video.type === "highlight" && this.isShortFormVideo(video);
  }

  private filterVideosBySport(videos: OriginalsVideoView[]): OriginalsVideoView[] {
    const activeSport = this.activeSportFilter();
    if (activeSport === "all") return videos;
    return videos.filter((video) => video.sports.some((sport) => sport.slug === activeSport));
  }

  private isVideoInTab(video: Video, tab: OriginalsTab): boolean {
    switch (tab) {
      case "ground":
        return this.isOnGroundFamilyVideo(video);
      case "podcast":
        return this.isPodcastFamilyVideo(video);
      case "interview":
        return this.isInterviewFamilyVideo(video);
      case "clip":
        return this.isClipFamilyVideo(video);
      case "short":
        return this.isShortFamilyVideo(video);
      default:
        return false;
    }
  }

  private getTypeFamilyLabel(video: Video): string {
    if (this.isOnGroundFamilyVideo(video)) return "On Ground";
    if (this.isInterviewFamilyVideo(video)) return "Interviews";
    if (this.isPodcastFamilyVideo(video)) return "Podcasts";
    if (this.isClipFamilyVideo(video)) return "Clips";
    if (this.isShortFamilyVideo(video)) return "Shorts";
    return "Originals";
  }

  private getTypeFamilyIcon(video: Video): string {
    if (this.isOnGroundFamilyVideo(video)) return "videocam";
    if (this.isInterviewFamilyVideo(video)) return "mic";
    if (this.isPodcastFamilyVideo(video)) return "podcasts";
    if (this.isClipFamilyVideo(video)) return "play_circle";
    if (this.isShortFamilyVideo(video)) return "short_text";
    return "video_library";
  }

  getFallbackTypeLabel(video: OriginalsVideoView): string {
    return this.getTypeFamilyLabel(video);
  }

  getFallbackTypeIcon(video: OriginalsVideoView): string {
    return this.getTypeFamilyIcon(video);
  }

  private normalizeTabVideos(videos: Video[], tab: OriginalsTab): OriginalsVideoView[] {
    const dedupe = new Map<string, OriginalsVideoView>();

    videos.forEach((video) => {
      if (!video?.id) return;
      const viewVideo = this.toViewVideo(video);
      if (!this.isVideoInTab(viewVideo, tab)) return;

      const dedupeKey = this.getDiscoveryKey(viewVideo, tab);
      const existing = dedupe.get(dedupeKey);
      if (!existing || this.getPreferredVideoScore(viewVideo, tab) > this.getPreferredVideoScore(existing, tab)) {
        dedupe.set(dedupeKey, viewVideo);
      }
    });

    return [...dedupe.values()].sort((a, b) => this.getDateWeight(b.publishedDate) - this.getDateWeight(a.publishedDate));
  }

  private getAllUniqueVideos(): OriginalsVideoView[] {
    const dedupe = new Map<string, OriginalsVideoView>();
    const tabs = this.tabVideos();

    Object.values(tabs).forEach((videos) => {
      videos.forEach((video) => {
        if (!dedupe.has(video.id)) {
          dedupe.set(video.id, video);
        }
      });
    });

    return [...dedupe.values()].sort(
      (a, b) => this.getDateWeight(b.publishedDate) - this.getDateWeight(a.publishedDate),
    );
  }

  private getTypeCount(filter: OriginalsTypeFilter): number {
    if (filter === "all") {
      return this.filterVideosBySport(this.getAllUniqueVideos()).length;
    }
    return this.filterVideosBySport(this.tabVideos()[filter]).length;
  }

  private ensureActiveTypeFilterIsVisible(): void {
    if (this.activeTypeFilter() === "all") return;
    if (this.getTypeCount(this.activeTypeFilter()) > 0) return;
    this.activeTypeFilter.set("all");
  }

  private isClipLikeTitle(title?: string | null): boolean {
    const value = (title || "").toLowerCase();
    return /\bclip\b|\bclips\b|\bteaser\b|\bsnippet\b|\bpromo\b|\btrailer\b/.test(value);
  }

  private isOnGroundTitle(title?: string | null): boolean {
    const value = (title || "").toLowerCase();
    return /\bvlog\b|\blive\b|\bstream\b|\blivestream\b|\blive stream\b|\bday\s*\d+\b|\bon ground\b/.test(value);
  }

  private isShortFormVideo(video: Video): boolean {
    const duration = video.duration || 0;
    if (video.type === "short") return true;
    if (duration > 0 && duration <= 95) return true;
    return this.isClipLikeTitle(video.title) && duration > 0 && duration <= 180;
  }

  private getDiscoveryKey(video: OriginalsVideoView, tab: OriginalsTab): string {
    if (tab === "short") {
      return video.id;
    }

    const normalizedTitle = (video.title || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\b(and|the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return normalizedTitle || video.id;
  }

  private getPreferredVideoScore(video: OriginalsVideoView, tab: OriginalsTab): number {
    const duration = video.duration || 0;
    const title = (video.title || "").toLowerCase();
    let score = 0;

    if (!this.isClipLikeTitle(title)) score += 100;
    if (!/\bcropped\b|\bcut\b|\bedit\b|\bexcerpt\b/.test(title)) score += 30;
    if (video.playable) score += 20;

    if (tab === "short") {
      score += Math.max(0, 180 - duration);
    } else {
      score += Math.min(duration, 7200) / 10;
    }

    return score;
  }

  private resetThumbnailFallbacks(): void {
    this.tabVideos().ground.forEach((video) => this.thumbnailFallbackIndex.delete(video.id));
    this.tabVideos().podcast.forEach((video) => this.thumbnailFallbackIndex.delete(video.id));
    this.tabVideos().interview.forEach((video) => this.thumbnailFallbackIndex.delete(video.id));
    this.tabVideos().clip.forEach((video) => this.thumbnailFallbackIndex.delete(video.id));
    this.tabVideos().short.forEach((video) => this.thumbnailFallbackIndex.delete(video.id));
  }

  private resolveYoutubeId(video: Video): string | null {
    if (typeof video.youtubeId === "string" && /^[a-zA-Z0-9_-]{11}$/.test(video.youtubeId)) {
      return video.youtubeId;
    }

    const raw = typeof video.youtubeURL === "string" ? video.youtubeURL.trim() : "";
    if (!raw) return null;

    const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch?.[1]) return shortMatch[1];

    const queryMatch = raw.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (queryMatch?.[1]) return queryMatch[1];

    const embedMatch = raw.match(/embed\/([a-zA-Z0-9_-]{11})/i);
    if (embedMatch?.[1]) return embedMatch[1];

    return null;
  }

  private toViewVideo(video: Video): OriginalsVideoView {
    const resolvedYoutubeId = this.resolveYoutubeId(video);
    const mediaUrl = this.normalizeMediaUrl(video.thumbnail?.url || "");
    const youtubeFallbacks = resolvedYoutubeId
      ? this.buildYouTubeThumbnailFallbacks(resolvedYoutubeId, video.type === "short")
      : [];

    const thumbnailUrl = mediaUrl
      || youtubeFallbacks[0]
      || "assets/images/placeholder.svg";
    const thumbnailFallbacks = mediaUrl
      ? youtubeFallbacks
      : youtubeFallbacks.slice(1);

    return {
      ...video,
      resolvedYoutubeId,
      thumbnailUrl,
      thumbnailFallbacks,
      playable: !!resolvedYoutubeId,
      publishedLabel: this.formatDate(video.publishedDate),
    };
  }

  private buildYouTubeThumbnailFallbacks(youtubeId: string, isShort: boolean): string[] {
    const shortFirst = [
      `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`,
      `https://i.ytimg.com/vi/${youtubeId}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi_webp/${youtubeId}/hqdefault.webp`,
      `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${youtubeId}/default.jpg`,
      `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    ];

    if (isShort) return shortFirst;

    return [
      `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${youtubeId}/sddefault.jpg`,
      `https://i.ytimg.com/vi_webp/${youtubeId}/hqdefault.webp`,
      `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${youtubeId}/default.jpg`,
      `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    ];
  }

  private formatDate(dateStr?: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  private normalizeMediaUrl(rawUrl: string): string {
    const url = (rawUrl || "").trim();
    if (!url) return "";
    if (url.startsWith("/media/")) return `/api${url}`;
    return url;
  }

  private getDateWeight(value?: string | null): number {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }

  private syncPlayback(): void {
    const playingId = this.playingVideoId();
    if (!playingId) return;

    const visibleIds = new Set(this.displayVideos().map((video) => video.id));
    if (!visibleIds.has(playingId)) {
      this.loadingVideoId.set(null);
      this.playingVideoId.set(null);
    }
  }
}
