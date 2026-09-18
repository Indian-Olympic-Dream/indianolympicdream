import type { GamesScheduleRow, GamesSessionDetail } from '../services/payload.service';
import { isBronzeDetail } from './asian-games-session.presentation';

/** Editorial priorities are independent of Olympic programme membership. */
export const IOD_COVERAGE_SPORTS = new Set([
  'athletics', 'badminton', 'hockey', 'shooting', 'archery', 'boxing',
  'wrestling', 'weightlifting', 'table-tennis', 'tennis', 'cricket', 'squash',
]);

/** Sanction-source sport groups mapped to https://la28.org/en/games-plan/olympics.html
 * Checked 10 September 2026. Sport-level only: not every Asian Games event is Olympic.
 * Canoe/kayak combines sprint and slalom in the sanction baseline.
 */
export const LA28_SPORT_GROUPS = new Set([
  ...IOD_COVERAGE_SPORTS,
  'artistic-gymnastics', 'canoe-kayak', 'equestrian', 'fencing', 'golf',
  'judo', 'rowing', 'rugby-sevens', 'sailing', 'sport-climbing', 'surfing',
  'swimming', 'taekwondo', 'track-cycling', 'volleyball',
]);

export function matchesGamesScope(
  slug: string | undefined,
  la28Only: boolean,
  selectedSport = 'all',
  iodCoverageOnly = false,
): boolean {
  return !!slug && (!la28Only || LA28_SPORT_GROUPS.has(slug))
    && (!iodCoverageOnly || IOD_COVERAGE_SPORTS.has(slug))
    && (selectedSport === 'all' || slug === selectedSport);
}

export interface La28QuotaInfo {
  tagline: string;
  shortLabel: string;
  description: string;
  quotaBreakdown: string[];
  sourceUrl: string;
  sourceLabel: string;
}

/** Sports offering direct qualification/quota pathways for the LA 2028 Olympic Games at the Asian Games */
export const LA28_QUOTA_SPORTS = new Set([
  'hockey', 'squash', 'archery', 'tennis', 'surfing',
]);

export function isLa28QuotaSport(slug?: string | null): boolean {
  return !!slug && LA28_QUOTA_SPORTS.has(slug.toLowerCase());
}

export function getLa28QuotaInfo(slug?: string | null): La28QuotaInfo | null {
  if (!slug) return null;
  switch (slug.toLowerCase()) {
    case 'hockey':
      return {
        tagline: 'Continental Direct Quota',
        shortLabel: 'LA28 Quota',
        description: 'Asian Games gold medalists earn direct qualification for the Los Angeles 2028 Olympic Games.',
        quotaBreakdown: [
          "Men's Tournament: 1 Team quota (16 athletes)",
          "Women's Tournament: 1 Team quota (16 athletes)",
        ],
        sourceUrl: 'https://www.fih.hockey/news/ioc-approves-la28-olympic-hockey-tournaments-qualification-system',
        sourceLabel: 'FIH & IOC LA28 Qualification System',
      };
    case 'squash':
      return {
        tagline: 'Historic Olympic Debut',
        shortLabel: 'LA28 Quota',
        description: 'Continental champions earn direct qualification places for Squash’s first-ever Olympic Games appearance at LA28.',
        quotaBreakdown: [
          "Men's Singles: 1 Quota place (Gold medalist)",
          "Women's Singles: 1 Quota place (Gold medalist)",
        ],
        sourceUrl: 'https://ussquash.org/2026/02/olympic-qualification-system-announced-for-squash-at-la28-olympic-games/',
        sourceLabel: 'World Squash & IOC LA28 Pathway',
      };
    case 'archery':
      return {
        tagline: 'Primary Continental Allocation',
        shortLabel: 'LA28 Quota',
        description: 'The Asian Games awards direct places through the recurve individual and mixed-team events, plus the compound mixed-team event.',
        quotaBreakdown: [
          "Recurve Mixed Team: 1 Man & 1 Woman quota place (2 quotas)",
          "Compound Mixed Team: 1 Man & 1 Woman quota place (2 quotas · Olympic Debut)",
          "Recurve Individual: Top 2 eligible athletes per gender from different NOCs",
        ],
        sourceUrl: 'https://www.worldarchery.sport/news/202304/archerys-la28-olympic-games-qualification-pathway-released',
        sourceLabel: 'World Archery & IOC LA28 System',
      };
    case 'tennis':
      return {
        tagline: 'Continental Singles Allocation',
        shortLabel: 'LA28 Quota',
        description: 'Singles gold medalists earn direct continental qualification for LA28 (subject to Top 500 ATP/WTA ranking on cut-off date).',
        quotaBreakdown: [
          "Men's Singles: 1 Quota place (Gold medalist)",
          "Women's Singles: 1 Quota place (Gold medalist)",
        ],
        sourceUrl: 'https://stillmed.olympics.com/media/Documents/Olympic-Games/LA28/TEN-LA28-Qualification-System.pdf',
        sourceLabel: 'ITF & IOC LA28 Qualification System',
      };
    case 'surfing':
      return {
        tagline: 'Continental Quota Berth',
        shortLabel: 'LA28 Quota',
        description: 'The highest-placed eligible athlete from Asia in the 2026 Asian Games qualifies directly for the LA28 Olympic Games.',
        quotaBreakdown: [
          "Men's Shortboard: 1 Quota place",
          "Women's Shortboard: 1 Quota place",
        ],
        sourceUrl: 'https://stillmed.olympics.com/media/Documents/Olympic-Games/LA28/SRF-LA28-Qualification-System.pdf',
        sourceLabel: 'ISA & IOC LA28 Qualification System',
      };
    default:
      return null;
  }
}

export function getLa28QuotaNote(slug?: string | null): string | null {
  const info = getLa28QuotaInfo(slug);
  return info ? `${info.tagline}: ${info.description}` : null;
}

/**
 * Checks if a specific event within a sport qualifies for a direct LA28 Olympic quota at the Asian Games:
 * - Archery: Recurve Men's Individual, Recurve Women's Individual, Recurve Mixed Team, and Compound Mixed Team.
 * - Squash: Strictly Men's Singles and Women's Singles (no team events, no doubles).
 * - Tennis: Strictly Men's Singles and Women's Singles (no doubles).
 * - Hockey: Men's Tournament and Women's Tournament.
 * - Surfing: Shortboard Men and Shortboard Women.
 */
export function isLa28QuotaEventName(eventName: string, sportSlug?: string | null): boolean {
  if (!sportSlug || !isLa28QuotaSport(sportSlug)) return false;
  const name = (eventName || '').toLowerCase();
  const slug = sportSlug.toLowerCase();

  switch (slug) {
    case 'squash':
      // LA28 Squash is strictly Men's Singles and Women's Singles
      return name.includes('singles') && !name.includes('doubles') && !name.includes('team');

    case 'archery':
      // Recurve team finals are medal events but do not award an LA28 quota at these Asian Games.
      if (name.includes('recurve')) {
        return name.includes('individual') || (name.includes('mixed') && name.includes('team'));
      }
      if (name.includes('compound') && name.includes('mixed') && name.includes('team')) return true;
      return false;

    case 'tennis':
      // Only singles earn direct continental quota
      return name.includes('singles') && !name.includes('doubles');

    case 'hockey':
    case 'surfing':
      return true;

    default:
      return false;
  }
}

/**
 * Determines whether a session detail represents a direct LA28 Olympic quota match:
 * - Must belong to an official quota sport & specific quota event.
 * - Must be a Gold Medal Match / Final.
 * - Must NOT be a Semifinal, Quarterfinal, preliminary stage, or Bronze Medal match.
 */
export function isLa28QuotaDetail(detail: GamesSessionDetail, sportSlug?: string | null): boolean {
  if (!sportSlug || !isLa28QuotaSport(sportSlug)) return false;
  const event = (detail.event || '').toLowerCase();
  const phase = (detail.phase || '').toLowerCase();
  const unit = (detail.unit || '').toLowerCase();
  const text = `${event} ${phase} ${unit}`;

  // Semifinals, preliminary rounds, classifications, ceremonies never earn direct quotas
  if (/semi[- ]?final|quarter[- ]?final|\bround of\b|heats|preliminary|pool|classification|ceremony/i.test(text)) {
    return false;
  }

  // Bronze medal matches / 3rd place playoffs do not earn direct continental quota
  if (isBronzeDetail(detail)) {
    return false;
  }

  // Must be a gold medal match or final
  const isFinalOrGold = unit.includes('gold') || unit.includes('final') || phase.includes('final') || phase === 'gold-medal';
  if (!isFinalOrGold) return false;

  return isLa28QuotaEventName(detail.event || text, sportSlug);
}

/**
 * Checks if a session row features a direct LA28 Olympic quota match.
 */
export function isLa28QuotaRow(row: GamesScheduleRow): boolean {
  const slug = row.sport?.slug;
  if (!slug || !isLa28QuotaSport(slug)) return false;

  const details = row.sessionDetails || [];
  if (details.length > 0) {
    return details.some(d => isLa28QuotaDetail(d, slug));
  }

  const text = `${row.name || ''} ${row.eventName || ''} ${row.phase || ''}`.toLowerCase();
  if (/semi[- ]?final|quarter[- ]?final|classification|ceremony/i.test(text)) return false;
  if (/\b(bronze|3\/4)\b/i.test(text) || /\b(3rd|third)\s*(place|play[- ]?off|match)?\b/i.test(text) || /play[- ]?off/i.test(text)) {
    return false;
  }

  const isFinalOrGold = text.includes('gold') || text.includes('final') || ['final', 'finals', 'gold-medal'].includes((row.phase || '').toLowerCase());
  if (!isFinalOrGold) return false;

  return isLa28QuotaEventName(row.eventName || row.name || '', slug);
}

/** Continuous days preserve elapsed time, including ceremony/rest days. */
export function continuousGamesDates(keys: string[]): string[] {
  const valid = [...new Set(keys.filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)))].sort();
  if (!valid.length) return [];
  const dates: string[] = [];
  for (let day = Date.parse(valid[0] + 'T12:00:00Z'), last = Date.parse(valid.at(-1)! + 'T12:00:00Z'); day <= last; day += 86_400_000) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
}
