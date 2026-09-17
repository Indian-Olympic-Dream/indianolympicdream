import type { GamesScheduleRow } from '../services/payload.service';
import { hasIndiaAppearance, indiaDateKey } from './games-hub.presentation';

/** Clock time can prioritise a fixture, but cannot declare it live or completed. */
export function buildIndiaTimeline(rows: GamesScheduleRow[], now: Date, selectedDay = '') {
  const stamp = now.getTime();
  const confirmed = rows.filter(row => Number.isFinite(Date.parse(row.startTime)) && hasIndiaAppearance(row))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const complete = (row: GamesScheduleRow) => row.status === 'completed' || !!row.result?.summary;
  let nextDay = false;
  let focusDay = selectedDay || indiaDateKey(now.toISOString());
  let visible = selectedDay
    ? confirmed.filter(row => indiaDateKey(row.startTime) === selectedDay)
    : confirmed.filter(row => row.status === 'live'
      || (Date.parse(row.startTime) >= stamp && Date.parse(row.startTime) < stamp + 86_400_000)
      || (Date.parse(row.startTime) >= stamp - 86_400_000 && Date.parse(row.startTime) < stamp));
  if (!selectedDay && !visible.length) {
    const next = confirmed.find(row => !complete(row) && Date.parse(row.startTime) >= stamp);
    if (next) {
      nextDay = true;
      focusDay = indiaDateKey(next.startTime);
      visible = confirmed.filter(row => indiaDateKey(row.startTime) === focusDay);
    }
  }
  return {
    focusDay, nextDay, total: visible.length,
    live: visible.filter(row => row.status === 'live'),
    upcoming: visible.filter(row => row.status !== 'live' && !complete(row) && Date.parse(row.startTime) >= stamp),
    pending: visible.filter(row => row.status !== 'live' && !complete(row) && Date.parse(row.startTime) < stamp),
    results: visible.filter(row => row.status !== 'live' && complete(row)).reverse(),
  };
}

export function timeUntilStart(start: string, now: Date): string {
  const minutes = Math.ceil((Date.parse(start) - now.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Awaiting update';
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (hours < 24) return `In ${hours}h${rest ? ` ${rest}m` : ''}`;
  return `In ${Math.floor(hours / 24)}d${hours % 24 ? ` ${hours % 24}h` : ''}`;
}
