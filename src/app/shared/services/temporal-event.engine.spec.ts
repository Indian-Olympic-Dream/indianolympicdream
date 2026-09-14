import { TestBed } from '@angular/core/testing';
import { GamesScheduleRow, PayloadService } from '../../services/payload.service';
import { TemporalEventEngine } from './temporal-event.engine';

describe('TemporalEventEngine competition versus coverage', () => {
  let engine: TemporalEventEngine;
  const now = new Date('2026-09-20T11:00:00+05:30');
  const row: GamesScheduleRow = { id: 'session', status: 'scheduled', startTime: '2026-09-20T10:00:00+05:30', endTime: '2026-09-20T12:00:00+05:30' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: PayloadService, useValue: {} }] });
    engine = TestBed.inject(TemporalEventEngine);
  });
  it('does not infer live play from a scheduled time window', () => {
    expect(engine.deriveFixtureState(row, now)).toBe('active');
    expect(engine.deriveFixtureState({ ...row, status: 'live' }, now)).toBe('live');
    expect(engine.deriveFixtureState({ ...row, status: 'cancelled' }, now)).toBe('cancelled');
  });
  it('uses IST date boundaries for ongoing competitions even when stored in UTC', () => {
    const event = { id: 'event', title: 'Event', status: 'upcoming', startDate: '2026-09-20T00:00:00Z', endDate: '2026-09-20T00:00:00Z' };
    expect(engine.deriveEventState(event, [], new Date('2026-09-20T18:29:59Z'))).toBe('active');
    expect(engine.deriveEventState(event, [], new Date('2026-09-20T18:30:00Z'))).toBe('completed');
  });
});
