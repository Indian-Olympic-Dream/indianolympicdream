import type { GamesTimelineUnitV2 } from './games-timeline-v2.types';

const DAY_MS = 86_400_000;
const ORDER_DEPENDENT_GRACE_MS = 12 * 60 * 60 * 1000;
const FIXED_START_RECONCILIATION_GRACE_MS = 3 * 60 * 60 * 1000;

const timestamp = (value: string | null): number => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const unitAnchor = (unit: GamesTimelineUnitV2): number => {
  const exact = timestamp(unit.schedule.startsAt);
  if (Number.isFinite(exact)) return exact;
  return timestamp(unit.programmeSession.startsAt);
};

const isCeremonyUnit = (unit: GamesTimelineUnitV2): boolean => {
  const identity = [
    unit.event.name,
    unit.event.phase,
    unit.event.unit,
    unit.programmeSession.label,
  ].filter(Boolean).join(' ');

  return unit.event.kind === 'ceremony' || /ceremony/i.test(identity);
};

const isOpenTimelineUnit = (unit: GamesTimelineUnitV2): boolean =>
  !isCeremonyUnit(unit)
  && !['official-result', 'provisional-result', 'awaiting-result', 'cancelled', 'eliminated'].includes(unit.viewState);

export function isGamesTimelineUnitAwaitingUpdate(unit: GamesTimelineUnitV2, now: Date): boolean {
  if (unit.viewState !== 'scheduled') return false;
  const exactStart = timestamp(unit.schedule.startsAt);
  if (!Number.isFinite(exactStart)) return false;
  const elapsed = now.getTime() - exactStart;
  return elapsed > 0 && elapsed <= FIXED_START_RECONCILIATION_GRACE_MS;
}

const compareUnits = (left: GamesTimelineUnitV2, right: GamesTimelineUnitV2): number => {
  const leftAnchor = unitAnchor(left);
  const rightAnchor = unitAnchor(right);
  const safeLeft = Number.isFinite(leftAnchor) ? leftAnchor : Number.MAX_SAFE_INTEGER;
  const safeRight = Number.isFinite(rightAnchor) ? rightAnchor : Number.MAX_SAFE_INTEGER;
  return safeLeft - safeRight
    || left.schedule.sequence - right.schedule.sequence
    || left.id.localeCompare(right.id);
};

export interface GamesTimeline24hView {
  units: GamesTimelineUnitV2[];
  windowStartsAt: Date;
  windowEndsAt: Date;
  nextCompetitionDay: boolean;
  focusDateKey: string | null;
}

export interface GamesTimelineSlot {
  id: string;
  timingType: GamesTimelineUnitV2['schedule']['timingType'];
  startsAt: string | null;
  units: GamesTimelineUnitV2[];
}

/** Places the current-time boundary after active units and immediately before
 * the next timed start. Returning slots.length places it at the open end. */
export function gamesTimelineNowMarkerIndex(slots: GamesTimelineSlot[], now: Date): number {
  const nowMs = now.getTime();
  const nextIndex = slots.findIndex((slot) => {
    if (slot.units.some((unit) => unit.viewState === 'live')) return false;
    const firstUnit = slot.units[0];
    const anchor = timestamp(slot.startsAt || firstUnit?.programmeSession.startsAt || null);
    return Number.isFinite(anchor) && anchor >= nowMs;
  });

  return nextIndex >= 0 ? nextIndex : slots.length;
}

/** Only identical timing promises form a shared slot. Order-dependent units
 * remain independent because a common programme anchor is not a start time. */
export function groupGamesTimelineUnits(units: GamesTimelineUnitV2[]): GamesTimelineSlot[] {
  const slots: GamesTimelineSlot[] = [];
  const byKey = new Map<string, GamesTimelineSlot>();

  for (const unit of units) {
    const groupable = Boolean(unit.schedule.startsAt)
      && unit.schedule.timingType !== 'followed-by'
      && unit.schedule.timingType !== 'tbd';
    const key = groupable
      ? `${unit.schedule.dateKey || ''}|${unit.schedule.timingType}|${unit.schedule.startsAt}`
      : `unit|${unit.id}`;
    let slot = byKey.get(key);
    if (!slot) {
      slot = {
        id: key,
        timingType: unit.schedule.timingType,
        startsAt: unit.schedule.startsAt,
        units: [],
      };
      byKey.set(key, slot);
      slots.push(slot);
    }
    slot.units.push(unit);
  }

  return slots;
}

/**
 * A live operational view, not a second schedule browser. Exact units must
 * start in the next 24 hours. Order-dependent units use their programme window
 * only for inclusion and ordering; that anchor is never presented as a start.
 */
export function buildGamesTimeline24h(
  sourceUnits: GamesTimelineUnitV2[],
  now: Date,
): GamesTimeline24hView {
  const start = now.getTime();
  const end = start + DAY_MS;
  const openUnits = sourceUnits.filter(isOpenTimelineUnit).sort(compareUnits);
  const units = openUnits.filter((unit) => {
    if (unit.viewState === 'live') return true;
    const exactStart = timestamp(unit.schedule.startsAt);
    if (Number.isFinite(exactStart)) {
      return (exactStart >= start && exactStart < end) || isGamesTimelineUnitAwaitingUpdate(unit, now);
    }

    if (unit.schedule.timingType !== 'followed-by') return false;
    const sessionStart = timestamp(unit.programmeSession.startsAt);
    const sessionEnd = timestamp(unit.programmeSession.endsAt);
    if (!Number.isFinite(sessionStart) || sessionStart >= end) return false;
    const effectiveEnd = Number.isFinite(sessionEnd) ? sessionEnd : sessionStart + ORDER_DEPENDENT_GRACE_MS;
    return effectiveEnd >= start;
  });

  if (units.length) {
    return {
      units,
      windowStartsAt: now,
      windowEndsAt: new Date(end),
      nextCompetitionDay: false,
      focusDateKey: null,
    };
  }

  const next = openUnits.find((unit) => unitAnchor(unit) >= start && unit.schedule.dateKey);
  const focusDateKey = next?.schedule.dateKey || null;
  return {
    units: focusDateKey
      ? openUnits.filter((unit) => unit.schedule.dateKey === focusDateKey)
      : [],
    windowStartsAt: now,
    windowEndsAt: new Date(end),
    nextCompetitionDay: Boolean(focusDateKey),
    focusDateKey,
  };
}
