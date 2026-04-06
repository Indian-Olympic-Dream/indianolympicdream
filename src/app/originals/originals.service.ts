import { Injectable } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { environment } from "../../environments/environment";

export type VideoType =
  | "podcast"
  | "clip"
  | "short"
  | "highlight"
  | "documentary"
  | "interview"
  | "mixedZone";

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
    "podcast",
    "clip",
    "short",
    "highlight",
    "documentary",
    "interview",
    "mixedZone",
  ];
  return allowed.includes(type as VideoType) ? (type as VideoType) : "clip";
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
        errorPolicy: "all",
      })
      .pipe(map((result) => (result.data?.Videos?.docs || []).map(sanitizeVideo)));
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
        errorPolicy: "all",
      })
      .pipe(map((result) => (result.data?.Videos?.docs || []).map(sanitizeVideo)));
  }
}
