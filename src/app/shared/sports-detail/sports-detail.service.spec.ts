import { TestBed } from '@angular/core/testing';
import { GamesParticipationRow, PayloadService } from '../../services/payload.service';
import { SportsMoment } from '../../home/sports-moment.model';
import { BadmintonEntryItem } from './sports-detail.model';
import { SportsDetailService } from './sports-detail.service';

describe('SportsDetailService badminton match enrichment', () => {
  let service: SportsDetailService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SportsDetailService,
        { provide: PayloadService, useValue: jasmine.createSpyObj('PayloadService', ['getEventHubParticipations']) },
      ],
    });
    service = TestBed.inject(SportsDetailService);
  });

  it('keeps mixed R64 and R32 entries available on the same order-of-play day', () => {
    const rows: GamesParticipationRow[] = [
      {
        id: 'rohan',
        gamesKey: 'bwf-world-championships-2026',
        sourceName: 'Rohan Kapoor',
        eventName: 'Mixed Doubles',
        eventBucket: 'XD:Rohan Kapoor+Ruthvika Shivani Gadde',
        publicNote: 'First round: Jonathan Bing Tsan Lai / Crystal Lai (CAN).',
      },
      {
        id: 'ruthvika',
        gamesKey: 'bwf-world-championships-2026',
        sourceName: 'Ruthvika Shivani Gadde',
        eventName: 'Mixed Doubles',
        eventBucket: 'XD:Rohan Kapoor+Ruthvika Shivani Gadde',
        publicNote: 'First round: Jonathan Bing Tsan Lai / Crystal Lai (CAN).',
      },
      {
        id: 'kavipriya',
        gamesKey: 'bwf-world-championships-2026',
        sourceName: 'Kavipriya Selvam',
        eventName: "Women's Doubles",
        eventBucket: 'WD:Kavipriya Selvam+Simran Singhi',
        publicNote: 'First round: Gabriela Stoeva / Stefani Stoeva (BUL).',
      },
      {
        id: 'simran',
        gamesKey: 'bwf-world-championships-2026',
        sourceName: 'Simran Singhi',
        eventName: "Women's Doubles",
        eventBucket: 'WD:Kavipriya Selvam+Simran Singhi',
        publicNote: 'First round: Gabriela Stoeva / Stefani Stoeva (BUL).',
      },
    ];

    const entries = (service as any).mapBadmintonEntries(rows, '2026-08-18') as BadmintonEntryItem[];

    expect(entries.length).toBe(2);
    expect(entries.find((entry) => entry.disciplineCode === 'XD')?.opponentFlag).toBe('🇨🇦');
    expect(entries.find((entry) => entry.disciplineCode === 'WD')?.opponentFlag).toBe('🇧🇬');
  });

  it('uses schedule matchup metadata for a progressed opponent', () => {
    const moment = {
      timingLabel: '~16:30 IST',
      state: 'upcoming',
      context: "Women's Doubles · Round 32 · Court 2 · Match 10 in order",
      result: {
        summary: null,
        matchup: { indiaCountryCode: 'IND', opponentCountryCode: 'BUL' },
      },
    } as SportsMoment;
    const matchup = {
      teamA: { name: 'Kavipriya / Simran', code: 'IND', isIndia: true, flag: '🇮🇳' },
      teamB: { name: 'Stoeva / Stoeva', code: 'STO', isIndia: false, flag: '' },
    };

    const entry = (service as any).buildBadmintonMatchDetail(moment, matchup) as BadmintonEntryItem;

    expect(entry.disciplineCode).toBe('WD');
    expect(entry.opponentCountryCode).toBe('BUL');
    expect(entry.opponentFlag).toBe('🇧🇬');
  });

  it('uses a non-India winner code for legacy completed BWF losses', () => {
    const moment = {
      timingLabel: '~14:00 IST',
      state: 'completed',
      context: "Men's Doubles · Round 32 · Court 3 · Match 7 in order",
      result: {
        summary: 'Hariharan / Arjun lost 17–21, 14–21',
        winnerCountryCode: 'KOR',
        score: { india: [17, 14], opponent: [21, 21] },
      },
    } as SportsMoment;
    const matchup = {
      teamA: { name: 'Hariharan / Arjun', code: 'IND', isIndia: true, flag: '🇮🇳' },
      teamB: { name: 'Kang / Ki', code: '', isIndia: false, flag: '' },
    };

    const entry = (service as any).buildBadmintonMatchDetail(moment, matchup) as BadmintonEntryItem;

    expect(entry.opponentCountryCode).toBe('KOR');
    expect(entry.opponentCountry).toBe('Korea');
  });

  it('shows the home and away scores for a completed Hockey moment', () => {
    const moment: SportsMoment = {
      id: 'schedule:hockey-w6',
      source: 'games-schedule',
      sourceEventId: 'hockey-women-event',
      gamesKey: 'fih-hockey-world-cup-2026',
      dateKey: '2026-08-16',
      startTime: '2026-08-16T11:00:00.000Z',
      sortMinutes: 16 * 60 + 30,
      timingState: 'exact',
      timingLabel: '16:30 IST',
      state: 'completed',
      sport: { name: 'Hockey', slug: 'hockey', pictogramUrl: null },
      headline: '🇨🇳 China vs 🇮🇳 India',
      context: 'Women · Pool D · Group',
      competition: 'FIH Hockey World Cup',
      importance: 'primary',
      resultLabel: 'China drew with India 2–2',
      result: {
        summary: 'China drew with India 2–2',
        outcome: 'draw',
        matchScore: { home: 2, away: 2, india: 2, opponent: 2 },
      },
      action: null,
    };

    service.openMoment(moment);

    expect(service.detail()?.matchup?.teamA.score).toBe(2);
    expect(service.detail()?.matchup?.teamB.score).toBe(2);
    expect(service.detail()?.resultSummary).toBe('China drew with India 2–2');
  });

  it('returns a result scorecard to the results sheet without changing normal detail navigation', () => {
    const moment = {
      id: 'schedule:hockey-w6',
      source: 'games-schedule',
      sourceEventId: 'hockey-women-event',
      gamesKey: 'fih-hockey-world-cup-2026',
      dateKey: '2026-08-16',
      startTime: '2026-08-16T11:00:00.000Z',
      sortMinutes: 16 * 60 + 30,
      timingState: 'exact',
      timingLabel: '16:30 IST',
      state: 'completed',
      sport: { name: 'Hockey', slug: 'hockey', pictogramUrl: null },
      headline: 'China vs India',
      context: 'Women · Pool D · Group',
      competition: 'FIH Hockey World Cup',
      importance: 'primary',
      resultLabel: 'China drew with India 2–2',
      result: {
        summary: 'China drew with India 2–2',
        outcome: 'draw',
        matchScore: { home: 2, away: 2, india: 2, opponent: 2 },
      },
      action: null,
    } as SportsMoment;

    service.openMomentFromResults(moment);
    expect(service.returnToResults()).toBeTrue();

    service.close();
    expect(service.returnToResults()).toBeFalse();

    service.openMoment(moment);
    expect(service.returnToResults()).toBeFalse();
  });
});
