export type IndiaTier =
  | 'medal_hopeful'
  | 'outside_chance'
  | 'qualification_watch'
  | 'history_only';

export type SportLifecycle = 'active' | 'new_in_la28' | 'discontinued';

const normalizeKey = (value?: string | null): string =>
  (value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const DEFAULT_INDIA_TIER_BY_KEY: Record<string, IndiaTier> = {
  hockey: 'medal_hopeful',
  shooting: 'medal_hopeful',
  athletics: 'medal_hopeful',
  wrestling: 'medal_hopeful',
  badminton: 'medal_hopeful',
  archery: 'medal_hopeful',
  cricket: 'medal_hopeful',
  boxing: 'medal_hopeful',
  weightlifting: 'outside_chance',
  squash: 'outside_chance',
  'table-tennis': 'outside_chance',
  tennis: 'qualification_watch',
  golf: 'qualification_watch',
  gymnastics: 'qualification_watch',
  aquatics: 'qualification_watch',
  sailing: 'qualification_watch',
  judo: 'qualification_watch',
  rowing: 'qualification_watch',
  equestrian: 'qualification_watch',
  fencing: 'qualification_watch',
  football: 'history_only',
  basketball: 'history_only',
  cycling: 'history_only',
  'art-competitions': 'history_only',
  'art-competition': 'history_only',
};

const DEFAULT_OLYMPIC_STATUS_BY_KEY: Record<string, SportLifecycle> = {
  cricket: 'new_in_la28',
  squash: 'new_in_la28',
  'flag-football': 'new_in_la28',
  lacrosse: 'new_in_la28',
  'art-competitions': 'discontinued',
  'art-competition': 'discontinued',
};

export const INDIA_TIER_LABELS: Record<IndiaTier, string> = {
  medal_hopeful: 'Medal Hope',
  outside_chance: 'Outside Chance',
  qualification_watch: 'Qualification',
  history_only: 'Participated',
};

export const INDIA_TIER_TRACK_LABELS: Record<Exclude<IndiaTier, 'history_only'>, string> = {
  medal_hopeful: 'Medal Track',
  outside_chance: 'Outside Chance',
  qualification_watch: 'Qualification Track',
};

export function resolveDefaultIndiaTier(input?: {
  slug?: string | null;
  name?: string | null;
}): IndiaTier | null {
  const slugKey = normalizeKey(input?.slug);
  const nameKey = normalizeKey(input?.name);
  return DEFAULT_INDIA_TIER_BY_KEY[slugKey] || DEFAULT_INDIA_TIER_BY_KEY[nameKey] || null;
}

export function resolveDefaultSportLifecycle(input?: {
  slug?: string | null;
  name?: string | null;
}): SportLifecycle | null {
  const slugKey = normalizeKey(input?.slug);
  const nameKey = normalizeKey(input?.name);
  return DEFAULT_OLYMPIC_STATUS_BY_KEY[slugKey] || DEFAULT_OLYMPIC_STATUS_BY_KEY[nameKey] || null;
}

export function normalizeLegacyContenderTier(
  value?: string | null,
): IndiaTier | null {
  if (value === 'medal_hopeful') return 'medal_hopeful';
  if (value === 'outside_chance') return 'outside_chance';
  if (value === 'qualification_only' || value === 'qualification_watch') {
    return 'qualification_watch';
  }
  if (value === 'history_only') return 'history_only';
  return null;
}
