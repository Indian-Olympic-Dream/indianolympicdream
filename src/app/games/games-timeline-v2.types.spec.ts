import { assertGamesTimelineV2 } from './games-timeline-v2.types';

describe('games timeline V2 contract', () => {
  const validResponse = {
    contract: 'games-timeline',
    schemaVersion: 2,
    gamesKey: 'asian-games-2026',
    timezone: 'Asia/Kolkata',
    generatedAt: '2026-09-27T00:00:00.000Z',
    integrity: {
      sessions: 1,
      units: 1,
      competitionUnits: 1,
      ceremonyUnits: 0,
      identities: { stored: 0, official: 1, scheduleRow: 0, derived: 0 },
      duplicateUnitsDropped: 0,
      semanticDuplicatesDropped: 0,
      unmatchedResultKeys: [],
    },
    units: [{
      id: 'asian-games-2026:official:FEN:M.FOIL.GPA.000300--',
      source: { scheduleSourceId: 'session-1' },
      sport: { name: 'Fencing', slug: 'fencing' },
      event: { name: "Men's Foil Individual", kind: 'competition', medal: false },
      schedule: { sequence: 0, timingType: 'fixed' },
      india: { participants: ['SANASAM Hemash Singh'], sides: [] },
      result: null,
      programmeSession: { id: 'session-1' },
      viewState: 'scheduled',
    }],
  };

  it('accepts the V2 envelope and competition-unit boundary', () => {
    expect(() => assertGamesTimelineV2(validResponse)).not.toThrow();
  });

  it('rejects a legacy programme-session response', () => {
    expect(() => assertGamesTimelineV2({ schemaVersion: 1, docs: [] }))
      .toThrowError(/schemaVersion 2/);
  });

  it('rejects malformed competition units', () => {
    expect(() => assertGamesTimelineV2({ ...validResponse, units: [{ id: 'missing-fields' }] }))
      .toThrowError(/competition unit/);
  });

  it('rejects unknown timing and view states at the API boundary', () => {
    const unit = validResponse.units[0];
    expect(() => assertGamesTimelineV2({
      ...validResponse,
      units: [{ ...unit, schedule: { ...unit.schedule, timingType: 'guess' } }],
    })).toThrowError(/competition unit/);
    expect(() => assertGamesTimelineV2({
      ...validResponse,
      units: [{ ...unit, viewState: 'done-ish' }],
    })).toThrowError(/competition unit/);
  });
});
