import { Observable, of, throwError } from 'rxjs';
import { CalendarEvent, GamesScheduleRow, PayloadService } from '../services/payload.service';
import { TemporalEventEngine } from '../shared/services/temporal-event.engine';
import { SportsMomentService } from './sports-moment.service';

describe('SportsMomentService BWF schedule fallback', () => {
  const bwfEvent: CalendarEvent = {
    id: 'bwf-event',
    title: 'BWF World Championships 2026',
    slug: 'bwf-world-championships-2026',
    startDate: '2026-08-17T00:00:00+05:30',
    endDate: '2026-08-23T23:59:59+05:30',
    status: 'upcoming',
    coverageExperience: 'live_hub',
    category: 'BWF World Championships',
    sport: { id: 'badminton', name: 'Badminton', slug: 'badminton' },
  };

  function createService(bwfResponse: Observable<GamesScheduleRow[]>): SportsMomentService {
    const payload = jasmine.createSpyObj<PayloadService>('PayloadService', [
      'getUpcomingGamesSchedule',
      'getEventHubSchedule',
      'getCalendarEventExperience',
      'getCalendarEventNavigation',
      'getSportPictogramUrl',
    ]);
    payload.getUpcomingGamesSchedule.and.returnValue(of([]));
    payload.getEventHubSchedule.and.returnValue(bwfResponse as any);
    payload.getCalendarEventExperience.and.returnValue('live_hub');
    payload.getCalendarEventNavigation.and.returnValue({
      experience: 'live_hub',
      kind: 'internal',
      routerLink: ['/calendar', 'bwf-world-championships-2026'],
      href: null,
      target: null,
      rel: null,
    });
    payload.getSportPictogramUrl.and.returnValue(null);

    const temporal = jasmine.createSpyObj<TemporalEventEngine>('TemporalEventEngine', [
      'parseEventDate',
      'buildCalendarFeed',
    ]);
    temporal.parseEventDate.and.callFake((value: string) => new Date(value));
    temporal.buildCalendarFeed.and.returnValue([]);

    return new SportsMomentService(payload, temporal);
  }

  function expectOpeningDayFallback(service: SportsMomentService, done: DoneFn): void {
    service.loadHome([bwfEvent], new Date('2026-08-16T12:00:00+05:30')).subscribe({
      next: (viewModel) => {
        const day = viewModel.days.find((item) => item.dateKey === '2026-08-17');
        expect(day?.untimedMoments.length).toBe(1);
        expect(day?.untimedMoments[0].headline).toBe('Indian opening-round matches');
        expect(day?.untimedMoments[0].timingState).toBe('tbc');
        done();
      },
      error: done.fail,
    });
  }

  it('restores the curated Day 1 moment when the hub schedule is empty', (done) => {
    expectOpeningDayFallback(createService(of([])), done);
  });

  it('restores the curated Day 1 moment when the hub schedule request fails', (done) => {
    expectOpeningDayFallback(createService(throwError(() => new Error('unavailable'))), done);
  });

  it('maps a completed BWF retirement result into the shared moment model', (done) => {
    const completedRow: GamesScheduleRow = {
      id: 'bwf-1534858',
      gamesKey: 'bwf-world-championships-2026',
      name: 'Hariharan / Arjun vs Guildea / Reynolds',
      eventName: "Men's Doubles",
      phase: 'round-64',
      startTime: '2026-08-17T06:50:00.000Z',
      indiaTimeLabel: '~12:20 IST',
      localTimeLabel: 'Followed by · Court 1 · Match 5',
      timingPrecision: 'session-window',
      status: 'completed',
      result: {
        summary: 'Hariharan / Arjun won 21–16, 6–4 (ret.)',
        outcome: 'win',
        winnerCountryCode: 'IND',
        completion: 'retirement',
        durationSeconds: 1620,
        score: { india: [21, 6], opponent: [16, 4] },
        advanced: true,
      },
    };

    createService(of([completedRow])).loadHome([bwfEvent], new Date('2026-08-17T13:00:00+05:30')).subscribe({
      next: (viewModel) => {
        const moment = viewModel.days
          .find((day) => day.dateKey === '2026-08-17')
          ?.timedEntries.find((entry) => entry.kind === 'moment')?.moment;
        expect(moment?.state).toBe('completed');
        expect(moment?.resultLabel).toBe('Hariharan / Arjun won 21–16, 6–4 (ret.)');
        expect(moment?.result?.score?.india).toEqual([21, 6]);
        expect(moment?.result?.completion).toBe('retirement');
        expect(viewModel.nextIndia).toBeNull();
        done();
      },
      error: done.fail,
    });
  });
});
