import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { forkJoin, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { FormatDurationPipe } from "../shared/pipes/format-duration.pipe";
import { SafeResourceUrlPipe } from "../shared/pipes/safe-resource-url.pipe";
import { OriginalsService, Video } from "./originals.service";

type OriginalsTab = "podcast" | "short" | "interview";

interface OriginalsVideoView extends Video {
  resolvedYoutubeId: string | null;
  thumbnailUrl: string;
  thumbnailFallbacks: string[];
  playable: boolean;
  publishedLabel: string;
}

interface TabVideoCache {
  podcast: OriginalsVideoView[];
  short: OriginalsVideoView[];
  interview: OriginalsVideoView[];
}

interface TabLoadedState {
  podcast: boolean;
  short: boolean;
  interview: boolean;
}

interface TabCountState {
  podcast: number | null;
  short: number | null;
  interview: number | null;
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
  tabLoading = signal(false);
  loadError = signal<string | null>(null);

  activeTab = signal<OriginalsTab>("podcast");

  // Video player state
  playingVideoId = signal<string | null>(null);
  loadingVideoId = signal<string | null>(null);

  readonly tabs: { id: OriginalsTab; label: string; icon: string }[] = [
    { id: "podcast", label: "Podcasts", icon: "podcasts" },
    { id: "short", label: "Shorts", icon: "short_text" },
    { id: "interview", label: "Interviews", icon: "mic" },
  ];

  private tabVideos = signal<TabVideoCache>({
    podcast: [],
    short: [],
    interview: [],
  });

  private loadedTabs = signal<TabLoadedState>({
    podcast: false,
    short: false,
    interview: false,
  });

  private tabCounts = signal<TabCountState>({
    podcast: null,
    short: null,
    interview: null,
  });

  currentTabVideos = computed(() => this.tabVideos()[this.activeTab()]);

  displayVideos = computed(() => this.currentTabVideos());

  ngOnInit(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.loadTabCounts();

    this.fetchTabVideos("podcast").subscribe({
      next: (videos) => {
        this.setTabVideos("podcast", videos);
        this.markTabLoaded("podcast");
        this.syncPlayback();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set("Unable to load Originals right now.");
        this.loading.set(false);
      },
    });
  }

  setTab(tabId: OriginalsTab): void {
    if (this.activeTab() === tabId) return;
    this.activeTab.set(tabId);
    this.syncPlayback();
    this.ensureTabLoaded(tabId);
  }

  getTabCountLabel(tab: OriginalsTab): string {
    const cached = this.tabCounts()[tab];
    if (cached !== null) return String(cached);
    if (this.loadedTabs()[tab]) return String(this.tabVideos()[tab].length);
    return "—";
  }

  getTypeLabel(): string {
    const labels: Record<OriginalsTab, string> = {
      podcast: "Podcast",
      short: "Short",
      interview: "Interview",
    };
    return labels[this.activeTab()];
  }

  getTypeIcon(): string {
    const icons: Record<OriginalsTab, string> = {
      podcast: "podcasts",
      short: "short_text",
      interview: "mic",
    };
    return icons[this.activeTab()];
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

  private loadTabCounts(): void {
    this.fetchTabCounts().subscribe({
      next: (counts) => {
        this.tabCounts.set(counts);
      },
      error: () => {
        this.tabCounts.set({
          podcast: null,
          short: null,
          interview: null,
        });
      },
    });
  }

  private ensureTabLoaded(tab: OriginalsTab): void {
    if (this.loadedTabs()[tab]) return;
    this.tabLoading.set(true);

    this.fetchTabVideos(tab).subscribe({
      next: (videos) => {
        this.setTabVideos(tab, videos);
        this.markTabLoaded(tab);
        this.syncPlayback();
        this.tabLoading.set(false);
      },
      error: () => {
        this.tabLoading.set(false);
        this.loadError.set("Unable to load Originals right now.");
      },
    });
  }

  private fetchTabVideos(tab: OriginalsTab) {
    return this.originalsService
      .getVideosByType(tab, 140)
      .pipe(map((videos) => this.normalizeTabVideos(videos || [])));
  }

  private fetchTabCounts() {
    return forkJoin({
      podcast: this.originalsService.getVideosCountByType("podcast").pipe(catchError(() => of(null))),
      short: this.originalsService.getVideosCountByType("short").pipe(catchError(() => of(null))),
      interview: this.originalsService.getVideosCountByType("interview").pipe(catchError(() => of(null))),
    });
  }

  private normalizeTabVideos(videos: Video[]): OriginalsVideoView[] {
    const dedupe = new Map<string, OriginalsVideoView>();

    videos.forEach((video) => {
      if (!video?.id) return;
      dedupe.set(video.id, this.toViewVideo(video));
    });

    return [...dedupe.values()].sort((a, b) => this.getDateWeight(b.publishedDate) - this.getDateWeight(a.publishedDate));
  }

  private setTabVideos(tab: OriginalsTab, videos: OriginalsVideoView[]): void {
    videos.forEach((video) => {
      this.thumbnailFallbackIndex.delete(video.id);
    });

    this.tabVideos.set({
      ...this.tabVideos(),
      [tab]: videos,
    });
  }

  private markTabLoaded(tab: OriginalsTab): void {
    this.loadedTabs.set({
      ...this.loadedTabs(),
      [tab]: true,
    });
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
