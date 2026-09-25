import type { GamesResultMatch, GamesScheduleRow, GamesSessionDetail } from '../services/payload.service';
import { hasIndiaAppearance } from './games-hub.presentation';

export function uniqueSessionRows(rows: GamesScheduleRow[]): GamesScheduleRow[] {
  return [...new Map(rows.filter(r => r?.id && Number.isFinite(Date.parse(r.startTime))).map(r => [r.id, r])).values()];
}

export function isBronzeDetail(detail: GamesSessionDetail): boolean {
  if (!detail) return false;
  const text = `${detail.event || ''} ${detail.phase || ''} ${detail.unit || ''}`.toLowerCase();
  if (/semi[- ]?final|quarter[- ]?final/i.test(text)) return false;
  if (/third round|3rd round|\bround of\b/i.test(text)) return false;
  return /\b(bronze|3\/4)\b/i.test(text) || /\b(3rd|third)\s*(place|play[- ]?off|match)?\b/i.test(text) || /play[- ]?off/i.test(text);
}

export function isMedalDetail(detail: GamesSessionDetail): boolean {
  if (!detail || !detail.medal) return false;
  const text = `${detail.event || ''} ${detail.phase || ''} ${detail.unit || ''}`.toLowerCase();
  // Semifinals, preliminary rounds, classifications, ceremonies are NOT medal matches
  if (/semi[- ]?final|quarter[- ]?final|\bround of\b|heats|preliminary|pool|classification|ceremony/i.test(text)) {
    return false;
  }
  return true;
}

export function asianSessionMedal(row: GamesScheduleRow): boolean {
  if (['cancelled', 'postponed', 'eliminated'].includes(row.status || '')) return false;
  const title = `${row.eventName || ''} ${row.name || ''}`;
  if (/semi[- ]?final|quarter[- ]?final|final\s*b\b|classification/i.test(title)) return false;
  if (/ceremony/i.test(title) && !/\bfinals?\b|\bgold\b|\bbronze\b/i.test(title)) return false;
  if (typeof row.isMedalSession === 'boolean') return row.isMedalSession;
  return ['final', 'gold-medal', 'bronze-medal'].includes(row.phase || '') || /\bfinals?\b|\bmedal match\b/i.test(title);
}

/**
 * A schedule row is a programme session or fixture; its nested details are the
 * competition events/phases. Bronze and gold matches can award the same event,
 * so consumers must deduplicate by sport + event rather than count medal rows.
 */
export function asianMedalEventKeys(row: GamesScheduleRow): string[] {
  const sportKey = row.sport?.id || row.sport?.slug || 'unknown-sport';
  const detailKeys = (row.sessionDetails || [])
    .filter(detail => detail.medal && detail.event?.trim() && !/semi[- ]?final|quarter[- ]?final|\bround of\b|heats|preliminary|pool|classification|ceremony/i.test(`${detail.phase || ''} ${detail.unit || ''}`))
    .map(detail => `${sportKey}|${detail.event.trim().toLocaleLowerCase('en')}`);
  if (detailKeys.length) return [...new Set(detailKeys)];

  // Compatibility for an older or partial row which identifies a medal
  // session before event-level details have been published.
  if (!asianSessionMedal(row)) return [];
  const fallback = row.gamesProgrammeEvent?.id || row.eventName || row.name || row.id;
  return [`${sportKey}|${fallback.trim().toLocaleLowerCase('en')}`];
}

export function asianMedalEventCount(rows: GamesScheduleRow[]): number {
  return new Set(rows.flatMap(asianMedalEventKeys)).size;
}

export function asianParticipation(row: GamesScheduleRow): 'confirmed' | 'conditional' | 'contingent' {
  if (hasIndiaAppearance(row)) return 'confirmed';
  if (row.isConditional || ['progression-dependent', 'pool-position-dependent'].includes(row.participationStatus || '')) return 'conditional';
  return 'contingent';
}

export function asianSessionStage(row: GamesScheduleRow): string {
  const stages: Record<string, string> = { 'quarterfinal': 'Quarterfinal', 'semifinal': 'Semifinal', 'gold-medal': 'Gold medal match', 'bronze-medal': 'Bronze medal match', 'final': 'Final', 'group': 'Group stage', 'heats': 'Heats', 'qualifying': 'Qualification', 'round-64': 'Round of 64', 'round-32': 'Round of 32', 'round-16': 'Round of 16' };
  if (stages[row.phase || '']) return stages[row.phase!];
  return row.timingPrecision === 'session-window' ? 'Programme session' : 'Competition';
}

/** Preserve published status independently of a session's medal significance. */
export function asianSessionBadge(row: GamesScheduleRow): { label: string; type: string } | null {
  if (row.status === 'cancelled') return { label: 'Cancelled', type: 'cancelled' };
  if (row.status === 'postponed') return { label: 'Postponed', type: 'cancelled' };
  if (row.status === 'live') return { label: 'Live', type: 'live' };
  if (row.status === 'eliminated') return { label: 'Eliminated', type: 'result' };
  if (row.result?.summary && row.result?.official === false) return { label: 'Unofficial', type: 'window' };
  if (row.status === 'completed' || row.result?.summary) return { label: row.result?.summary ? 'Result' : 'Completed', type: 'result' };
  if (hasIndiaAppearance(row)) return { label: 'Confirmed', type: 'confirmed' };
  if (asianParticipation(row) === 'conditional') return { label: 'If qualified', type: 'conditional' };
  if (row.certainty === 'Reported · awaiting official verification') return { label: 'Reported', type: 'window' };
  return null;
}

/** Explicit choices survive empty filters; automatic selection follows the IST day. */
export function resolveTimelineDate(days: string[], requested: string, today: string, gamesEnd: string): string {
  if (requested) return requested;
  const dates = [...new Set(days)].sort();
  if (!dates.length) return today;
  if (today >= dates[0] && today <= gamesEnd) return today;
  return dates.find(day => day >= today) || dates.at(-1)!;
}

export function isCeremonyDetail(detail: GamesSessionDetail): boolean {
  return /ceremony/i.test(detail.phase || '') || /ceremony/i.test(detail.unit || '') || /ceremony/i.test(detail.event);
}

/** Official unit titles often repeat the event and phase. Keep only extra information. */
export function sessionDetailSubtitle(detail: GamesSessionDetail): string {
  const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/women\b/g, 'womens').replace(/(?<!wo)men\b/g, 'mens').replace(/individual/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).sort().join(' ');
  const unit = detail.unit || '';
  const phase = detail.phase || '';
  const extra = normalize(unit)
    && normalize(unit) !== normalize(phase)
    && normalize(unit) !== normalize(detail.event)
    && normalize(unit) !== normalize(detail.event + ' ' + phase);
  return [phase, extra ? unit : ''].filter(Boolean).join(' · ');
}

const START_LIST_SPORTS = new Set([
  'shooting', 'athletics', 'aquatics', 'swimming', 'diving', 'artistic-swimming',
  'weightlifting', 'gymnastics', 'artistic-gymnastics', 'rhythmic-gymnastics',
  'trampoline-gymnastics', 'cycling', 'rowing', 'canoe', 'canoe-sprint',
  'canoe-slalom', 'kayak', 'sailing', 'golf', 'triathlon', 'modern-pentathlon',
  'equestrian', 'roller-sports', 'skateboarding'
]);

/** True only when a detail represents opposing sides rather than a start list. */
export function isHeadToHeadDetail(detail: GamesSessionDetail, sportSlug?: string): boolean {
  if (!detail || isCeremonyDetail(detail)) return false;

  const slug = (sportSlug || '').toLowerCase();
  const text = `${detail.event || ''} ${detail.phase || ''} ${detail.unit || ''}`.toLowerCase();
  if (START_LIST_SPORTS.has(slug) || /\b(?:qualification|heats?|ranking round|stroke play|time trial|qualifying)\b/i.test(text)) {
    return false;
  }

  if (detail.sides?.length) return detail.sides.length <= 2;
  const organisations = detail.organisations || [];
  return organisations.length > 0 && organisations.length <= 2;
}

const normalizeResultText = (value: unknown): string => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const identityTokens = (value: unknown): string[] => normalizeResultText(value)
  .split(' ')
  .filter(token => token.length > 1);

function namesShareIdentity(left: unknown, right: unknown): boolean {
  const leftTokens = identityTokens(left);
  const rightTokens = identityTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter(token => rightSet.has(token));
  return shared.length >= Math.min(2, leftTokens.length, rightTokens.length)
    || shared.some(token => token.length >= 4);
}

/** Resolve an official result unit to the exact nested programme detail. */
export function resultMatchForDetail(detail: GamesSessionDetail, row: GamesScheduleRow): GamesResultMatch | null {
  const matches = row.result?.matches || [];
  const officialKey = String(detail.sourceUrl || '').match(/\/results\/([^/?#]+)/)?.[1];
  const exact = officialKey ? matches.find(match => match.officialKey === officialKey) : null;
  if (exact) return exact;

  const detailText = normalizeResultText(`${detail.event} ${detail.phase || ''} ${detail.unit || ''}`);
  return matches.find(match => {
    const event = normalizeResultText(match.event);
    const phase = normalizeResultText(match.phase);
    const unit = normalizeResultText(match.unit);
    return (!event || detailText.includes(event)) && (!phase || detailText.includes(phase)) && (!unit || detailText.includes(unit));
  }) || null;
}

/**
 * Entrant fixtures use an athlete or pair as the side identity. Team fixtures
 * use a country/team identity and may legitimately show a roster below it.
 */
export function isEntrantHeadToHeadDetail(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
  const sides = detail.sides || [];
  if (sides.length !== 2) return false;

  const sideIdentityIsPublished = sides.some(side =>
    (side.participants || []).some(participant => namesShareIdentity(side.label, participant))
  );
  if (sideIdentityIsPublished) return true;

  const match = resultMatchForDetail(detail, row);
  return (match?.entries || []).some(entry =>
    sides.some(side => namesShareIdentity(side.label, entry.name))
  );
}

function resultScoreParts(summary?: string): { first: string; second: string; suffix: string } | null {
  const score = String(summary || '').match(/(\d+(?:\/\d+)?)\s*[–-]\s*(\d+(?:\/\d+)?)(.*)$/);
  return score ? { first: score[1], second: score[2], suffix: score[3].trim() } : null;
}

/** Use athlete/pair names for entrant results while preserving country-first team copy. */
export function resultSummaryForDetail(detail: GamesSessionDetail, row: GamesScheduleRow): string | null {
  const match = resultMatchForDetail(detail, row);
  const fallback = match?.summary || ((row.sessionDetails || []).filter(item => !isCeremonyDetail(item)).length === 1
    ? row.result?.summary || null
    : null);
  if (!match?.summary || !isEntrantHeadToHeadDetail(detail, row)) return fallback;

  const sides = detail.sides || [];
  const parsed = resultScoreParts(match.summary);
  const indiaSides = sides.filter(side => side.code?.toUpperCase() === 'IND');
  const directWinner = sides.find(side => side.isWinner);
  const numericWinner = sides.find(side => {
    const other = sides.find(candidate => candidate !== side);
    return Number.isFinite(Number(side.score)) && Number(side.score) > Number(other?.score);
  });

  let subject = sides[0];
  let opponent = sides[1];
  let verb = 'beat';

  if (indiaSides.length === 1) {
    subject = indiaSides[0];
    opponent = sides.find(side => side !== subject)!;
    const subjectWon = subject.isWinner === true
      || (subject.isWinner === undefined && /\bindia\s+beat\b/i.test(match.summary));
    verb = subjectWon ? 'beat' : 'lost to';
  } else {
    subject = directWinner || numericWinner || sides[0];
    opponent = sides.find(side => side !== subject)!;
  }

  const subjectScore = subject.score ?? (indiaSides.length === 1 ? parsed?.first : sides.indexOf(subject) === 0 ? parsed?.first : parsed?.second);
  const opponentScore = opponent.score ?? (indiaSides.length === 1 ? parsed?.second : sides.indexOf(opponent) === 0 ? parsed?.first : parsed?.second);
  const score = subjectScore !== null && subjectScore !== undefined && opponentScore !== null && opponentScore !== undefined
    ? ` ${subjectScore}–${opponentScore}`
    : '';
  const suffix = parsed?.suffix ? ` ${parsed.suffix}` : '';
  return `${subject.label} ${verb} ${opponent.label}${score}${suffix}`;
}

export function resultMedalsForDetail(detail: GamesSessionDetail, row: GamesScheduleRow): string[] {
  const match = resultMatchForDetail(detail, row);
  if (!match) return [];
  const summaryMedal = String(match.summary || '').match(/\b(Gold|Silver|Bronze)\b/i)?.[1];
  const values = [match.medal, ...(match.entries || []).map(entry => entry.medal), summaryMedal]
    .filter((medal): medal is string => Boolean(medal))
    .map(medal => medal.charAt(0).toUpperCase() + medal.slice(1).toLowerCase())
    .filter(medal => ['Gold', 'Silver', 'Bronze'].includes(medal));
  const order = new Map([['Gold', 0], ['Silver', 1], ['Bronze', 2]]);
  return [...new Set(values)].sort((left, right) => order.get(left)! - order.get(right)!);
}

/** Results drawers are India views; do not surface adjacent non-India fixtures from the same session. */
export function hasIndiaResultForDetail(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
  const match = resultMatchForDetail(detail, row);
  const publishedCodes = (detail.sides || []).map(side => side.code?.toUpperCase()).filter(Boolean);
  const organisationCodes = (detail.organisations || []).map(code => code.toUpperCase()).filter(Boolean);
  const detailCodes = publishedCodes.length ? publishedCodes : organisationCodes;
  if (detailCodes.length) return detailCodes.includes('IND');
  return (match?.entries || []).some(entry => entry.organisation?.toUpperCase() === 'IND')
    || /\bindia\b/i.test(match?.summary || '');
}

export function resultRankLabel(rank?: number | null): string {
  if (!rank) return '—';
  const mod100 = rank % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th');
  return `${rank}${suffix}`;
}

/** Keep timeline rows compact; full ranked fields live in the detail drawer. */
export function timelineResultSummary(row: GamesScheduleRow): string | null {
  const ranked = (row.result?.matches || []).filter(match => match.format === 'ranked');
  if (!ranked.length) return row.result?.summary || null;
  const entries = ranked.flatMap(match => match.entries || []);
  const medals = entries.filter(entry => entry.medal);
  if (medals.length) {
    const medalCounts = new Map<string, number>();
    medals.forEach(entry => medalCounts.set(entry.medal!, (medalCounts.get(entry.medal!) || 0) + 1));
    const medalText = [...medalCounts].map(([medal, count]) => `${count} ${medal.toLowerCase()}${count === 1 ? '' : 's'}`).join(' · ');
    return `${medalText} · ${entries.length} India result${entries.length === 1 ? '' : 's'}`;
  }
  return `${entries.length} India result${entries.length === 1 ? '' : 's'}`;
}
