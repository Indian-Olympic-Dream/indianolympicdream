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
