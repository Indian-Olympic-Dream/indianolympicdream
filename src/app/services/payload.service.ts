import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * PayloadService - GraphQL client for Payload CMS
 * Uses Apollo Angular for all queries
 */

// ============ TYPES ============

export interface Sport {
  id: string;
  name: string;
  slug: string;
  alias?: string;
  pictogram?: { url: string } | null;
  description?: string;
  parentSport?: Sport | null;
  isParentOnly?: boolean;
}

export interface Athlete {
  id: string;
  fullName: string;
  slug: string;
  country: string;
  gender?: 'male' | 'female';
  state?: string;
  photo?: { url: string } | null;
  bio?: any;
  birthDate?: string;
  isActive?: boolean;
  worldRanking?: number;
  careerHighlights?: any;
  sports: Sport[];
  socialHandles?: { platform: string; url: string }[];
}

export interface Edition {
  id: string;
  name: string;
  slug: string;
  year: number;
  city: string;
  hostCountry?: string;
  type: 'summer' | 'winter';
  status: 'upcoming' | 'qualification' | 'games' | 'completed';
  logo?: { url: string } | null;
  heroImage?: { url: string } | null;
  startDate?: string;
  endDate?: string;
  // History context fields
  tagline?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };

  globalStats?: {
    totalNations?: number;
    totalAthletes?: number;
    totalEvents?: number;
    indiaRank?: number;
  };
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  sport: Sport;
  gender: 'men' | 'women' | 'mixed';
  type: string;
}

export interface OlympicParticipation {
  id: string;
  athlete: Athlete;
  edition: Edition;
  event: Event;
  result: 'gold' | 'silver' | 'bronze' | '4th-8th' | 'participated' | 'dnf' | 'dns' | 'dq' | 'reserve';
  placement?: number;
  performance?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  sport?: Sport;
  startDate: string;
  endDate?: string;
  location?: string;
  country?: string;
  category?: string;
  status: string;
  isQualifier?: boolean;
}

export interface QualificationPathway {
  id: string;
  title: string;
  edition: Edition;
  sport: Sport;
  description?: any;
  quotaAvailable?: number;
  qualificationDeadline?: string;
}

// ============ GRAPHQL QUERIES ============

const SPORTS_QUERY = gql`
  query GetSports($where: Sport_where, $limit: Int) {
    Sports(where: $where, limit: $limit) {
      docs {
        id
        name
        slug
        alias
        description
        isParentOnly
        pictogram { url }
        parentSport { id name slug pictogram { url } }
      }
    }
  }
`;

const SPORT_BY_SLUG_QUERY = gql`
  query GetSportBySlug($slug: String!) {
    Sports(where: { slug: { equals: $slug } }, limit: 1) {
      docs {
        id
        name
        slug
        alias
        description
        isParentOnly
        pictogram { url }
        parentSport { id name slug pictogram { url } }
      }
    }
  }
`;



export interface GoldenMoment {
  id: string;
  title: string;
  description: string;
  year: number;
  city: string;
  event: string;
  sport?: Sport | null;
  athlete: string;
  media?: {
    url: string;
    alt: string;
    credits?: string;
  } | null;
  linkedStory?: {
    slug: string;
  };
  externalLink?: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  basePrice: number;
  type: 'infographic' | 'merch';
  images: { image: { url: string } }[];
  variants: {
    name: string;
    type: 'print' | 'frame' | 'adhesive';
    surcharge: number;
  }[];
  associatedTags?: {
    sport?: Sport;
    athlete?: Athlete;
    edition?: Edition;
  };
}

const ATHLETES_QUERY = gql`
  query GetAthletes($where: Athlete_where, $limit: Int, $page: Int) {
  Athletes(where: $where, limit: $limit, page: $page) {
      docs {
      id
      fullName
      slug
      country
      state
      isActive
      worldRanking
        photo { url }
        sports { id name slug }
    }
    totalDocs
    totalPages
    page
  }
}
`;

const ATHLETE_BY_SLUG_QUERY = gql`
  query GetAthleteBySlug($slug: String!) {
  Athletes(where: { slug: { equals: $slug } }, limit: 1) {
      docs {
      id
      fullName
      slug
      country
      gender
      state
      birthDate
      isActive
      worldRanking
      bio
      careerHighlights
        photo { url }
        sports { id name slug }
        socialHandles { platform url }
    }
  }
}
`;

const EDITIONS_QUERY = gql`
  query GetEditions($where: Edition_where, $limit: Int, $sort: String) {
  Editions(where: $where, limit: $limit, sort: $sort) {
      docs {
      id
      name
      slug
      year
      city
      hostCountry
      type
      status
      startDate
      endDate
        logo { url }
      tagline
      colors
        heroImage { url }
        globalStats {
        totalNations
        totalAthletes
        totalEvents
        indiaRank
      }
    }
  }
}
`;

const PARTICIPATIONS_QUERY = gql`
  query GetParticipations($where: OlympicParticipation_where, $limit: Int) {
  OlympicParticipations(where: $where, limit: $limit) {
      docs {
      id
      result
      placement
      performance
        athlete {
          id
          fullName
          slug
          photo { url }
          sports {
            id
            name
            slug
            parentSport { id }
          }
        }
        edition { id name slug year }
        event { id name type sport { id name slug pictogram { url } parentSport { id name slug pictogram { url } } }
    }
  }
}
  }
`;

// Lightweight query for counting - fetches only IDs
const PARTICIPATIONS_COUNTS_QUERY = gql`
  query GetParticipationCounts($limit: Int) {
  OlympicParticipations(limit: $limit) {
      docs {
        athlete { id }
        edition { id year }
    }
  }
}
`;

const CALENDAR_EVENTS_QUERY = gql`
  query GetCalendarEvents($where: CalendarEvent_where, $limit: Int) {
  CalendarEvents(where: $where, limit: $limit, sort: "startDate") {
      docs {
      id
      title
      startDate
      endDate
      location
      country
      category
      status
      isQualifier
        sport { id name slug }
    }
  }
}
`;

const QUALIFICATION_PATHWAYS_QUERY = gql`
  query GetQualificationPathways($where: QualificationPathway_where, $limit: Int) {
  QualificationPathways(where: $where, limit: $limit) {
      docs {
      id
      title
      quotaAvailable
      qualificationDeadline
      description
        edition { id name slug year }
        sport { id name slug }
    }
  }
}
`;

const GOLDEN_MOMENTS_QUERY = gql`
  query GetGoldenMoments {
    GoldenMoments(limit: 100, sort: "year") {
      docs {
        id
        title
        description
        year
        city
        event
        sport {
          id
          name
          slug
          parentSport { id name slug }
        }
        athlete
        media {
          url
          alt
          credits
        }
        linkedStory {
          slug
        }
        externalLink
      }
    }
  }
`;

const PRODUCTS_QUERY = gql`
  query GetProducts($limit: Int) {
    Products(limit: $limit) {
      totalDocs
      docs {
        id
        title
        slug
        basePrice
        type
        images { image { url } }
        variants { name type surcharge }
        associatedTags {
           sport { name slug }
           athlete { fullName slug }
           edition { name year }
        }
      }
    }
  }
`;

// ============ SERVICE ============

@Injectable({
  providedIn: 'root'
})
export class PayloadService {
  private apollo = inject(Apollo);

  // Fallback image for athletes without photos
  readonly FALLBACK_ATHLETE_IMAGE = 'assets/images/placeholder.svg';

  getMediaUrl(media: { url: string } | undefined | null): string | null {
    if (!media?.url) return null;
    return this.normalizeMediaUrl(media.url);
  }

  private normalizeMediaUrl(rawUrl: string): string {
    const url = rawUrl.trim();
    if (!url) return '';

    // Relative payload media path (dev proxy / prod same-origin)
    if (!/^https?:\/\//i.test(url)) {
      return this.normalizeMediaPath(`${environment.payload_url}${url}`);
    }

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

      // LAN devices cannot resolve localhost from CMS responses; use same-origin path so Angular proxy can serve it.
      if (isLoopbackHost) {
        return this.normalizeMediaPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      }
    } catch {
      // Keep raw URL as-is when parsing fails.
    }

    return url;
  }

  private normalizeMediaPath(path: string): string {
    if (!path) return path;
    if (path.startsWith('/media/')) {
      return `/api${path}`;
    }
    return path;
  }

  // ============ SPORTS ============

  getSports(options?: { parentOnly?: boolean; discipline?: boolean }): Observable<Sport[]> {
    let where: any = {};
    if (options?.parentOnly) {
      where.isParentOnly = { equals: true };
    }
    if (options?.discipline) {
      where.isParentOnly = { equals: false };
    }

    return this.apollo.query<{ Sports: { docs: Sport[] } }>({
      query: SPORTS_QUERY,
      variables: { where, limit: 100 }
    }).pipe(map(result => result.data.Sports.docs));
  }


  getSportBySlug(slug: string): Observable<Sport | null> {
    return this.apollo.query<{ Sports: { docs: Sport[] } }>({
      query: SPORT_BY_SLUG_QUERY,
      variables: { slug }
    }).pipe(map(result => result.data.Sports.docs[0] || null));
  }

  // ============ ATHLETES ============

  getAthletes(options?: {
    sportId?: string;
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Observable<{ docs: Athlete[]; totalDocs: number; totalPages: number; page: number }> {
    let where: any = {};
    if (options?.sportId) {
      where.sports = { contains: options.sportId };
    }
    if (options?.isActive !== undefined) {
      where.isActive = { equals: options.isActive };
    }
    if (options?.search) {
      where.fullName = { contains: options.search };
    }

    return this.apollo.query<{ Athletes: { docs: Athlete[]; totalDocs: number; totalPages: number; page: number } }>({
      query: ATHLETES_QUERY,
      variables: { where, limit: options?.limit || 20, page: options?.page || 1 },
      errorPolicy: 'all',
      fetchPolicy: 'network-only',
    }).pipe(
      map((result) => result.data?.Athletes || { docs: [], totalDocs: 0, totalPages: 0, page: options?.page || 1 })
    );
  }

  getAthleteBySlug(slug: string): Observable<Athlete | null> {
    return this.apollo.query<{ Athletes: { docs: Athlete[] } }>({
      query: ATHLETE_BY_SLUG_QUERY,
      variables: { slug }
    }).pipe(map(result => result.data.Athletes.docs[0] || null));
  }

  getAthleteImageUrl(athlete: Athlete): string {
    if (athlete.photo?.url) {
      return environment.payload_url + athlete.photo.url;
    }
    return this.FALLBACK_ATHLETE_IMAGE;
  }

  // ============ EDITIONS ============

  getEditions(options?: { status?: string; limit?: number }): Observable<Edition[]> {
    let where: any = {};
    if (options?.status) {
      where.status = { equals: options.status };
    }

    return this.apollo.query<{ Editions: { docs: Edition[] } }>({
      query: EDITIONS_QUERY,
      variables: { where, limit: options?.limit || 50, sort: '-year' }
    }).pipe(map(result => result.data.Editions.docs));
  }

  getEditionBySlug(slug: string): Observable<Edition | null> {
    return this.apollo.query<{ Editions: { docs: Edition[] } }>({
      query: EDITIONS_QUERY,
      variables: { where: { slug: { equals: slug } }, limit: 1 }
    }).pipe(map(result => result.data.Editions.docs[0] || null));
  }

  // ============ PARTICIPATIONS ============

  getParticipations(options?: {
    athleteId?: string;
    editionId?: string;
    result?: 'gold' | 'silver' | 'bronze';
    limit?: number;
  }): Observable<OlympicParticipation[]> {
    let where: any = {};
    if (options?.athleteId) {
      where.athlete = { equals: options.athleteId };
    }
    if (options?.editionId) {
      where.edition = { equals: options.editionId };
    }
    if (options?.result) {
      where.result = { equals: options.result };
    }

    return this.apollo.query<{ OlympicParticipations: { docs: OlympicParticipation[] } }>({
      query: PARTICIPATIONS_QUERY,
      variables: { where, limit: options?.limit || 500 },
      fetchPolicy: 'network-only',
    }).pipe(map(result => result.data.OlympicParticipations.docs));
  }

  getMedalists(): Observable<OlympicParticipation[]> {
    return this.apollo.query<{ OlympicParticipations: { docs: OlympicParticipation[] } }>({
      query: PARTICIPATIONS_QUERY,
      variables: { where: { result: { in: ['gold', 'silver', 'bronze'] } }, limit: 500 },
      fetchPolicy: 'network-only',
    }).pipe(map(result => result.data.OlympicParticipations.docs));
  }

  // Lightweight method for counting athletes per edition
  getParticipationCounts(): Observable<{ athleteId: string; editionId: string; year: number }[]> {
    return this.apollo.query<{ OlympicParticipations: { docs: { athlete: { id: string } | null; edition: { id: string; year: number } | null }[] } }>({
      query: PARTICIPATIONS_COUNTS_QUERY,
      variables: { limit: 2000 }
    }).pipe(map(result => result.data.OlympicParticipations.docs
      .filter(d => d.athlete?.id && d.edition?.id) // Filter out orphan records
      .map(d => ({
        athleteId: d.athlete!.id,
        editionId: d.edition!.id,
        year: d.edition!.year || 0
      }))
    ));
  }

  // ============ CALENDAR EVENTS ============

  getCalendarEvents(options?: {
    sportId?: string;
    status?: string;
    isQualifier?: boolean;
    limit?: number;
  }): Observable<CalendarEvent[]> {
    let where: any = {};
    if (options?.sportId) {
      where.sport = { equals: options.sportId };
    }
    if (options?.status) {
      where.status = { equals: options.status };
    }
    if (options?.isQualifier !== undefined) {
      where.isQualifier = { equals: options.isQualifier };
    }

    return this.apollo.query<{ CalendarEvents: { docs: CalendarEvent[] } }>({
      query: CALENDAR_EVENTS_QUERY,
      variables: { where, limit: options?.limit || 50 }
    }).pipe(map(result => result.data.CalendarEvents.docs));
  }

  // ============ QUALIFICATION PATHWAYS ============

  getQualificationPathways(options?: {
    sportId?: string;
    editionId?: string;
  }): Observable<QualificationPathway[]> {
    let where: any = {};
    if (options?.sportId) {
      where.sport = { equals: options.sportId };
    }
    if (options?.editionId) {
      where.edition = { equals: options.editionId };
    }

    return this.apollo.query<{ QualificationPathways: { docs: QualificationPathway[] } }>({
      query: QUALIFICATION_PATHWAYS_QUERY,
      variables: { where, limit: 50 }
    }).pipe(map(result => result.data.QualificationPathways.docs));
  }

  getGoldenMoments(): Observable<GoldenMoment[]> {
    return this.apollo.query<{ GoldenMoments: { docs: GoldenMoment[] } }>({
      query: GOLDEN_MOMENTS_QUERY,
    }).pipe(map(result => result.data.GoldenMoments.docs));
  }

  getProducts(limit: number = 20): Observable<Product[]> {
    return this.apollo.watchQuery<any>({
      query: PRODUCTS_QUERY,
      variables: { limit },
      context: { headers: { 'x-apollo-operation-name': 'GetProducts' } }
    }).valueChanges.pipe(map(result => result.data.Products.docs));
  }

  getProductsCount(): Observable<number> {
    return this.apollo.query<{ Products: { totalDocs: number } }>({
      query: PRODUCTS_QUERY,
      variables: { limit: 1 },
      context: { headers: { 'x-apollo-operation-name': 'GetProducts' } }
    }).pipe(map(result => result.data.Products.totalDocs || 0));
  }
}
