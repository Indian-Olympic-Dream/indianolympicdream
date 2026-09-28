import { buildGamesTimeline24h, gamesTimelineNowMarkerIndex, groupGamesTimelineUnits, isGamesTimelineUnitAwaitingUpdate } from './games-timeline-v2.presentation';
import type { GamesTimelineUnitV2 } from './games-timeline-v2.types';

const unit = (
  id: string,
  startsAt: string | null,
  overrides: Partial<GamesTimelineUnitV2> = {},
): GamesTimelineUnitV2 => ({
  id,
  source: {
    scheduleSourceId: 'session-1', provider: null, identityKind: 'official-unit', unitId: null,
    disciplineCode: 'BDM', officialKey: id, url: null,
  },
  sport: { id: 'badminton', name: 'Badminton', slug: 'badminton', olympicStatus: 'active', pictogramUrl: null, parent: null },
  event: { name: "Women's Singles", phase: 'Quarterfinals', unit: 'Match 1', kind: 'competition', medal: false, programmeEvent: null },
  schedule: {
    dateKey: startsAt?.slice(0, 10) || '2026-09-27', startsAt, endsAt: null, displayTime: null,
    timingType: startsAt ? 'fixed' : 'followed-by', precision: startsAt ? 'exact' : 'followed-by',
    status: 'scheduled', venue: null, rescheduled: false, sequence: 0,
  },
  india: { status: 'confirmed', participants: [], organisations: ['IND'], sides: [] },
  result: null,
  programmeSession: { id: 'session-1', label: 'Court 1', startsAt, endsAt: null, sourceBasis: null },
  viewState: 'scheduled',
  ...overrides,
});

describe('games timeline V2 24-hour view', () => {
  const now = new Date('2026-09-27T04:30:00.000Z');

  it('shows only live and upcoming units in the rolling 24-hour window', () => {
    const view = buildGamesTimeline24h([
      unit('past-result', '2026-09-27T03:30:00.000Z', { viewState: 'official-result' }),
      unit('live', '2026-09-27T04:00:00.000Z', { viewState: 'live' }),
      unit('later-today', '2026-09-27T08:00:00.000Z'),
      unit('tomorrow', '2026-09-28T03:00:00.000Z'),
      unit('outside-window', '2026-09-28T05:00:00.000Z'),
    ], now);

    expect(view.units.map((entry) => entry.id)).toEqual(['live', 'later-today', 'tomorrow']);
    expect(view.nextCompetitionDay).toBeFalse();
  });

  it('keeps a just-started scheduled unit visible while the worker reconciles its state', () => {
    const recentlyStarted = unit('archery-r32', '2026-09-27T04:20:00.000Z');
    const stale = unit('stale', '2026-09-27T01:29:59.000Z');
    const view = buildGamesTimeline24h([recentlyStarted, stale], now);

    expect(view.units.map((entry) => entry.id)).toEqual(['archery-r32']);
    expect(isGamesTimelineUnitAwaitingUpdate(recentlyStarted, now)).toBeTrue();
    expect(isGamesTimelineUnitAwaitingUpdate(stale, now)).toBeFalse();
  });

  it('never reintroduces a completed result during the reconciliation window', () => {
    const completed = unit('archery-result', '2026-09-27T04:20:00.000Z', { viewState: 'official-result' });

    expect(buildGamesTimeline24h([completed], now).units).toEqual([]);
    expect(isGamesTimelineUnitAwaitingUpdate(completed, now)).toBeFalse();
  });

  it('never promotes victory ceremonies into the operational timeline', () => {
    const ceremony = unit('victory-ceremony', '2026-09-27T08:30:00.000Z', {
      event: {
        ...unit('base', '2026-09-27T08:30:00.000Z').event,
        name: "Women's 5000m",
        phase: 'Victory Ceremony',
        unit: "Women's 5000m Victory Ceremony",
        // Older stored rows may still be classified as competition. The
        // presentation must not rely on that discriminator alone.
        kind: 'competition',
      },
    });

    const view = buildGamesTimeline24h([
      ceremony,
      unit('competition', '2026-09-27T09:00:00.000Z'),
    ], now);

    expect(view.units.map((entry) => entry.id)).toEqual(['competition']);
  });

  it('keeps a followed-by unit when its programme window is active without inventing a start', () => {
    const followedBy = unit('follows', null, {
      schedule: {
        ...unit('base', null).schedule,
        dateKey: '2026-09-27',
        timingType: 'followed-by',
        displayTime: 'Follows Match 1',
      },
      programmeSession: {
        id: 'court-1', label: 'Court 1', startsAt: '2026-09-27T04:00:00.000Z',
        endsAt: '2026-09-27T10:00:00.000Z', sourceBasis: null,
      },
    });

    expect(buildGamesTimeline24h([followedBy], now).units[0].schedule.startsAt).toBeNull();
  });

  it('falls forward to the next competition day when the next 24 hours are empty', () => {
    const view = buildGamesTimeline24h([
      unit('next-day', '2026-09-29T03:00:00.000Z'),
      unit('later', '2026-09-30T03:00:00.000Z'),
    ], now);

    expect(view.nextCompetitionDay).toBeTrue();
    expect(view.focusDateKey).toBe('2026-09-29');
    expect(view.units.map((entry) => entry.id)).toEqual(['next-day']);
  });

  it('groups exact simultaneous starts into one time slot', () => {
    const slots = groupGamesTimelineUnits([
      unit('archery', '2026-09-27T05:00:00.000Z'),
      unit('shooting', '2026-09-27T05:00:00.000Z'),
      unit('hockey', '2026-09-27T06:00:00.000Z'),
    ]);

    expect(slots).toHaveSize(2);
    expect(slots[0].units.map((entry) => entry.id)).toEqual(['archery', 'shooting']);
    expect(slots[1].units.map((entry) => entry.id)).toEqual(['hockey']);
  });

  it('places now after live units and before the next scheduled start', () => {
    const slots = groupGamesTimelineUnits([
      unit('live', '2026-09-27T04:00:00.000Z', { viewState: 'live' }),
      unit('next', '2026-09-27T05:00:00.000Z'),
      unit('later', '2026-09-27T06:00:00.000Z'),
    ]);

    expect(gamesTimelineNowMarkerIndex(slots, now)).toBe(1);
  });

  it('places now before the first slot when every event is upcoming', () => {
    const slots = groupGamesTimelineUnits([
      unit('next', '2026-09-27T05:00:00.000Z'),
      unit('later', '2026-09-27T06:00:00.000Z'),
    ]);

    expect(gamesTimelineNowMarkerIndex(slots, now)).toBe(0);
  });

  it('never presents followed-by units as simultaneous starts', () => {
    const first = unit('court-1-follows', null);
    const second = unit('court-2-follows', null);
    const slots = groupGamesTimelineUnits([first, second]);

    expect(slots).toHaveSize(2);
    expect(slots.every((slot) => slot.units.length === 1)).toBeTrue();
  });

  it('keeps fixed and estimated promises in separate slots at the same instant', () => {
    const fixed = unit('fixed', '2026-09-27T05:00:00.000Z');
    const estimated = unit('estimated', '2026-09-27T05:00:00.000Z', {
      schedule: {
        ...unit('base', '2026-09-27T05:00:00.000Z').schedule,
        timingType: 'estimated',
      },
    });

    expect(groupGamesTimelineUnits([fixed, estimated])).toHaveSize(2);
  });
});
