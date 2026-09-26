import type { GamesScheduleRow, GamesSessionDetail } from '../services/payload.service';

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

/** A row enters Results only when the published result is explicitly official. */
export function hasOfficialResult(row: GamesScheduleRow): boolean {
  return row.result?.official === true && Boolean(row.result.summary?.trim());
}

const normalizeResultIdentity = (value: unknown): string => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Resolve whether this exact nested fixture has an official published result. */
export function hasOfficialResultForDetail(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
  if (!hasOfficialResult(row)) return false;
  const matches = row.result?.matches || [];
  if (!matches.length) return (row.sessionDetails || []).length <= 1;

  const officialKey = String(detail.sourceUrl || '').match(/\/results\/([^/?#]+)/)?.[1];
  if (officialKey && matches.some(match => match.officialKey === officialKey && Boolean(match.summary?.trim()))) {
    return true;
  }

  const detailText = normalizeResultIdentity(`${detail.event} ${detail.phase || ''} ${detail.unit || ''}`);
  return matches.some(match => {
    if (!match.summary?.trim()) return false;
    const event = normalizeResultIdentity(match.event);
    const phase = normalizeResultIdentity(match.phase);
    const unit = normalizeResultIdentity(match.unit);
    return (!event || detailText.includes(event))
      && (!phase || detailText.includes(phase))
      && (!unit || detailText.includes(unit));
  });
}

/** A schedule drawer should contain only unresolved competition units. */
export function isOpenScheduleDetail(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
  const identity = `${detail.event || ''} ${detail.phase || ''} ${detail.unit || ''}`;
  if (/ceremony/i.test(identity)) return false;
  if (/^(cancelled|canceled|postponed|eliminated|withdrawn|completed)$/i.test(detail.status || '')) return false;
  return !hasOfficialResultForDetail(detail, row);
}

/** Keep unfinished and provisional rows in Schedule, independent of other rows that day. */
export function isOpenScheduleRow(row: GamesScheduleRow): boolean {
  if (['cancelled', 'eliminated', 'postponed'].includes(row.status || '')) return false;
  if (row.sessionDetails?.length) {
    return row.sessionDetails.some(detail => isOpenScheduleDetail(detail, row));
  }
  return !hasOfficialResult(row);
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
