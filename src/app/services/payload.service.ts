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
    startDate?: string;
    endDate?: string;
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
    result: 'gold' | 'silver' | 'bronze' | 'participated' | 'dnf' | 'dns' | 'dq';
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
        parentSport { id name slug }
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
        parentSport { id name slug }
      }
    }
  }
`;

const ATHLETES_QUERY = gql`
  query GetAthletes($where: Athlete_where, $limit: Int, $page: Int) {
    Athletes(where: $where, limit: $limit, page: $page) {
      docs {
        id
        fullName
        slug
        country
        gender
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
        athlete { id fullName slug photo { url } }
        edition { id name slug year }
        event { id name sport { id name slug } }
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

// ============ SERVICE ============

@Injectable({
    providedIn: 'root'
})
export class PayloadService {
    private apollo = inject(Apollo);

    // Fallback image for athletes without photos
    readonly FALLBACK_ATHLETE_IMAGE = 'assets/images/placeholder.svg';

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
            variables: { where, limit: options?.limit || 20, page: options?.page || 1 }
        }).pipe(map(result => result.data.Athletes));
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
            variables: { where, limit: options?.limit || 100 }
        }).pipe(map(result => result.data.OlympicParticipations.docs));
    }

    getMedalists(): Observable<OlympicParticipation[]> {
        return this.apollo.query<{ OlympicParticipations: { docs: OlympicParticipation[] } }>({
            query: PARTICIPATIONS_QUERY,
            variables: { where: { result: { in: ['gold', 'silver', 'bronze'] } }, limit: 100 }
        }).pipe(map(result => result.data.OlympicParticipations.docs));
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
}
