import type { GamesHubMedalRecord, GamesHubMedalSummary } from '../services/payload.service';

export type GamesMedalFilter = 'all' | 'la28' | 'asian-games';

export interface GamesMedalView {
  total: number;
  gold: number;
  silver: number;
  bronze: number;
  records: GamesHubMedalRecord[];
}

function normalizeIdentity(str: string): string {
  return str
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\bmens\b/g, 'men')
    .replace(/\bwomens\b/g, 'women')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Deduplicates raw medal records across feeds and removes non-medal classification rows.
 */
export function deduplicateMedalRecords(records: GamesHubMedalRecord[]): GamesHubMedalRecord[] {
  if (!records || !records.length) return [];

  const sourceRank = (source: string | undefined): number => {
    if (source === 'official-medal') return 3;
    if (source === 'official-rank') return 2;
    return 1;
  };

  const isInvalidMedalRow = (record: GamesHubMedalRecord): boolean => {
    if (!['gold', 'silver', 'bronze'].includes(record.medal)) return true;
    const event = (record.event || '').toLowerCase();
    // Exclude classification races (Final B, 7th-12th places, heats, etc.)
    if (/\b(final\s+b|classification|7th-12th|semi-final|semifinal|repechage|heats?)\b/i.test(event)) {
      return true;
    }
    return false;
  };

  const validRecords = records.filter(record => !isInvalidMedalRow(record));
  const resultMap = new Map<string, GamesHubMedalRecord>();

  for (const record of validRecords) {
    const sportKey = normalizeIdentity(record.sportSlug || record.sport || '');
    const eventKey = normalizeIdentity(record.event || '');
    const recipientKey = normalizeIdentity(record.recipient || '');
    const medalKey = record.medal;

    const primaryKey = record.officialKey
      ? `official:${record.officialKey.trim().toLowerCase()}|${medalKey}`
      : `composite:${sportKey}|${eventKey}|${medalKey}|${recipientKey}`;

    const secondaryKey = `composite:${sportKey}|${eventKey}|${medalKey}|${recipientKey}`;

    const existing = resultMap.get(primaryKey) || resultMap.get(secondaryKey);
    if (!existing) {
      resultMap.set(primaryKey, record);
      resultMap.set(secondaryKey, record);
    } else {
      if (sourceRank(record.source) > sourceRank(existing.source) || (!existing.dateKey && record.dateKey)) {
        resultMap.set(primaryKey, record);
        resultMap.set(secondaryKey, record);
      }
    }
  }

  return Array.from(new Set(resultMap.values()));
}

export function medalRecordsForFilter(
  summary: GamesHubMedalSummary | null,
  filter: GamesMedalFilter,
): GamesHubMedalRecord[] {
  if (!summary || !Array.isArray(summary.records)) return [];

  // The API resolves each medal against the edition's programme-event mapping.
  // Do not reclassify from sport/event-name heuristics here: similar event names
  // can have different LA28 status (for example Trap Mixed Team vs Skeet Mixed Team).
  const deduplicated = deduplicateMedalRecords(summary.records);

  if (filter === 'la28') {
    return deduplicated.filter(record => record.olympicCategory === 'la28' || record.olympicCategory === 'new_in_la28');
  }
  if (filter === 'asian-games') {
    return deduplicated.filter(record => record.olympicCategory === 'non_olympic');
  }
  return deduplicated;
}

export function medalView(summary: GamesHubMedalSummary | null, filter: GamesMedalFilter): GamesMedalView {
  const records = medalRecordsForFilter(summary, filter);
  return {
    total: records.length,
    gold: records.filter(record => record.medal === 'gold').length,
    silver: records.filter(record => record.medal === 'silver').length,
    bronze: records.filter(record => record.medal === 'bronze').length,
    records,
  };
}
