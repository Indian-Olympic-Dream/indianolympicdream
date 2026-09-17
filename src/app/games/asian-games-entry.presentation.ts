import type { GamesParticipationRow, GamesScheduleRow, GamesSessionDetail, Sport } from '../services/payload.service';

/** Keep UI event matching aligned with the schedule reconciliation audit. */
export function normalizeAsianGamesEventName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[’']/g, '')
    .replace(/\bboys?\b/g, 'men')
    .replace(/\bgirls?\b/g, 'women')
    .replace(/\bwomens?\b/g, 'women')
    .replace(/\bmens?\b/g, 'men')
    .replace(/\bwomen\s+wrestling\b/g, 'women freestyle')
    .replace(/\bpuyo\s+puyo\s+(?:champions|esports)\b/g, 'puyo puyo')
    .replace(/\bmixed doubles?\b/g, 'mixed doubles')
    .replace(/\bindividual\b/g, '')
    .replace(/\bteam\s*[12]\b/g, 'team')
    .replace(/(\d)\s*(kg|m)\b/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function asianGamesEventsEquivalent(scheduleEvent: string, entryEvent: string): boolean {
  const detail = normalizeAsianGamesEventName(scheduleEvent);
  const entry = normalizeAsianGamesEventName(entryEvent);
  if (!detail || !entry) return false;
  if (detail === entry) return true;
  // A '+' class is open-ended and must never collapse into the adjacent
  // unsigned/'minus' class during the broader token comparison below.
  if (detail.includes('plus ') !== entry.includes('plus ')) return false;

  const detailTokens = [...new Set(detail.split(' ').filter(Boolean))];
  const entryTokens = [...new Set(entry.split(' ').filter(Boolean))];
  const detailSet = new Set(detailTokens);
  const entrySet = new Set(entryTokens);
  if (detailTokens.length === entryTokens.length && detailTokens.every(token => entrySet.has(token))) return true;

  const detailInsideEntry = detailTokens.every(token => entrySet.has(token));
  const entryInsideDetail = entryTokens.every(token => detailSet.has(token));
  const shorter = detailTokens.length <= entryTokens.length ? detailTokens : entryTokens;
  const meaningfulSingle = shorter.length === 1 && !['men', 'women', 'mixed', 'team'].includes(shorter[0]);
  const genericGenderFixture = detailTokens.length === 1
    && ['men', 'women'].includes(detailTokens[0])
    && entrySet.has(detailTokens[0]);
  return (detailInsideEntry || entryInsideDetail) && (shorter.length >= 2 || meaningfulSingle || genericGenderFixture);
}

export function isActiveAsianGamesEntry(row: GamesParticipationRow): boolean {
  return !['withdrawn', 'disqualified', 'suspended'].includes(row.status || '')
    && !['withdrawn', 'replaced'].includes(row.selectionStatus || '');
}

function rootSportKey(sport?: Sport | null): string {
  const root = sport?.parentSport || sport;
  return root?.id || root?.slug || '';
}

function participationEventNames(row: GamesParticipationRow): string[] {
  // eventName can contain a multi-line sanction description. Prefer canonical fields.
  const canonical = [row.eventBucket, row.gamesProgrammeEvent?.officialName].filter(Boolean) as string[];
  return canonical.length ? canonical : row.eventName ? [row.eventName] : [];
}

export function indianEntriesForSessionDetail(
  detail: GamesSessionDetail,
  scheduleRow: GamesScheduleRow,
  participations: GamesParticipationRow[],
): string[] {
  const scheduleSport = rootSportKey(scheduleRow.sport);
  const detailText = `${detail.event || ''} ${detail.phase || ''} ${detail.unit || ''}`;
  if (!scheduleSport || !detail.event || /ceremony/i.test(detailText)) return [];

  const names = participations
    .filter(row => isActiveAsianGamesEntry(row)
      && rootSportKey(row.sport) === scheduleSport
      && participationEventNames(row).some(event => asianGamesEventsEquivalent(detail.event, event)))
    .map(row => row.athlete?.fullName || row.sourceName || '')
    .filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export function hasPublishedIndiaParticipants(detail: GamesSessionDetail, row: GamesScheduleRow): boolean {
  const indiaSide = detail.sides?.find(side => side.code?.toUpperCase() === 'IND');
  if (indiaSide?.participants?.length) return true;
  const hasIndiaOrganisation = detail.organisations?.some(code => code.toUpperCase() === 'IND');
  return Boolean(hasIndiaOrganisation && row.indianParticipants?.length);
}
