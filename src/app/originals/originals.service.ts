import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { forkJoin, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { environment } from "../../environments/environment";

export type VideoType =
  | "video"
  | "podcast"
  | "clip"
  | "short"
  | "highlight"
  | "documentary"
  | "interview"
  | "mixedZone"
  | "live"
  | "vlogs";

export interface Video {
  id: string;
  title: string;
  description?: string | null;
  youtubeURL?: string | null;
  youtubeId?: string | null;
  type: VideoType;
  duration?: number | null;
  publishedDate?: string | null;
  featured: boolean;
  broadcast?: {
    status?: 'scheduled' | 'live' | 'replay' | null;
    scheduledStartTime?: string | null;
  } | null;
  thumbnail?: {
    url?: string | null;
    alt?: string | null;
  } | null;
  sports: {
    id: string;
    name: string;
    slug: string;
    pictogramUrl?: string | null;
  }[];
  athletes: {
    id: string;
    fullName: string;
  }[];
  calendarEvents: {
    id: string;
    slug?: string | null;
    title: string;
  }[];
  tags: {
    name: string;
  }[];
}

const normalizeOriginalsMediaUrl = (rawUrl: unknown): string | null => {
  const value = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return normalizeOriginalsMediaPath(`${environment.payload_url}${value}`);
  }

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const isLoopbackHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (isLoopbackHost) {
      return normalizeOriginalsMediaPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
  } catch {
    // Keep raw URL as-is when parsing fails.
  }

  return value;
};

const normalizeOriginalsMediaPath = (path: string): string => {
  if (!path) return path;
  if (path.startsWith("/media/")) {
    return `/api${path}`;
  }
  return path;
};

const sanitizeVideoType = (type: unknown): VideoType => {
  const allowed: VideoType[] = [
    "video",
    "podcast",
    "clip",
    "short",
    "highlight",
    "documentary",
    "interview",
    "mixedZone",
    "live",
    "vlogs",
  ];
  return allowed.includes(type as VideoType) ? (type as VideoType) : "video";
};

const sanitizeVideo = (row: any): Video => ({
  id: String(row?.id || ""),
  title: typeof row?.title === "string" && row.title.trim() ? row.title : "Untitled",
  description: typeof row?.description === "string" ? row.description : null,
  youtubeURL: typeof row?.youtubeURL === "string" ? row.youtubeURL : null,
  youtubeId: typeof row?.youtubeId === "string" ? row.youtubeId : null,
  type: sanitizeVideoType(row?.type),
  duration: typeof row?.duration === "number" ? row.duration : null,
  publishedDate: typeof row?.publishedDate === "string" ? row.publishedDate : null,
  featured: !!row?.featured,
  broadcast: row?.broadcast && ['scheduled', 'live', 'replay'].includes(row.broadcast.status)
    ? { status: row.broadcast.status, scheduledStartTime: row.broadcast.scheduledStartTime || null }
    : null,
  thumbnail:
    row?.thumbnail && typeof row.thumbnail === "object"
      ? {
          url: typeof row.thumbnail.url === "string" ? row.thumbnail.url : null,
          alt: typeof row.thumbnail.alt === "string" ? row.thumbnail.alt : null,
        }
      : null,
  sports: Array.isArray(row?.sports)
    ? row.sports
        .filter(Boolean)
        .map((sport: any) => ({
          id: String(sport?.id || ""),
          name: typeof sport?.name === "string" ? sport.name : "",
          slug: typeof sport?.slug === "string" ? sport.slug : "",
          pictogramUrl: normalizeOriginalsMediaUrl(sport?.pictogram?.url),
        }))
        .filter((sport: { id: string; slug: string }) => !!sport.id && !!sport.slug)
    : [],
  athletes: Array.isArray(row?.athletes)
    ? row.athletes
        .filter(Boolean)
        .map((athlete: any) => ({
          id: String(athlete?.id || ""),
          fullName: typeof athlete?.fullName === "string" ? athlete.fullName : "",
        }))
        .filter((athlete: { id: string }) => !!athlete.id)
    : [],
  calendarEvents: Array.isArray(row?.calendarEvents)
    ? row.calendarEvents
        .filter(Boolean)
        .map((calendarEvent: any) => ({
          id: String(calendarEvent?.id || ""),
          slug: typeof calendarEvent?.slug === "string" ? calendarEvent.slug : null,
          title:
            typeof calendarEvent?.title === "string"
              ? calendarEvent.title
              : typeof calendarEvent?.name === "string"
                ? calendarEvent.name
                : "",
        }))
        .filter((calendarEvent: { id: string }) => !!calendarEvent.id)
    : [],
  tags: Array.isArray(row?.tags)
    ? row.tags
        .filter(Boolean)
        .map((tag: any) => ({
          name: typeof tag?.name === "string" ? tag.name : "",
        }))
        .filter((tag: { name: string }) => !!tag.name)
    : [],
});

const GET_ALL_VIDEOS = gql`
  query Videos($limit: Int, $page: Int, $sort: String) {
    Videos(limit: $limit, page: $page, sort: $sort) {
      docs {
        id
        title
        description
        youtubeURL
        youtubeId
        type
        duration
        thumbnail { url alt }
        publishedDate
        featured
        broadcast { status scheduledStartTime }
        sports {
          id
          name
          slug
          pictogram { url }
        }
        athletes {
          id
          fullName
        }
        calendarEvents {
          id
          slug
          title: name
        }
        tags {
          name
        }
      }
      totalDocs
    }
  }
`;

const GET_VIDEOS_BY_TYPE = gql`
  query VideosByType($type: Video_type_Input, $limit: Int, $sort: String) {
    Videos(where: { type: { equals: $type } }, limit: $limit, sort: $sort) {
      docs {
        id
        title
        description
        youtubeURL
        youtubeId
        type
        duration
        thumbnail { url alt }
        publishedDate
        featured
        broadcast { status scheduledStartTime }
        sports {
          id
          name
          slug
          pictogram { url }
        }
        athletes {
          id
          fullName
        }
        calendarEvents {
          id
          slug
          title: name
        }
        tags {
          name
        }
      }
      totalDocs
    }
  }
`;

const GET_VIDEOS_BY_CALENDAR_EVENTS = gql`
  query VideosByCalendarEvents($where: Video_where, $limit: Int, $sort: String) {
    Videos(where: $where, limit: $limit, sort: $sort) {
      docs {
        id
        title
        description
        youtubeURL
        youtubeId
        type
        duration
        thumbnail { url alt }
        publishedDate
        featured
        broadcast { status scheduledStartTime }
        sports {
          id
          name
          slug
          pictogram { url }
        }
        athletes {
          id
          fullName
        }
        calendarEvents {
          id
          slug
          title: name
        }
        tags {
          name
        }
      }
      totalDocs
    }
  }
`;

export const resolveYouTubeVideoId = (video: Pick<Video, "youtubeId" | "youtubeURL">): string | null => {
  if (typeof video.youtubeId === "string" && /^[a-zA-Z0-9_-]{11}$/.test(video.youtubeId)) {
    return video.youtubeId;
  }

  const raw = typeof video.youtubeURL === "string" ? video.youtubeURL.trim() : "";
  if (!raw) return null;

  const direct = raw.match(/^([a-zA-Z0-9_-]{11})$/);
  if (direct?.[1]) return direct[1];

  const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch?.[1]) return shortMatch[1];

  const queryMatch = raw.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (queryMatch?.[1]) return queryMatch[1];

  const embedMatch = raw.match(/embed\/([a-zA-Z0-9_-]{11})/i);
  const liveMatch = raw.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i);
  const shortsMatch = raw.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  return embedMatch?.[1] || liveMatch?.[1] || shortsMatch?.[1] || null;
};

export const getYouTubeThumbnailUrl = (video: Pick<Video, "youtubeId" | "youtubeURL" | "thumbnail">): string | null => {
  const managed = normalizeOriginalsMediaUrl(video.thumbnail?.url);
  if (managed) return managed;
  const youtubeId = resolveYouTubeVideoId(video);
  return youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null;
};

@Injectable({
  providedIn: "root",
})
export class OriginalsService {
  constructor(private apollo: Apollo) { }

  getAllVideos(
    limit: number = 100,
    page: number = 1,
  ): Observable<Video[]> {
    return this.apollo
      .query<{ Videos: { docs: any[] } }>({
        query: GET_ALL_VIDEOS,
        variables: { limit, page, sort: "-publishedDate" },
        fetchPolicy: "network-only",
        errorPolicy: "none",
      })
      .pipe(map((result) => (result.data?.Videos?.docs || []).map(sanitizeVideo)));
  }

  /** Merge upcoming/live shows with recent uploads, independently of import order. */
  getHomeVideos(limit = 40): Observable<Video[]> {
    return forkJoin([this.apollo.query<{ Videos: { docs: any[] } }>({
      query: GET_VIDEOS_BY_CALENDAR_EVENTS,
      variables: { where: {}, limit, sort: '-publishedDate' },
      fetchPolicy: 'network-only',
      errorPolicy: 'none',
    }), this.apollo.query<{ Videos: { docs: any[] } }>({
      query: GET_VIDEOS_BY_CALENDAR_EVENTS,
      variables: { where: { OR: [{ broadcast__status: { equals: 'live' } }, { broadcast__status: { equals: 'scheduled' } }] }, limit: 20, sort: '-publishedDate' },
      fetchPolicy: 'network-only',
      errorPolicy: 'none',
    })]).pipe(map(results => [...new Map(results.flatMap(result => (result.data?.Videos?.docs || []).map(sanitizeVideo)).map(video => [video.id, video])).values()]));
  }

  getVideosByType(
    type: string,
    limit: number = 20,
  ): Observable<Video[]> {
    return this.apollo
      .query<{ Videos: { docs: any[] } }>({
        query: GET_VIDEOS_BY_TYPE,
        variables: { type, limit, sort: "-publishedDate" },
        fetchPolicy: "network-only",
        errorPolicy: "none",
      })
      .pipe(map((result) => (result.data?.Videos?.docs || []).map(sanitizeVideo)));
  }

  getVideosForCalendarEvents(
    calendarEventIds: string[],
    limit: number = 12,
  ): Observable<Video[]> {
    const ids = Array.from(new Set(calendarEventIds.map((id) => id.trim()).filter(Boolean)));
    if (!ids.length) return of([]);

    return this.apollo
      .query<{ Videos: { docs: any[] } }>({
        query: GET_VIDEOS_BY_CALENDAR_EVENTS,
        variables: {
          where: { calendarEvents: { in: ids } },
          limit,
          sort: "-publishedDate",
        },
        fetchPolicy: "network-only",
        errorPolicy: "none",
      })
      .pipe(map((result) => (result.data?.Videos?.docs || []).map(sanitizeVideo)));
  }
}
