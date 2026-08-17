import { TestBed } from '@angular/core/testing';
import { GamesParticipationRow, PayloadService } from '../../services/payload.service';
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
});
