import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PayloadService, Sport, Athlete } from './services/payload.service';
import { AllSports, Calendar } from './models/app-models';

/**
 * SportsdataService - Legacy service for backward compatibility
 * 
 * Delegates to PayloadService (GraphQL) for data fetching.
 * Transforms Payload CMS responses to legacy format for existing components.
 */
@Injectable({
  providedIn: 'root'
})
export class SportsdataService {
  private http = inject(HttpClient);
  private payload = inject(PayloadService);

  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  /**
   * Get all sports - DB first, with canonical pictogram resolution.
   */
  public getallsports(edition: string): Observable<AllSports[]> {
    return this.payload.getSports().pipe(
      map((sports) =>
        sports
          .filter((sport) => this.isTopLevelSport(sport))
          .map((sport) => ({
            name: sport.name,
            pictogram:
              this.payload.getSportPictogramUrl({
                sport,
                includePlaceholderFallback: true,
              }) || this.payload.FALLBACK_SPORT_PICTOGRAM,
            isimportant: true,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      ),
      catchError(this.handleError)
    );
  }

  /**
   * Get sport details by name.
   * Returns array format expected by component (res[0])
   */
  public getsports(sportname: string, edition: string): Observable<any[]> {
    const normalizedSlug = this.toSlug(sportname);

    return forkJoin({
      bySlug: this.payload.getSportBySlug(normalizedSlug),
      allSports: this.payload.getSports(),
    }).pipe(
      map(({ bySlug, allSports }) => {
        const sport =
          bySlug ||
          allSports.find((s) => this.toSlug(s.name) === normalizedSlug) ||
          null;

        if (!sport) {
          return [{
            name: sportname,
            slug: normalizedSlug,
            alias: sportname,
            description: `${sportname} at the Olympic Games`,
            pictogram:
              this.payload.getSportPictogramUrl({
                sportSlug: normalizedSlug,
                sportName: sportname,
                includePlaceholderFallback: true,
              }) || this.payload.FALLBACK_SPORT_PICTOGRAM,
            Medals: '0',
            athletes: [],
            events: { man: [], women: [], mixed: [] },
            doc_pdf: '',
            image: '',
          }];
        }

        return [{
          name: sport.name,
          slug: sport.slug,
          alias: sport.alias,
          description: sport.description,
          pictogram:
            this.payload.getSportPictogramUrl({
              sport,
              includePlaceholderFallback: true,
            }) || this.payload.FALLBACK_SPORT_PICTOGRAM,
          Medals: '0',
          athletes: [],
          events: { man: [], women: [], mixed: [] },
          doc_pdf: '',
          image: '',
        }];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get calendar events - maps to legacy Calendar format
   */
  public getcalendar(filter: string, pageIndex: number, pageSize: number, edition: string): Observable<Calendar[]> {
    return this.payload.getCalendarEvents({ limit: pageSize }).pipe(
      map(events => events.map(event => ({
        name: event.title,
        sportname: event.sport?.name || '',
        startdate: event.startDate ? new Date(event.startDate).getTime() : 0,
        enddate: event.endDate ? new Date(event.endDate).getTime() : 0,
        venue: event.location || '',
      }))),
      catchError(this.handleError)
    );
  }

  /**
   * Get athletes - maps to legacy format with sport filtering
   */
  public getathletes(sports: any, pageIndex: string, pageSize: string, edition: string): Observable<any> {
    // Parse sports filter (comes as JSON string like '["Archery","Athletics"]')
    let sportFilter: string[] = [];
    try {
      sportFilter = typeof sports === 'string' ? JSON.parse(sports) : (sports || []);
    } catch {
      sportFilter = [];
    }

    return this.payload.getAthletes({
      page: parseInt(pageIndex) || 1,
      limit: 200, // Get more to allow client-side filtering
      isActive: edition === '2028' ? true : undefined,
    }).pipe(
      map(response => {
        let athletes = response.docs.map((athlete: Athlete) => ({
          name: athlete.fullName,
          slug: athlete.slug,
          sportname: this.getPrimarySportName(athlete),
          event: '',
          photo: this.payload.getAthleteImageUrl(athlete),
          country: athlete.country,
          qualified: athlete.isActive ? 'Qualified' : 'Pending',
          qualificationDetails: '',
        }));

        // Apply sport filter if specified
        if (sportFilter.length > 0) {
          const filterLower = sportFilter.map(s => s.toLowerCase());
          athletes = athletes.filter(a =>
            filterLower.includes(a.sportname.toLowerCase())
          );
        }

        // Apply pagination client-side after filtering
        const page = parseInt(pageIndex) || 0;
        const size = parseInt(pageSize) || 100;
        const start = page * size;
        const paginatedAthletes = athletes.slice(start, start + size);

        return {
          athletes: paginatedAthletes,
          total: athletes.length,
          page: page,
          totalPages: Math.ceil(athletes.length / size),
        };
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get schedule - placeholder for future implementation
   */
  public getschedule(sport: string, edition: string): Observable<any> {
    if (edition === '2028') {
      return of({ schedule: [], message: 'Schedule not available yet for LA 2028' });
    }
    return of({ schedule: [], message: 'Historical schedules coming soon' });
  }

  /**
   * Get schedule by date
   */
  public getschedulebydate(date: string, edition: string): Observable<any> {
    if (edition === '2028') {
      return of({ schedule: [], message: 'Schedule not available yet for LA 2028' });
    }
    return of({ schedule: [], message: 'Historical schedules coming soon' });
  }

  /**
   * Get shows/videos data - placeholder
   */
  public getshowsdata(pageIndex: number, pageSize: number): Observable<any> {
    return of({ shows: [], total: 0 });
  }

  /**
   * Post feedback
   */
  postfeedback(feedbackjson: { name: string; email: string; feedback: string }) {
    return this.http.post(`/api/feedback`, feedbackjson, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  // ============ Helper Methods ============

  private getPrimarySportName(athlete: Athlete): string {
    if (!athlete.sports || athlete.sports.length === 0) return '';
    const firstSport = athlete.sports[0];
    return firstSport?.name || '';
  }

  private isTopLevelSport(sport: Sport): boolean {
    if (!sport.parentSport?.id) return true;
    return sport.parentSport.id === sport.id;
  }

  private toSlug(value: string): string {
    if (!value) return '';
    return value
      .trim()
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  private handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      console.error('An error occurred:', error.error.message);
      return throwError(() => 'Network error occurred. Please try again.');
    } else {
      console.error(`Backend returned code ${error.status}`, error.error);
      return throwError(() => 'Server error occurred. Please try again later.');
    }
  }
}
