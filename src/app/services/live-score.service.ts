import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, of, shareReplay, startWith } from 'rxjs';
import { LiveScoreCoverage, LiveScoreUpdate } from './payload.service';

export interface LiveScorePublication {
  gamesKey: string;
  scheduleId: string;
  sourceId: string | null;
  revision: number;
  liveCoverage: LiveScoreCoverage;
  updates: LiveScoreUpdate[];
  status?: string | null;
  result?: unknown;
}

export type LiveScoreMap = ReadonlyMap<string, LiveScorePublication>;

@Injectable({ providedIn: 'root' })
export class LiveScoreService {
  private platformId = inject(PLATFORM_ID);
  private streams = new Map<string, Observable<LiveScoreMap>>();

  watch(gamesKey: string): Observable<LiveScoreMap> {
    if (!isPlatformBrowser(this.platformId) || !gamesKey) return of(new Map());
    const existing = this.streams.get(gamesKey);
    if (existing) return existing;

    const stream = new Observable<LiveScoreMap>((observer) => {
      const scores = new Map<string, LiveScorePublication>();
      const emit = () => observer.next(new Map(scores));
      const accept = (publication: LiveScorePublication) => {
        const current = scores.get(publication.scheduleId);
        if (!current || publication.revision >= current.revision) {
          scores.set(publication.scheduleId, publication);
          emit();
        }
      };
      const url = `/api/games-schedule/live-stream?gamesKey=${encodeURIComponent(gamesKey)}&ngsw-bypass=true`;
      const events = new EventSource(url);

      events.addEventListener('snapshot', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data);
          (payload.snapshots || []).forEach(accept);
          if (!(payload.snapshots || []).length) emit();
        } catch {
          // Native EventSource reconnects; retain the latest valid revision.
        }
      });
      events.addEventListener('score-state', (event) => {
        try {
          accept(JSON.parse((event as MessageEvent<string>).data) as LiveScorePublication);
        } catch {
          // Ignore a malformed frame and wait for reconnect snapshot authority.
        }
      });
      events.onerror = () => {
        // Native EventSource reconnect is the transport policy. Do not clear visible scores.
      };

      return () => events.close();
    }).pipe(
      startWith(new Map<string, LiveScorePublication>()),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.streams.set(gamesKey, stream);
    return stream;
  }
}
