import type { GamesScheduleRow } from '../services/payload.service';

/** Match the matrix's day-based X axis, not query order or session volume. */
export function compareMatrixSportStarts(
  a: { firstDay: string | null; name: string; slug: string },
  b: { firstDay: string | null; name: string; slug: string },
): number {
  if (a.firstDay !== b.firstDay) {
    if (!a.firstDay) return 1;
    if (!b.firstDay) return -1;
    return a.firstDay.localeCompare(b.firstDay);
  }
  return a.name.localeCompare(b.name, 'en') || a.slug.localeCompare(b.slug, 'en');
}

export function hasIndiaAppearance(row: GamesScheduleRow): boolean {
  // Master sessions can inherit the legacy 'confirmed' default. An India link
  // is required before presenting them as an Indian athlete's start.
  return row.participationStatus === 'confirmed'
    && !row.isConditional
    && !!(row.indianParticipants?.length || row.gamesParticipations?.length
      || (row.timingPrecision === 'exact' && row.sessionDetails?.some(detail => detail.organisations?.includes('IND'))))
    && !['cancelled', 'eliminated', 'postponed'].includes(row.status || '');
}

export function scheduleTiming(row: GamesScheduleRow): string {
  if (row.timingPrecision !== 'exact' && row.timingPrecision !== 'session-window') return 'Time TBC';
  const start = Date.parse(row.startTime);
  if (!Number.isFinite(start)) return 'Time TBC';
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const first = formatter.format(start);
  if (row.timingPrecision === 'exact') return `${first} IST`;
  const end = Date.parse(row.endTime || '');
  return Number.isFinite(end) && end > start
    ? `${first}–${formatter.format(end)} IST` : `From ${first} IST`;
}

export function indiaDateKey(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(timestamp));
}
