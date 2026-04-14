import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { IndiaTier, SportLifecycle } from '../models/india-tier';

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
  heroImage?: { url: string } | null;
  currentHeroImage?: { url: string } | null;
  legacyHeroImage?: { url: string } | null;
  description?: string;
  currentFocusAthletes?: {
    id: string;
    fullName: string;
    slug: string;
    photo?: { url: string } | null;
  }[];
  indiaTier?: IndiaTier | null;
  olympicStatus?: SportLifecycle | null;
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

export interface CalendarEventParticipant {
  id: string;
  fullName: string;
  slug: string;
  photo?: { url: string } | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  slug?: string;
  summary?: string;
  sport?: Sport;
  edition?: Edition | null;
  startDate: string;
  endDate?: string;
  location?: string;
  country?: string;
  type?: string;
  category?: string;
  eventScope?: 'sport_event' | 'qualification_window' | 'multi_sport_window';
  importance?: 'core' | 'high' | 'watch' | 'context';
  status: string;
  isQualifier?: boolean;
  heroImage?: { url: string } | null;
  hubKey?: string;
  qualificationContext?: string;
  indianParticipants?: CalendarEventParticipant[];
  externalUrl?: string;
  whereToWatch?: {
    url?: string;
    label?: string;
    note?: string;
  } | null;
  notes?: string;
}

export type CalendarEventExperience = 'external_only' | 'preview_page' | 'covered_page' | 'live_hub';

export interface CalendarEventNavigation {
  experience: CalendarEventExperience;
  kind: 'internal' | 'external' | 'none';
  routerLink: string[] | null;
  href: string | null;
  target: '_blank' | null;
  rel: string | null;
}

export interface QualificationPathway {
  id: string;
  title: string;
  edition: Edition;
  sport: Sport;
  description?: any;
  quotaAvailable?: number;
  programmeEventCount?: number;
  maxEntriesPerNoc?: string;
  qualificationFormat?: string;
  qualificationDeadline?: string;
  currentCycleContext?: string;
  qualifyingEvents?: {
    eventName: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  }[];
  externalLinks?: {
    label: string;
    url: string;
  }[];
}

export interface ContenderUnit {
  id: string;
  displayName: string;
  status: 'medal_hopeful' | 'outside_chance' | 'qualification_only' | 'qualification_watch' | 'history_only';
  indiaTier?: IndiaTier | null;
  type: 'individual' | 'pair' | 'team' | 'event_team';
  sport: Sport;
  events?: Event[] | null;
  gender?: 'male' | 'female' | 'mixed';
  athletes?: Athlete[];
  heroImage?: { url: string } | null;
  priority?: number;
  cycle?: string;
  isActive?: boolean;
}

export interface ContenderUnitResult {
  docs: ContenderUnit[];
  totalDocs: number;
}

export interface RetiredSportStat {
  name: string;
  count: number;
}

export interface RetiredAthleteRow {
  id: string;
  name: string;
  country: string;
  photoUrl: string | null;
  sports: string[];
  sportsDisplay: string;
  events: string[];
  eventsDisplay: string;
  sportPictograms: Record<string, string>;
  sportMedalCounts: Record<string, number>;
  editionIds: string[];
  editions: string[];
  editionYears: number[];
  firstEditionYear: number | null;
  lastEditionYear: number | null;
  editionsDisplay: string;
  participationCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  medalCount: number;
  isActive: boolean;
}

export interface RetiredAthletesFeed {
  docs: RetiredAthleteRow[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  totalRetired: number;
  facets: {
    categories: {
      team: number;
      individual: number;
      medalists: number;
    };
    sportsByCategory: {
      team: RetiredSportStat[];
      individual: RetiredSportStat[];
      medalists: RetiredSportStat[];
    };
  };
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
        indiaTier
        olympicStatus
        isParentOnly
        pictogram { url }
        heroImage { url }
        currentHeroImage { url }
        legacyHeroImage { url }
        currentFocusAthletes { id fullName slug photo { url } }
        parentSport { id name slug indiaTier olympicStatus pictogram { url } heroImage { url } currentHeroImage { url } legacyHeroImage { url } }
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
        indiaTier
        olympicStatus
        isParentOnly
        pictogram { url }
        heroImage { url }
        currentHeroImage { url }
        legacyHeroImage { url }
        currentFocusAthletes { id fullName slug photo { url } }
        parentSport { id name slug indiaTier olympicStatus pictogram { url } heroImage { url } currentHeroImage { url } legacyHeroImage { url } }
      }
    }
  }
`;



export type MomentType = 'gold' | 'silver' | 'bronze' | 'heartbreak';

export interface GoldenMoment {
  id: string;
  title: string;
  type: MomentType;
  description: string;
  year: number;
  city: string;
  event: string;
  sport?: Sport | null;
  athlete: string;
  placement?: number;
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

export interface LegacyDisciplineOverview {
  id: string;
  name: string;
  slug: string;
  pictogramUrl: string | null;
  athleteKeys: string[];
  athleteCount: number;
  participationCount: number;
  medalCount: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
}

export interface LegacyEditionOverview {
  edition: Edition;
  athleteKeys: string[];
  athleteCount: number;
  participationCount: number;
  medalCount: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
  disciplines: LegacyDisciplineOverview[];
}

export interface SportLegacyOverview {
  editions: LegacyEditionOverview[];
  goldenMoments: GoldenMoment[];
}

export interface SportLegacySummary {
  editionCount: number;
  athleteCount: number;
  participationCount: number;
  medalCount: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
}

export interface SportLegacyEditionDetail {
  participations: OlympicParticipation[];
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
        event { id name type gender sport { id name slug pictogram { url } parentSport { id name slug pictogram { url } } }
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
      title: name
      slug
      summary
      startDate
      endDate
      location
      country
      type
      category
      eventScope
      importance
      status
      isQualifier: isQualificationEvent
      hubKey
      qualificationContext
      externalUrl
      whereToWatch {
        url
        label
        note
      }
      notes
      indianParticipants {
        id
        fullName
        slug
        photo { url }
      }
        edition {
          id
          name
          slug
          year
          city
          status
          type
        }
        heroImage {
          url
        }
        sport {
          id
          name
          slug
          pictogram { url }
          parentSport { id name slug pictogram { url } }
        }
    }
  }
}
`;

const CALENDAR_EVENT_BY_SLUG_QUERY = gql`
  query GetCalendarEventBySlug($slug: String!) {
    CalendarEvents(where: { slug: { equals: $slug } }, limit: 1) {
      docs {
        id
        title: name
        slug
        summary
        startDate
        endDate
        location
        country
        type
        category
        eventScope
        importance
        status
        isQualifier: isQualificationEvent
        hubKey
        qualificationContext
        externalUrl
        whereToWatch {
          url
          label
          note
        }
        notes
        edition {
          id
          name
          slug
          year
          city
          status
          type
          heroImage {
            url
          }
        }
        heroImage {
          url
        }
        sport {
          id
          name
          slug
          description
          pictogram { url }
          parentSport { id name slug pictogram { url } }
        }
        indianParticipants {
          id
          fullName
          slug
          photo { url }
        }
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
      programmeEventCount
      maxEntriesPerNoc
      qualificationFormat
      qualificationDeadline
      currentCycleContext
      description
      qualifyingEvents {
        eventName
        startDate
        endDate
        location
      }
      externalLinks {
        label
        url
      }
        edition { id name slug year city status type }
        sport { id name slug pictogram { url } parentSport { id name slug pictogram { url } } }
    }
  }
}
`;

const CONTENDER_UNITS_QUERY = gql`
  query GetContenderUnits($where: ContenderUnit_where, $limit: Int) {
    ContenderUnits(where: $where, limit: $limit, sort: "priority") {
      totalDocs
      docs {
        id
        displayName
        status
        indiaTier
        type
        gender
        priority
        cycle
        isActive
        heroImage { url }
        events {
          id
          name
          gender
          type
        }
        sport {
          id
          name
          slug
          indiaTier
          olympicStatus
          pictogram { url }
          parentSport { id name slug indiaTier olympicStatus pictogram { url } }
        }
        athletes {
          id
          fullName
          slug
          country
          isActive
          photo { url }
          sports { id name slug }
        }
      }
    }
  }
`;

const GOLDEN_MOMENTS_QUERY = gql`
  query GetGoldenMoments {
    GoldenMoments(limit: 200, sort: "year") {
      docs {
        id
        title
        type
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
        placement
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

const GOLDEN_MOMENTS_BY_FILTER_QUERY = gql`
  query GetGoldenMomentsByFilter($where: GoldenMoment_where, $limit: Int) {
    GoldenMoments(where: $where, limit: $limit, sort: "year") {
      docs {
        id
        title
        type
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
        placement
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
  private http = inject(HttpClient);

  // Fallback image for athletes without photos
  readonly FALLBACK_ATHLETE_IMAGE = 'assets/images/placeholder.svg';
  readonly FALLBACK_SPORT_PICTOGRAM = 'assets/images/placeholder.svg';

  getMediaUrl(media: { url: string } | undefined | null): string | null {
    if (!media?.url) return null;
    return this.normalizeMediaUrl(media.url);
  }

  getSportPictogramUrl(input?: {
    sport?: Partial<Sport> | null;
    sportSlug?: string | null;
    sportName?: string | null;
    parentSport?: Partial<Sport> | null;
    includePlaceholderFallback?: boolean;
  }): string | null {
    const includePlaceholderFallback = input?.includePlaceholderFallback !== false;
    const sport = input?.sport;
    const parentSport = input?.parentSport || sport?.parentSport || null;

    const direct = this.getMediaUrl((sport?.pictogram as { url: string } | null | undefined) || null);
    if (direct) return direct;

    const parentDirect = this.getMediaUrl((parentSport?.pictogram as { url: string } | null | undefined) || null);
    if (parentDirect) return parentDirect;

    return includePlaceholderFallback ? this.FALLBACK_SPORT_PICTOGRAM : null;
  }

  getSportHeroImageUrl(input?: {
    sport?: Partial<Sport> | null;
    parentSport?: Partial<Sport> | null;
    includeParentFallback?: boolean;
    variant?: 'current' | 'legacy' | 'default';
  }): string | null {
    const sport = input?.sport;
    const includeParentFallback = input?.includeParentFallback !== false;
    const parentSport = includeParentFallback ? input?.parentSport || sport?.parentSport || null : null;
    const variant = input?.variant || 'default';

    const variantImage =
      variant === 'current'
        ? (sport?.currentHeroImage as { url: string } | null | undefined)
        : variant === 'legacy'
          ? (sport?.legacyHeroImage as { url: string } | null | undefined)
          : null;
    const direct =
      this.getMediaUrl(variantImage || null) ||
      this.getMediaUrl((sport?.heroImage as { url: string } | null | undefined) || null);
    if (direct) return direct;

    const parentVariantImage =
      variant === 'current'
        ? (parentSport?.currentHeroImage as { url: string } | null | undefined)
        : variant === 'legacy'
          ? (parentSport?.legacyHeroImage as { url: string } | null | undefined)
          : null;
    const parentDirect =
      this.getMediaUrl(parentVariantImage || null) ||
      this.getMediaUrl((parentSport?.heroImage as { url: string } | null | undefined) || null);
    if (parentDirect) return parentDirect;

    return null;
  }

  getCalendarEventExperience(
    event: Partial<CalendarEvent> | null | undefined,
    options?: {
      hasExplicitCoverage?: boolean;
      liveEnabled?: boolean;
    },
  ): CalendarEventExperience {
    void options;
    if (!event) return 'external_only';
    return 'external_only';
  }

  getCalendarEventNavigation(
    event: Partial<CalendarEvent> | null | undefined,
    options?: {
      hasExplicitCoverage?: boolean;
      liveEnabled?: boolean;
    },
  ): CalendarEventNavigation {
    const experience = this.getCalendarEventExperience(event, options);
    const slug = event?.slug ? ['/calendar', event.slug] : null;
    const href = event?.whereToWatch?.url || event?.externalUrl || null;

    if (experience === 'external_only') {
      if (href) {
        return {
          experience,
          kind: 'external',
          routerLink: null,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
        };
      }

      return {
        experience,
        kind: 'none',
        routerLink: null,
        href: null,
        target: null,
        rel: null,
      };
    }

    if (slug) {
      return {
        experience,
        kind: 'internal',
        routerLink: slug,
        href: null,
        target: null,
        rel: null,
      };
    }

    if (href) {
      return {
        experience: 'external_only',
        kind: 'external',
        routerLink: null,
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
      };
    }

    return {
      experience,
      kind: 'none',
      routerLink: null,
      href: null,
      target: null,
      rel: null,
    };
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
      variables: { where, limit: 100 },
      fetchPolicy: 'network-only',
    }).pipe(map(result => result.data.Sports.docs));
  }


  getSportBySlug(slug: string): Observable<Sport | null> {
    return this.apollo.query<{ Sports: { docs: Sport[] } }>({
      query: SPORT_BY_SLUG_QUERY,
      variables: { slug },
      fetchPolicy: 'network-only',
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
      return this.normalizeMediaUrl(athlete.photo.url);
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

  getSportLegacyOverview(sportSlug: string): Observable<SportLegacyOverview> {
    const params = new HttpParams().set('slug', sportSlug);
    return this.http.get<SportLegacyOverview>(`${environment.payload_url}/api/sports/legacy-overview`, { params });
  }

  getSportLegacySummary(sportSlug: string): Observable<SportLegacySummary> {
    const params = new HttpParams().set('slug', sportSlug);
    return this.http.get<SportLegacySummary>(`${environment.payload_url}/api/sports/legacy-summary`, { params });
  }

  getSportLegacyEditionDetail(sportSlug: string, editionId: string): Observable<SportLegacyEditionDetail> {
    const params = new HttpParams()
      .set('slug', sportSlug)
      .set('editionId', editionId);
    return this.http.get<SportLegacyEditionDetail>(`${environment.payload_url}/api/sports/legacy-edition`, { params });
  }

  // ============ CALENDAR EVENTS ============

  getCalendarEvents(options?: {
    sportId?: string;
    status?: string;
    isQualifier?: boolean;
    isQualificationEvent?: boolean;
    limit?: number;
  }): Observable<CalendarEvent[]> {
    let where: any = {};
    if (options?.sportId) {
      where.sport = { equals: options.sportId };
    }
    if (options?.status) {
      where.status = { equals: options.status };
    }
    const qualificationFlag = options?.isQualificationEvent ?? options?.isQualifier;
    if (qualificationFlag !== undefined) {
      where.isQualificationEvent = { equals: qualificationFlag };
    }

    return this.apollo.query<{ CalendarEvents: { docs: CalendarEvent[] } }>({
      query: CALENDAR_EVENTS_QUERY,
      variables: { where, limit: options?.limit || 500 },
      fetchPolicy: 'network-only',
    }).pipe(map(result => result.data.CalendarEvents.docs));
  }

  getCalendarEventBySlug(slug: string): Observable<CalendarEvent | null> {
    return this.apollo.query<{ CalendarEvents: { docs: CalendarEvent[] } }>({
      query: CALENDAR_EVENT_BY_SLUG_QUERY,
      variables: { slug },
      fetchPolicy: 'network-only',
    }).pipe(map(result => result.data.CalendarEvents.docs[0] || null));
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
      variables: { where, limit: 100 },
      fetchPolicy: 'network-only',
    }).pipe(map(result => result.data.QualificationPathways.docs));
  }

  getContenderUnits(options?: {
    status?: 'medal_hopeful' | 'outside_chance' | 'qualification_only' | 'qualification_watch' | 'history_only';
    cycle?: string;
    activeOnly?: boolean;
    limit?: number;
  }): Observable<ContenderUnitResult> {
    let where: any = {};
    if (options?.status) {
      where.status = { equals: options.status };
    }
    if (options?.cycle) {
      where.cycle = { equals: options.cycle };
    }
    if (options?.activeOnly) {
      where.isActive = { equals: true };
    }

    return this.apollo.query<{ ContenderUnits: { docs: ContenderUnit[]; totalDocs: number } }>({
      query: CONTENDER_UNITS_QUERY,
      variables: { where, limit: options?.limit || 200 },
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    }).pipe(
      map((result) => ({
        docs: result.data?.ContenderUnits?.docs || [],
        totalDocs: result.data?.ContenderUnits?.totalDocs || 0,
      })),
    );
  }

  getGoldenMoments(): Observable<GoldenMoment[]> {
    return this.apollo.query<{ GoldenMoments: { docs: GoldenMoment[] } }>({
      query: GOLDEN_MOMENTS_QUERY,
    }).pipe(map(result => result.data.GoldenMoments.docs));
  }

  getGoldenMomentsByYear(year: number): Observable<GoldenMoment[]> {
    return this.apollo.query<{ GoldenMoments: { docs: GoldenMoment[] } }>({
      query: GOLDEN_MOMENTS_BY_FILTER_QUERY,
      variables: { where: { year: { equals: year } }, limit: 50 },
      fetchPolicy: 'network-only',
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

  getRetiredAthletesFeed(options?: {
    page?: number;
    limit?: number;
    search?: string;
    sportFilter?: string;
  }): Observable<RetiredAthletesFeed> {
    let params = new HttpParams()
      .set('page', String(options?.page || 1))
      .set('limit', String(options?.limit || 36));

    if (options?.search?.trim()) {
      params = params.set('search', options.search.trim());
    }
    if (options?.sportFilter && options.sportFilter !== 'all') {
      params = params.set('sport', options.sportFilter);
    }

    return this.http.get<RetiredAthletesFeed>(`${environment.payload_url}/api/athletes/retired-feed`, { params });
  }
}
