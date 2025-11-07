import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// A single Story document from Payload
export interface Story {
    id: string;
    title: string;
    subtitle: {
        [key: string]: any;
    }[];
    heroImage: any;
    chapters: any[];
    publishedDate: string;
}
export interface PayloadResponse<T> {
    docs: T[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
    pagingCounter: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
}

@Injectable({
    providedIn: 'root'
})
export class StoryService {
    private apiUrl = `${environment.apiUrl}/content`;

    constructor(private http: HttpClient) { }

    getStories(): Observable<Story[]> {
        // Fetch only published stories
        return this.http.get<PayloadResponse<Story>>(`${this.apiUrl}/stories?where[status][equals]=published&sort=-publishedDate&limit=10`)
            .pipe(
                map(response => response.docs)
            );
    }

    getStoryBySlug(slug: string): Observable<Story> {
        // Fetch a single story by slug
        return this.http.get<PayloadResponse<Story>>(`${this.apiUrl}/stories?where[slug][equals]=${slug}&depth=2`)
            .pipe(
                map(response => response.docs[0])
            );
    }
}



