import {
  hasIndiaResultForDetail,
  isEntrantHeadToHeadDetail,
  resultMedalsForDetail,
  resultMatchForDetail,
  resultRankLabel,
  resultSummaryForDetail,
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

describe('Asian Games head-to-head result presentation', () => {
  const allIndiaDetail: GamesSessionDetail = {
    event: "Women's Singles",
    phase: 'Quarterfinals',
    unit: 'Match 3',
    sourceUrl: 'https://results.example/discipline/SQU/results/W.SINGLES.QFNL.3',
    organisations: ['IND', 'IND'],
    competitors: ['SINGH Anahat', 'KHANNA Tanvi'],
    sides: [
      { code: 'IND', label: 'SINGH Anahat', participants: ['Anahat Singh', 'Tanvi Khanna'], score: '3', isWinner: true },
      { code: 'IND', label: 'KHANNA Tanvi', participants: ['Anahat Singh', 'Tanvi Khanna'], score: '0', isWinner: false },
    ],
  };
  const allIndiaRow = {
    id: 'squash-quarterfinals',
    startTime: '2026-09-25T03:45:00.000Z',
    sessionDetails: [allIndiaDetail],
    result: {
      summary: 'India beat SINGH Anahat 3–0 (11–2, 11–5, 11–3)',
      matches: [{
        officialKey: 'W.SINGLES.QFNL.3',
        format: 'head-to-head' as const,
        event: "Women's Singles",
        phase: 'Quarterfinals',
        unit: 'Match 3',
        summary: 'India beat SINGH Anahat 3–0 (11–2, 11–5, 11–3)',
      }],
    },
  } as GamesScheduleRow;

  it('treats athlete cards as entrants and names both athletes in an all-India result', () => {
    expect(isEntrantHeadToHeadDetail(allIndiaDetail, allIndiaRow)).toBeTrue();
    expect(resultSummaryForDetail(allIndiaDetail, allIndiaRow)).toBe(
      'SINGH Anahat beat KHANNA Tanvi 3–0 (11–2, 11–5, 11–3)',
    );
  });

  it('keeps country-first copy for a team fixture', () => {
    const detail: GamesSessionDetail = {
      event: 'Women',
      phase: 'Finals',
      unit: 'Gold Medal Match',
      sourceUrl: 'https://results.example/discipline/CKT/results/W.TEAM.FNL.1',
      sides: [
        { code: 'SRI', label: 'Sri Lanka', participants: ['Athlete A'], score: '69/10', isWinner: false },
        { code: 'IND', label: 'India', participants: ['Athlete B'], score: '216/3', isWinner: true },
      ],
    };
    const row = {
      id: 'cricket-final',
      startTime: '2026-09-22T05:00:00.000Z',
      sessionDetails: [detail],
      result: { matches: [{
        officialKey: 'W.TEAM.FNL.1',
        format: 'head-to-head' as const,
        summary: 'India beat Sri Lanka 216/3–69/10 · Gold',
        medal: 'Gold',
      }] },
    } as GamesScheduleRow;

    expect(isEntrantHeadToHeadDetail(detail, row)).toBeFalse();
    expect(resultSummaryForDetail(detail, row)).toBe('India beat Sri Lanka 216/3–69/10 · Gold');
    expect(resultMedalsForDetail(detail, row)).toEqual(['Gold']);
  });

  it('exposes earned medals from ranked result entries', () => {
    const detail: GamesSessionDetail = {
      event: '10m Air Rifle Men Individual',
      phase: 'Final',
      sourceUrl: 'https://results.example/discipline/SHO/results/M.ARM.FNL.1',
    };
    const row = {
      id: 'shooting-final',
      startTime: '2026-09-21T03:30:00.000Z',
      result: { matches: [{
        officialKey: 'M.ARM.FNL.1',
        format: 'ranked' as const,
        entries: [
          { name: 'DHILLON Himanshu', medal: 'Silver' },
          { name: 'PATIL Rudrankksh Balasaheb', medal: 'Bronze' },
        ],
      }] },
    } as GamesScheduleRow;

    expect(resultMedalsForDetail(detail, row)).toEqual(['Silver', 'Bronze']);
  });

  it('excludes an adjacent non-India fixture from an India results drawer', () => {
    const detail: GamesSessionDetail = {
      event: 'Mixed Doubles',
      phase: 'Quarterfinals',
      unit: 'Match 3',
      sourceUrl: 'https://results.example/discipline/SQU/results/X.DOUBLES.QFNL.3',
      organisations: ['HKG', 'PAK'],
      sides: [
        { code: 'HKG', label: 'TSE Yee Lam Toby / LAI Cheuk Nam', score: '2', isWinner: true },
        { code: 'PAK', label: 'KHAN Asim / ALI Mehwish', score: '0', isWinner: false },
      ],
    };
    const row = {
      id: 'squash-quarterfinals',
      startTime: '2026-09-25T03:45:00.000Z',
      result: { matches: [{
        officialKey: 'X.DOUBLES.QFNL.3',
        format: 'head-to-head' as const,
        summary: 'India lost to TSE Yee Lam Toby / LAI Cheuk Nam 0–2',
      }] },
    } as GamesScheduleRow;

    expect(hasIndiaResultForDetail(detail, row)).toBeFalse();
    expect(hasIndiaResultForDetail(allIndiaDetail, allIndiaRow)).toBeTrue();
  });
});
