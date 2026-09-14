import { Observable, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CalendarEvent, GamesScheduleRow, PayloadService } from '../services/payload.service';
import { TemporalEventEngine } from '../shared/services/temporal-event.engine';
import { SportsMomentService } from './sports-moment.service';
import { LiveScoreMap, LiveScoreService } from '../services/live-score.service';

describe('SportsMomentService current schedule', () => {
  function calendarService(rows: GamesScheduleRow[] = []): SportsMomentService {
    const payload = jasmine.createSpyObj<PayloadService>('PayloadService', [
      'getUpcomingGamesSchedule', 'getCalendarEventExperience',
      'getCalendarEventNavigation', 'getSportPictogramUrl',
    ]);
    payload.getUpcomingGamesSchedule.and.returnValue(of(rows));
    payload.getCalendarEventExperience.and.returnValue('external_only');
    payload.getSportPictogramUrl.and.returnValue(null);
    payload.getCalendarEventNavigation.and.callFake(event => ({
      experience: 'external_only', kind: 'external', routerLink: null,
      href: event?.whereToWatch?.url || event?.externalUrl || null,
      target: '_blank', rel: 'noopener noreferrer',
    }));
    TestBed.configureTestingModule({ providers: [{ provide: PayloadService, useValue: payload }] });
    return new SportsMomentService(payload, TestBed.inject(TemporalEventEngine), jasmine.createSpyObj('LiveScoreService', ['watch']));
  }

  it('shows external-only ongoing competitions without inventing live coverage or Indian starts', done => {
    const events: CalendarEvent[] = [
      { id: 'vietnam', title: 'Vietnam Open', startDate: '2026-09-08', endDate: '2026-09-13', status: 'upcoming', externalUrl: 'https://example.org/event' },
      { id: 'us', title: 'US Open', startDate: '2026-08-31', endDate: '2026-09-13', status: 'upcoming', externalUrl: 'https://example.org/us' },
    ];
    calendarService().loadHome(events, new Date('2026-09-10T12:00:00+05:30')).subscribe(vm => {
      expect(vm.ongoingEvents.length).toBe(2);
      expect(vm.ongoingEvents.every(event => event.relativeLabel === 'Ongoing')).toBeTrue();
      expect(vm.ongoingEvents.every(event => event.action?.label === 'Official event')).toBeTrue();
      expect(vm.rightNow).toEqual([]);
      expect(vm.nextIndia).toBeNull();
      expect(vm.comingUp).toEqual([]);
      done();
    });
  });

  it('excludes cancelled, postponed, future and finished competitions and keeps watch links explicit', done => {
    const base: CalendarEvent = { id: 'ongoing', title: 'Ongoing', startDate: '2026-09-08', endDate: '2026-09-10', status: 'upcoming', whereToWatch: { url: 'https://example.org/watch' } };
    calendarService().loadHome([
      base, { ...base, id: 'cancelled', status: 'cancelled' },
      { ...base, id: 'postponed', status: 'postponed' },
      { ...base, id: 'finished', endDate: '2026-09-09' },
      { ...base, id: 'future', startDate: '2026-09-11', endDate: '2026-09-12' },
    ], new Date('2026-09-10T23:59:00+05:30')).subscribe(vm => {
      expect(vm.ongoingEvents.map(event => event.title)).toEqual(['Ongoing']);
      expect(vm.ongoingEvents[0].action?.label).toBe('Where to watch');
      done();
    });
  });

  it('admits confirmed Indian starts outside IOD coverage without calling a scheduled window live', done => {
    const event: CalendarEvent = { id: 'swim', title: 'Asian Games Swimming', status: 'upcoming', startDate: '2026-09-20', endDate: '2026-09-25', externalUrl: 'https://example.org/swimming', sport: { id: 'swim', slug: 'swimming', name: 'Swimming' } };
    const row: GamesScheduleRow = {
      id: 'india-swim', gamesKey: 'asian-games-2026', calendarEvent: { id: event.id, title: event.title },
      startTime: '2026-09-20T10:00:00+05:30', endTime: '2026-09-20T12:00:00+05:30',
      name: 'Swimming session', status: 'scheduled', participationStatus: 'confirmed', timingPrecision: 'session-window',
      indianParticipants: [{ id: 'test-athlete', fullName: 'Test athlete' }],
    };
    calendarService([row, { ...row, id: 'unassigned-master-session', indianParticipants: [] }])
      .loadHome([event], new Date('2026-09-20T11:00:00+05:30')).subscribe(vm => {
        expect(vm.rightNow).toEqual([]);
        expect(vm.nextIndia?.id).toBe('schedule:india-swim');
        expect(vm.nextIndia?.state).toBe('upcoming');
        expect(vm.nextIndia?.action?.label).toBe('Official event');
        expect(vm.days[0].totalMomentCount).toBe(1);
        done();
      });
  });

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

  const hockeyEvent: CalendarEvent = {
    id: 'hockey-women-event',
    title: "FIH Hockey Women's World Cup 2026",
    slug: 'fih-hockey-women-s-world-cup-belgium-netherlands-2026',
    startDate: '2026-08-15T00:00:00+05:30',
    endDate: '2026-08-30T23:59:59+05:30',
    status: 'live',
    coverageExperience: 'covered_page',
    category: 'FIH Hockey World Cup',
    sport: { id: 'hockey', name: 'Hockey', slug: 'hockey' },
  };

  function createService(
    scheduleResponse: Observable<GamesScheduleRow[]>,
    liveResponse: Observable<LiveScoreMap> = of(new Map()),
  ): SportsMomentService {
    const payload = jasmine.createSpyObj<PayloadService>('PayloadService', [
      'getUpcomingGamesSchedule',
      'getCalendarEventExperience',
      'getCalendarEventNavigation',
      'getSportPictogramUrl',
    ]);
    payload.getUpcomingGamesSchedule.and.returnValue(scheduleResponse);
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
      'groupEventSituations',
      'getImportance',
      'getLeadEvent',
      'getSituationTitle',
      'formatDateRange',
      'formatLocation',
    ]);
    temporal.parseEventDate.and.callFake((value: string) => new Date(value));
    temporal.buildCalendarFeed.and.returnValue([]);
    temporal.groupEventSituations.and.returnValue([]);
    const liveScores = jasmine.createSpyObj<LiveScoreService>('LiveScoreService', ['watch']);
    liveScores.watch.and.returnValue(liveResponse);

    return new SportsMomentService(payload, temporal, liveScores);
  }

  function expectNoInventedMoment(service: SportsMomentService, done: DoneFn): void {
    service.loadHome([bwfEvent], new Date('2026-08-16T12:00:00+05:30')).subscribe({
      next: (viewModel) => {
        expect(viewModel.days).toEqual([]);
        expect(viewModel.nextIndia).toBeNull();
        done();
      },
      error: done.fail,
    });
  }

  it('does not invent an India moment when no schedule row exists', (done) => {
    expectNoInventedMoment(createService(of([])), done);
  });

  it('does not restore expired release copy when the schedule request fails', (done) => {
    expectNoInventedMoment(createService(throwError(() => new Error('unavailable'))), done);
  });

  it('maps a completed BWF retirement result into the shared moment model', (done) => {
    const completedRow: GamesScheduleRow = {
      id: 'bwf-1534858',
      gamesKey: 'bwf-world-championships-2026',
      calendarEvent: { id: 'bwf-event', title: 'BWF World Championships 2026', slug: 'bwf-world-championships-2026' },
      name: 'Hariharan / Arjun vs Guildea / Reynolds',
      eventName: "Men's Doubles",
      phase: 'round-64',
      startTime: '2026-08-17T06:50:00.000Z',
      indiaTimeLabel: '~12:20 IST',
      localTimeLabel: 'Followed by · Court 1 · Match 5',
      timingPrecision: 'session-window',
      participationStatus: 'confirmed',
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
        expect(viewModel.recentResults.map((result) => result.id)).toEqual(['schedule:bwf-1534858']);
        expect(viewModel.nextIndia).toBeNull();
        done();
      },
      error: done.fail,
    });
  });

  it('surfaces the SSE score and sanitized point feed on the live Home moment', (done) => {
    const liveRow: GamesScheduleRow = {
      id: 'bwf-live-3',
      gamesKey: 'bwf-world-championships-2026',
      calendarEvent: { id: 'bwf-event', title: 'BWF World Championships 2026', slug: 'bwf-world-championships-2026' },
      name: 'Dhruv / Tanisha vs Leong / Ng',
      eventName: 'Mixed Doubles',
      phase: 'round-32',
      startTime: '2026-08-19T05:10:00.000Z',
      indiaTimeLabel: '~10:40 IST',
      localTimeLabel: 'Court 1 · Match 3',
      timingPrecision: 'session-window',
      participationStatus: 'confirmed',
      status: 'scheduled',
      result: {
        matchup: {
          india: { countryCode: 'IND', displayName: 'Dhruv / Tanisha', players: ['Dhruv Kapila', 'Tanisha Crasto'], seed: '15' },
          opponent: { countryCode: 'MAC', displayName: 'Leong / Ng', players: ['Leong Iok Chong', 'Ng Weng Chi'] },
        },
      },
    };
    const updates = [{
      id: 'revision-9',
      revision: 9,
      type: 'point' as const,
      currentGame: 1,
      india: 8,
      opponent: 6,
      side: 'india' as const,
      winner: null,
      occurredAt: '2026-08-19T06:38:00.000Z',
    }];
    const live = new Map([['bwf-live-3', {
      gamesKey: 'bwf-world-championships-2026',
      scheduleId: 'bwf-live-3',
      sourceId: 'BWF-3',
      revision: 9,
      liveCoverage: {
        enabled: true,
        revision: 9,
        status: 'live' as const,
        phase: 'in-play' as const,
        currentGame: 1,
        servingSide: 'india' as const,
        score: { games: [{ india: 8, opponent: 6, complete: false, winner: null }] },
        lastPublishedAt: '2026-08-19T06:38:00.000Z',
        startedAt: '2026-08-19T06:20:00.000Z',
        pressure: null,
      },
      updates,
    }]]);

    createService(of([liveRow]), of(live)).loadHome([bwfEvent], new Date('2026-08-19T12:08:00+05:30')).subscribe({
      next: (viewModel) => {
        const moment = viewModel.rightNow[0];
        expect(moment.state).toBe('live');
        expect(moment.resultLabel).toBe('Game 1 · 8–6');
        expect(moment.result?.live?.currentScore).toEqual({ india: 8, opponent: 6 });
        expect(moment.result?.live?.updates).toEqual(updates);
        expect(moment.result?.matchup?.indiaDisplayName).toBe('Dhruv / Tanisha');
        expect(moment.result?.matchup?.opponentDisplayName).toBe('Leong / Ng');
        expect(moment.result?.live?.phase).toBe('in-play');
        expect(moment.result?.live?.elapsedSeconds).toBe(1080);
        done();
      },
      error: done.fail,
    });
  });

  it('maps a completed Hockey result score even when the persisted status is stale', (done) => {
    const completedRow: GamesScheduleRow = {
      id: 'hockey-w6',
      gamesKey: 'fih-hockey-world-cup-2026',
      calendarEvent: {
        id: 'hockey-women-event',
        title: "FIH Hockey Women's World Cup 2026",
        slug: 'fih-hockey-women-s-world-cup-belgium-netherlands-2026',
      },
      name: 'China vs India',
      eventName: 'Pool D',
      phase: 'group',
      startTime: '2026-08-16T11:00:00.000Z',
      indiaTimeLabel: '16:30 IST',
      timingPrecision: 'exact',
      participationStatus: 'confirmed',
      status: 'scheduled',
      result: {
        summary: 'China drew with India 2–2',
        outcome: 'draw',
        winnerCountryCode: null,
        completion: 'normal',
        score: { home: 2, away: 2, india: 2, opponent: 2 },
      },
    };

    createService(of([completedRow])).loadHome([hockeyEvent], new Date('2026-08-16T18:00:00+05:30')).subscribe({
      next: (viewModel) => {
        const moment = viewModel.days
          .find((day) => day.dateKey === '2026-08-16')
          ?.timedEntries.find((entry) => entry.kind === 'moment')?.moment;
        expect(moment?.state).toBe('completed');
        expect(moment?.resultLabel).toBe('China drew with India 2–2');
        expect(moment?.result?.matchScore).toEqual({ home: 2, away: 2, india: 2, opponent: 2 });
        expect(viewModel.recentResults.map((result) => result.id)).toEqual(['schedule:hockey-w6']);
        done();
      },
      error: done.fail,
    });
  });

  it('keeps a completed India result available for the rolling seven-day Home window', (done) => {
    const completedRow: GamesScheduleRow = {
      id: 'bwf-retirement-result',
      gamesKey: 'bwf-world-championships-2026',
      calendarEvent: {
        id: 'bwf-event',
        title: 'BWF World Championships 2026',
        slug: 'bwf-world-championships-2026',
      },
      name: 'Hariharan / Arjun vs Guildea / Reynolds',
      eventName: "Men's Doubles",
      phase: 'round-64',
      startTime: '2026-08-17T06:50:00.000Z',
      indiaTimeLabel: '~12:20 IST',
      timingPrecision: 'exact',
      participationStatus: 'confirmed',
      status: 'completed',
      result: {
        summary: 'Hariharan / Arjun won 21–16, 6–4 (ret.)',
        outcome: 'win',
        winnerCountryCode: 'IND',
        completion: 'retirement',
        score: { india: [21, 6], opponent: [16, 4] },
        advanced: true,
      },
    };

    createService(of([completedRow])).loadHome([bwfEvent], new Date('2026-08-23T12:00:00+05:30')).subscribe({
      next: (viewModel) => {
        expect(viewModel.days).toEqual([]);
        expect(viewModel.recentResults.map((result) => result.id)).toEqual(['schedule:bwf-retirement-result']);
        done();
      },
      error: done.fail,
    });
  });
});
