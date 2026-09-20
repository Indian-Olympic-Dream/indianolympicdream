import {
  resultMatchForDetail,
  resultRankLabel,
  timelineResultSummary,
} from './asian-games-session.presentation';
import type { GamesScheduleRow, GamesSessionDetail } from '../services/payload.service';

describe('Asian Games ranked-result presentation', () => {
  const detail: GamesSessionDetail = {
    event: '10m Air Rifle Women Individual',
    phase: 'Final',
    sourceUrl: 'https://results.example/discipline/SHO/results/W.ARW.FNL',
  };
  const row = {
    id: 'shooting-final',
    startTime: '2026-09-20T05:30:00.000Z',
    result: {
      summary: 'VALARIVAN Elavenil — Silver · 252.4',
      matches: [{
        officialKey: 'W.ARW.FNL',
        format: 'ranked' as const,
        event: detail.event,
        phase: 'Final',
        entries: [{ name: 'VALARIVAN Elavenil', rank: 2, result: '252.4', medal: 'Silver' }],
      }],
    },
  } as GamesScheduleRow;

  it('resolves the exact official unit and formats its placing', () => {
    expect(resultMatchForDetail(detail, row)?.entries?.[0].result).toBe('252.4');
    expect(resultRankLabel(2)).toBe('2nd');
    expect(resultRankLabel(11)).toBe('11th');
  });

  it('keeps the timeline summary compact while preserving the drawer data', () => {
    expect(timelineResultSummary(row)).toBe('1 silver · 1 India result');
  });
});
